import {
	type AgentBrain,
	LLM,
	type MacroToolInput,
	type MacroToolResult,
	type Tool,
} from '@page-agent/llms'
import chalk from 'chalk'
import zod from 'zod'

import type { PlaywrightAgentConfig } from './config'
import { MAX_STEPS } from './config/constants'
import { SYSTEM_PROMPT } from './prompts/system_prompt'
import { PlaywrightController } from './PlaywrightController'
import { tools } from './tools'
import { trimLines, uid, waitUntil } from './utils'

export type { PlaywrightAgentConfig }
export { tool, type PlaywrightAgentTool } from './tools'
export type { AgentBrain, MacroToolInput, MacroToolResult }

export interface AgentHistory {
	brain: AgentBrain
	action: {
		name: string
		input: any
		output: string
	}
	usage: {
		promptTokens: number
		completionTokens: number
		totalTokens: number
		cachedTokens?: number
		reasoningTokens?: number
	}
}

export interface ExecutionResult {
	success: boolean
	data: string
	history: AgentHistory[]
}

export class PlaywrightAgent extends EventTarget {
	config: PlaywrightAgentConfig
	id = uid()
	tools: typeof tools
	paused = false
	disposed = false
	task = ''
	taskId = ''

	#llm: LLM
	#totalWaitTime = 0
	#abortController = new AbortController()
	#llmRetryListener: ((e: Event) => void) | null = null
	#llmErrorListener: ((e: Event) => void) | null = null

	/** PlaywrightController for DOM operations */
	playwrightController: PlaywrightController

	/** History records */
	history: AgentHistory[] = []

