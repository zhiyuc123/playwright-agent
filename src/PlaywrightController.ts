/**
 * PlaywrightController - Manages DOM operations and element interactions using Playwright.
 * Designed to be independent of LLM and can be tested in unit tests.
 * All public methods are async for potential remote calling support.
 */

import type { Page } from 'playwright'
import {
	clickElement,
	executeJavascript,
	inputTextElement,
	scrollHorizontally,
	scrollVertically,
	selectOptionElement,
} from './actions'
import { VIEWPORT_EXPANSION } from './config/constants'
import * as dom from './dom'
import type { FlatDomTree, InteractiveElementDomNode } from './dom/type'
import { getPageInfo } from './dom/getPageInfo'

/**
 * Configuration for PlaywrightController
 */
export interface PlaywrightControllerConfig extends dom.DomTreeConfig {
	viewportExpansion?: number
}

interface ActionResult {
	success: boolean
	message: string
}

/**
 * PlaywrightController manages DOM state and element interactions using Playwright.
 * It provides async methods for all DOM operations, keeping state isolated.
 */
export class PlaywrightController extends EventTarget {
	private config: PlaywrightControllerConfig
	private page: Page

	/** Corresponds to eval_page in browser-use */
	private flatTree: FlatDomTree | null = null

	/**
	 * All indexed interactive elements
	 * Maps index to InteractiveElementDomNode with Playwright Locator
	 */
	private selectorMap = new Map<number, InteractiveElementDomNode>()

	/** Index -> element text description mapping */
	private elementTextMap = new Map<number, string>()

	/**
	 * Simplified HTML for LLM consumption.
	 * Corresponds to clickable_elements_to_string in browser-use
	 */
	private simplifiedHTML = '<EMPTY>'

	/** last time the tree was updated */
	private lastTimeUpdate = 0

	constructor(page: Page, config: PlaywrightControllerConfig = {}) {
		super()

		this.page = page
		this.config = config
	}

	// ======= State Queries =======

	/**
	 * Get current page URL
	 */
	async getCurrentUrl(): Promise<string> {
		return this.page.url()
	}

	/**
	 * Get current page title
	 */
	async getPageTitle(): Promise<string> {
		return this.page.title()
	}

	/**
	 * Get page scroll and size info
	 */
	async getPageInfo() {
		return getPageInfo(this.page)
	}

	/**
	 * Get the simplified HTML representation of the page.
	 * This is used by LLM to understand the page structure.
	 */
	async getSimplifiedHTML(): Promise<string> {
		return this.simplifiedHTML
	}

	/**
	 * Get text description for an element by index
	 */
	async getElementText(index: number): Promise<string | undefined> {
		return this.elementTextMap.get(index)
	}

	/**
	 * Get total number of indexed interactive elements
	 */
	async getElementCount(): Promise<number> {
		return this.selectorMap.size
	}

	/**
	 * Get last tree update timestamp
	 */
	async getLastUpdateTime(): Promise<number> {
		return this.lastTimeUpdate
	}

	/**
	 * Get the viewport expansion setting
	 */
	async getViewportExpansion(): Promise<number> {
		return this.config.viewportExpansion ?? VIEWPORT_EXPANSION
	}

	// ======= DOM Tree Operations =======

	/**
	 * Update DOM tree, returns simplified HTML for LLM.
	 * This is the main method to refresh the page state.
	 */
	async updateTree(): Promise<string> {
		this.dispatchEvent(new Event('beforeUpdate'))

		this.lastTimeUpdate = Date.now()

		this.flatTree = await dom.getFlatTree(this.page, this.config)

		this.simplifiedHTML = dom.flatTreeToString(this.flatTree, this.config.include_attributes)

		this.selectorMap.clear()
		this.selectorMap = dom.getSelectorMap(this.flatTree)

		this.elementTextMap.clear()
		this.elementTextMap = dom.getElementTextMap(this.simplifiedHTML)

		this.dispatchEvent(new Event('afterUpdate'))

		return this.simplifiedHTML
	}

