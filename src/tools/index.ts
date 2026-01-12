/**
 * Internal tools for PlaywrightAgent.
 * @note Adapted from page-agent
 */
import zod, { type z } from 'zod'

import type { PlaywrightAgent } from '../PlaywrightAgent'
import { waitFor } from '../utils'

/**
 * Internal tool definition that has access to PlaywrightAgent `this` context
 */
export interface PlaywrightAgentTool<TParams = any> {
	description: string
	inputSchema: z.ZodType<TParams>
	execute: (this: PlaywrightAgent, args: TParams) => Promise<string>
}

export function tool<TParams>(options: PlaywrightAgentTool<TParams>): PlaywrightAgentTool<TParams> {
	return options
}

/**
 * Internal tools for PlaywrightAgent.
 */
export const tools = new Map<string, PlaywrightAgentTool>()

tools.set(
	'done',
	tool({
		description:
			'Complete task - provide a summary of results for the user. Set success=True if task completed successfully, false otherwise. Text should be your response to the user summarizing results.',
		inputSchema: zod.object({
			text: zod.string(),
			success: zod.boolean().default(true),
		}),
		execute: async function (this: PlaywrightAgent, input) {
			return Promise.resolve('Task completed')
		},
	})
)

tools.set(
	'wait',
	tool({
		description:
			'Wait for x seconds. default 1s (max 10 seconds, min 1 second). This can be used to wait until the page or data is fully loaded.',
		inputSchema: zod.object({
			seconds: zod.number().min(1).max(10).default(1),
		}),
		execute: async function (this: PlaywrightAgent, input) {
			const lastTimeUpdate = await this.playwrightController.getLastUpdateTime()
			const actualWaitTime = Math.max(0, input.seconds - (Date.now() - lastTimeUpdate) / 1000)
			console.log(`actualWaitTime: ${actualWaitTime} seconds`)
			await waitFor(actualWaitTime)
			return `✅ Waited for ${input.seconds} seconds.`
		},
	})
)

tools.set(
	'ask_user',
	tool({
		description:
			'Ask the user a question and wait for their answer. Use this if you need more information or clarification.',
		inputSchema: zod.object({
			question: zod.string(),
		}),
		execute: async function (this: PlaywrightAgent, input) {
			// In Node.js environment, we can use readline or prompt-sync
			// For now, return a message indicating user interaction needed
			console.log(`\n🤔 Question: ${input.question}\n`)
			return `✅ User interaction needed. Please provide answer to: ${input.question}`
		},
	})
)

tools.set(
	'click_element_by_index',
	tool({
		description: 'Click element by index',
		inputSchema: zod.object({
			index: zod.number().int().min(0),
		}),
		execute: async function (this: PlaywrightAgent, input) {
			const result = await this.playwrightController.clickElement(input.index)
			return result.message
		},
	})
)

tools.set(
	'input_text',
	tool({
		description: 'Click and input text into a input interactive element',
		inputSchema: zod.object({
			index: zod.number().int().min(0),
			text: zod.string(),
		}),
		execute: async function (this: PlaywrightAgent, input) {
			const result = await this.playwrightController.inputText(input.index, input.text)
			return result.message
		},
	})
)

tools.set(
	'select_dropdown_option',
	tool({
		description:
			'Select dropdown option for interactive element index by the text of the option you want to select',
		inputSchema: zod.object({
			index: zod.number().int().min(0),
			text: zod.string(),
		}),
		execute: async function (this: PlaywrightAgent, input) {
			const result = await this.playwrightController.selectOption(input.index, input.text)
			return result.message
		},
	})
)

tools.set(
	'scroll',
	tool({
		description:
			'Scroll the page by specified number of pages (set down=True to scroll down, down=False to scroll up, num_pages=number of pages to scroll like 0.5 for half page, 1.0 for one page, etc.). Optional index parameter to scroll within a specific element or its scroll container (works well for dropdowns and custom UI components). Optional pixels parameter to scroll by a specific number of pixels instead of pages.',
		inputSchema: zod.object({
			down: zod.boolean().default(true),
			num_pages: zod.number().min(0).max(10).optional().default(0.1),
			pixels: zod.number().int().min(0).optional(),
			index: zod.number().int().min(0).optional(),
		}),
		execute: async function (this: PlaywrightAgent, input) {
			const result = await this.playwrightController.scroll({
				...input,
				numPages: input.num_pages,
			})
			return result.message
		},
	})
)

tools.set(
	'scroll_horizontally',
	tool({
		description:
			'Scroll the page or element horizontally (set right=True to scroll right, right=False to scroll left, pixels=number of pixels to scroll). Optional index parameter to scroll within a specific element or its scroll container (works well for wide tables).',
		inputSchema: zod.object({
			right: zod.boolean().default(true),
			pixels: zod.number().int().min(0),
			index: zod.number().int().min(0).optional(),
		}),
		execute: async function (this: PlaywrightAgent, input) {
			const result = await this.playwrightController.scrollHorizontally(input)
			return result.message
		},
	})
)

tools.set(
	'execute_javascript',
	tool({
		description:
			'Execute JavaScript code on the current page. Supports async/await syntax. Use with caution!',
		inputSchema: zod.object({
			script: zod.string(),
		}),
		execute: async function (this: PlaywrightAgent, input) {
			const result = await this.playwrightController.executeJavascript(input.script)
			return result.message
		},
	})
)