	constructor(config: PlaywrightAgentConfig) {
		super()

		if (!config.page) {
			throw new Error('Playwright Page object is required')
		}

		this.config = config
		this.#llm = new LLM(this.config)
		this.tools = new Map(tools)

		// Initialize PlaywrightController with config
		this.playwrightController = new PlaywrightController(config.page, this.config)

		// Listen to LLM events
		this.#llmRetryListener = (e) => {
			const { current, max } = (e as CustomEvent).detail
			console.log(chalk.yellow(`Retry ${current}/${max}`))
		}
		this.#llmErrorListener = (e) => {
			const { error } = (e as CustomEvent).detail
			console.error(chalk.red(`Step failed: ${error.message}`))
		}
		this.#llm.addEventListener('retry', this.#llmRetryListener)
		this.#llm.addEventListener('error', this.#llmErrorListener)

		if (this.config.customTools) {
			for (const [name, tool] of Object.entries(this.config.customTools)) {
				if (tool === null) {
					this.tools.delete(name)
					continue
				}
				this.tools.set(name, tool)
			}
		}

		if (!this.config.experimentalScriptExecutionTool) {
			this.tools.delete('execute_javascript')
		}
	}

	/**
	 * Execute a task
	 */
	async execute(task: string): Promise<ExecutionResult> {
		if (!task) throw new Error('Task is required')
		this.task = task
		this.taskId = uid()

		const onBeforeStep = this.config.onBeforeStep || (() => void 0)
		const onAfterStep = this.config.onAfterStep || (() => void 0)
		const onBeforeTask = this.config.onBeforeTask || (() => void 0)
		const onAfterTask = this.config.onAfterTask || (() => void 0)

		await onBeforeTask.call(this)

		console.log(chalk.blue.bold('Task:'), this.task)

		if (this.#abortController) {
			this.#abortController.abort()
			this.#abortController = new AbortController()
		}

		this.history = []

		try {
			let step = 0

			while (true) {
				await onBeforeStep.call(this, step)

				console.group(`step: ${step}`)

				// abort
				if (this.#abortController.signal.aborted) throw new Error('AbortError')
				// pause
				await waitUntil(() => !this.paused)

				// Update status to thinking
				console.log(chalk.blue('Thinking...'))

				const result = await this.#llm.invoke(
					[
						{
							role: 'system',
							content: this.#getSystemPrompt(),
						},
						{
							role: 'user',
							content: await this.#assembleUserPrompt(),
						},
					],
					{ AgentOutput: this.#packMacroTool() },
					this.#abortController.signal
				)

				const macroResult = result.toolResult as MacroToolResult
				const input = macroResult.input
				const output = macroResult.output
				const brain = {
					evaluation_previous_goal: input.evaluation_previous_goal || '',
					memory: input.memory || '',
					next_goal: input.next_goal || '',
				}
				const actionName = Object.keys(input.action)[0]
				const action = {
					name: actionName,
					input: input.action[actionName],
					output: output,
				}

				this.history.push({
					brain,
					action,
					usage: result.usage,
				})

				console.log(chalk.green('Step finished:'), actionName)
				console.groupEnd()

				await onAfterStep.call(this, step, this.history)

				step++
				if (step > MAX_STEPS) {
					this.#onDone('Step count exceeded maximum limit', false)
					const result: ExecutionResult = {
						success: false,
						data: 'Step count exceeded maximum limit',
						history: this.history,
					}
					await onAfterTask.call(this, result)
					return result
				}
				if (actionName === 'done') {
					const success = action.input?.success ?? false
					const text = action.input?.text || 'no text provided'
					console.log(chalk.green.bold('Task completed'), success, text)
					this.#onDone(text, success)
					const result: ExecutionResult = {
						success,
						data: text,
						history: this.history,
					}
					await onAfterTask.call(this, result)
					return result
				}
			}
		} catch (error: unknown) {
			console.error('Task failed', error)
			this.#onDone(String(error), false)
			const result: ExecutionResult = {
				success: false,
				data: String(error),
				history: this.history,
			}
			await onAfterTask.call(this, result)
			return result
		}
	}

	/**
	 * Merge all tools into a single MacroTool
	 */
	#packMacroTool(): Tool<MacroToolInput, MacroToolResult> {
		const tools = this.tools

		const actionSchemas = Array.from(tools.entries()).map(([toolName, tool]) => {
			return zod.object({ [toolName]: tool.inputSchema }).describe(tool.description)
		})

		const actionSchema = zod.union(
			actionSchemas as unknown as [zod.ZodType, zod.ZodType, ...zod.ZodType[]]
		)

		const macroToolSchema = zod.object({
			evaluation_previous_goal: zod.string().optional(),
			memory: zod.string().optional(),
			next_goal: zod.string().optional(),
			action: actionSchema,
		})

		return {
			inputSchema: macroToolSchema as zod.ZodType<MacroToolInput>,
			execute: async (input: MacroToolInput): Promise<MacroToolResult> => {
				// abort
				if (this.#abortController.signal.aborted) throw new Error('AbortError')
				// pause
				await waitUntil(() => !this.paused)

				console.log(chalk.blue.bold('MacroTool execute'), input)
				const action = input.action

				const toolName = Object.keys(action)[0]
				const toolInput = action[toolName]
				const brain = trimLines(`✅: ${input.evaluation_previous_goal}
						💾: ${input.memory}
						🎯: ${input.next_goal}
					`)

				console.log(brain)

				// Find the corresponding tool
				const tool = tools.get(toolName)
				if (!tool) {
					throw new Error(`Tool ${toolName} not found.`)
				}

				console.log(chalk.blue.bold(`Executing tool: ${toolName}`), toolInput)

				const startTime = Date.now()

				// Execute tool, bind `this` to PlaywrightAgent
				let result = await tool.execute.bind(this)(toolInput)

				const duration = Date.now() - startTime
				console.log(chalk.green.bold(`Tool (${toolName}) executed for ${duration}ms`), result)

				if (toolName === 'wait') {
					this.#totalWaitTime += Math.round(toolInput.seconds + duration / 1000)
					result += `\n<sys> You have waited ${this.#totalWaitTime} seconds accumulatively.`
					if (this.#totalWaitTime >= 3)
						result += '\nDo NOT wait any longer unless you have a good reason.\n'
					result += '</sys>'
				} else {
					// For other tools, reset wait time
					this.#totalWaitTime = 0
				}

				// Wait a moment
				await new Promise((resolve) => setTimeout(resolve, 100))

				// Return structured result
				return {
					input,
					output: result,
				}
			},
		}
	}

	/**
	 * Get system prompt, dynamically replace language settings based on configured language
	 */
	#getSystemPrompt(): string {
		let systemPrompt = SYSTEM_PROMPT

		// Default to English for Node.js environment (no language config in PlaywrightAgent)
		const targetLanguage = 'English'
		systemPrompt = systemPrompt.replace(
			/Default working language: \*\*.*?\*\*/,
			`Default working language: **${targetLanguage}**`
		)

		return systemPrompt
	}

	async #assembleUserPrompt(): Promise<string> {
		let prompt = ''

		// <agent_history>
		prompt += '<agent_history>\n'

		this.history.forEach((history, index) => {
			prompt += `<step_${index + 1}>
				Evaluation of Previous Step: ${history.brain.evaluation_previous_goal}
				Memory: ${history.brain.memory}
				Next Goal: ${history.brain.next_goal}
				Action Results: ${history.action.output}
				</step_${index + 1}>
			`
		})

		prompt += '</agent_history>\n\n'

		// <agent_state>
		prompt += `<agent_state>
			<user_request>
			${this.task}
			</user_request>
			<step_info>
			Step ${this.history.length + 1} of ${MAX_STEPS} max possible steps
			Current date and time: ${new Date().toISOString()}
			</step_info>
			</agent_state>
		`

		// <browser_state>
		prompt += await this.#getBrowserState()

		return trimLines(prompt)
	}

	#onDone(text: string, success = true) {
		console.log(success ? chalk.green('✅ Task completed') : chalk.red('❌ Task failed'), text)

		this.#abortController.abort()
	}

	async #getBrowserState(): Promise<string> {
		const pageUrl = await this.playwrightController.getCurrentUrl()
		const pageTitle = await this.playwrightController.getPageTitle()
		const pi = await this.playwrightController.getPageInfo()
		const viewportExpansion = await this.playwrightController.getViewportExpansion()

		await this.playwrightController.updateTree()

		const simplifiedHTML = await this.playwrightController.getSimplifiedHTML()

		let prompt = trimLines(`<browser_state>
			Current Page: [${pageTitle}](${pageUrl})

			Page info: ${pi.viewport_width}x${pi.viewport_height}px viewport, ${pi.page_width}x${pi.page_height}px total page size, ${pi.pages_above.toFixed(1)} pages above, ${pi.pages_below.toFixed(1)} pages below, ${pi.total_pages.toFixed(1)} total pages, at ${(pi.current_page_position * 100).toFixed(0)}% of page

			${viewportExpansion === -1 ? 'Interactive elements from top layer of the current page (full page):' : 'Interactive elements from top layer of the current page inside the viewport:'}

		`)

		// Page header info
		const has_content_above = pi.pixels_above > 4
		if (has_content_above && viewportExpansion !== -1) {
			prompt += `... ${pi.pixels_above} pixels above (${pi.pages_above.toFixed(1)} pages) - scroll to see more ...\n`
		} else {
			prompt += `[Start of page]\n`
		}

		// Current viewport info
		prompt += simplifiedHTML
		prompt += `\n`

		// Page footer info
		const has_content_below = pi.pixels_below > 4
		if (has_content_below && viewportExpansion !== -1) {
			prompt += `... ${pi.pixels_below} pixels below (${pi.pages_below.toFixed(1)} pages) - scroll to see more ...\n`
		} else {
			prompt += `[End of page]\n`
		}

		prompt += `</browser_state>\n`

		return prompt
	}

	dispose(reason?: string) {
		console.log('Disposing PlaywrightAgent...')
		this.disposed = true
		this.playwrightController.dispose()
		this.history = []
		this.#abortController.abort(reason ?? 'PlaywrightAgent disposed')

		// Clean up LLM event listeners
		if (this.#llmRetryListener) {
			this.#llm.removeEventListener('retry', this.#llmRetryListener)
			this.#llmRetryListener = null
		}
		if (this.#llmErrorListener) {
			this.#llm.removeEventListener('error', this.#llmErrorListener)
			this.#llmErrorListener = null
		}

		this.config.onDispose?.call(this, reason)
	}
}