	// ======= Element Actions =======

	/**
	 * Click element by index
	 */
	async clickElement(index: number): Promise<ActionResult> {
		try {
			const interactiveNode = this.selectorMap.get(index)
			if (!interactiveNode) {
				throw new Error(`No interactive element found at index ${index}`)
			}

			const elemText = this.elementTextMap.get(index)
			const result = await clickElement(interactiveNode.locator)

			// Check if link opens in new tab
			const target = interactiveNode.attributes?.target
			if (target === '_blank') {
				return {
					success: true,
					message: `✅ Clicked element (${elemText ?? index}). ⚠️ Link opens in a new tab. You are not capable of reading new tabs.`,
				}
			}

			return {
				success: result.success,
				message: result.success
					? `✅ Clicked element (${elemText ?? index}).`
					: result.message,
			}
		} catch (error) {
			return {
				success: false,
				message: `❌ Failed to click element: ${error}`,
			}
		}
	}

	/**
	 * Input text into element by index
	 */
	async inputText(index: number, text: string): Promise<ActionResult> {
		try {
			const interactiveNode = this.selectorMap.get(index)
			if (!interactiveNode) {
				throw new Error(`No interactive element found at index ${index}`)
			}

			const elemText = this.elementTextMap.get(index)
			const result = await inputTextElement(interactiveNode.locator, text)

			return {
				success: result.success,
				message: result.success
					? `✅ Input text (${text}) into element (${elemText ?? index}).`
					: result.message,
			}
		} catch (error) {
			return {
				success: false,
				message: `❌ Failed to input text: ${error}`,
			}
		}
	}

	/**
	 * Select dropdown option by index and option text
	 */
	async selectOption(index: number, optionText: string): Promise<ActionResult> {
		try {
			const interactiveNode = this.selectorMap.get(index)
			if (!interactiveNode) {
				throw new Error(`No interactive element found at index ${index}`)
			}

			const elemText = this.elementTextMap.get(index)
			const result = await selectOptionElement(interactiveNode.locator, optionText)

			return {
				success: result.success,
				message: result.success
					? `✅ Selected option (${optionText}) in element (${elemText ?? index}).`
					: result.message,
			}
		} catch (error) {
			return {
				success: false,
				message: `❌ Failed to select option: ${error}`,
			}
		}
	}

	/**
	 * Scroll vertically
	 */
	async scroll(options: {
		down: boolean
		numPages: number
		pixels?: number
		index?: number
	}): Promise<ActionResult> {
		try {
			const { down, numPages, pixels, index } = options

			const viewportHeight = this.page.viewportSize()?.height ?? 800
			const scrollAmount = pixels ?? numPages * (down ? 1 : -1) * viewportHeight

			const element = index !== undefined ? this.selectorMap.get(index) : null

			const message = await scrollVertically(
				this.page,
				down,
				scrollAmount,
				element?.locator ?? null
			)

			return {
				success: true,
				message,
			}
		} catch (error) {
			return {
				success: false,
				message: `❌ Failed to scroll: ${error}`,
			}
		}
	}

	/**
	 * Scroll horizontally
	 */
	async scrollHorizontally(options: {
		right: boolean
		pixels: number
		index?: number
	}): Promise<ActionResult> {
		try {
			const { right, pixels, index } = options

			const element = index !== undefined ? this.selectorMap.get(index) : null

			const message = await scrollHorizontally(this.page, right, pixels, element?.locator ?? null)

			return {
				success: true,
				message,
			}
		} catch (error) {
			return {
				success: false,
				message: `❌ Failed to scroll horizontally: ${error}`,
			}
		}
	}

	/**
	 * Execute arbitrary JavaScript on the page
	 */
	async executeJavascript(script: string): Promise<ActionResult> {
		return executeJavascript(this.page, script)
	}

	/**
	 * Dispose and clean up resources
	 */
	dispose(): void {
		this.flatTree = null
		this.selectorMap.clear()
		this.elementTextMap.clear()
		this.simplifiedHTML = '<EMPTY>'
	}
}
