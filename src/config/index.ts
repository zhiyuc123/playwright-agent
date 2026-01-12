import type { LLMConfig } from '@page-agent/llms'
import type { Page } from 'playwright'
import type { DomTreeConfig } from '../dom/domTree'

export type { LLMConfig }

export interface PlaywrightAgentConfig extends LLMConfig, DomTreeConfig {
	/**
	 * Playwright Page object - required
	 */
	page: Page

	/**
	 * Custom tools to extend PlaywrightAgent capabilities
	 * @experimental
	 */
	customTools?: Record<string, any>

	/**
	 * Lifecycle hooks
	 */
	onBeforeStep?: (this: any, stepCnt: number) => Promise<void> | void
	onAfterStep?: (this: any, stepCnt: number, history: any[]) => Promise<void> | void
	onBeforeTask?: (this: any) => Promise<void> | void
	onAfterTask?: (this: any, result: any) => Promise<void> | void
	onDispose?: (this: any, reason?: string) => void

	/**
	 * @experimental
	 * Enable the experimental script execution tool
	 */
	experimentalScriptExecutionTool?: boolean
}
