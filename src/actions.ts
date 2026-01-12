import type { Locator, Page } from 'playwright'

export interface ActionResult {
	success: boolean
	message: string
}

/**
 * Click element by locator
 */
export async function clickElement(locator: Locator): Promise<ActionResult> {
	try {
		await locator.scrollIntoViewIfNeeded()
		await locator.click({ timeout: 5000 })
		return {
			success: true,
			message: '✅ Clicked element.',
		}
	} catch (error) {
		return {
			success: false,
			message: `❌ Failed to click element: ${error}`,
		}
	}
}

/**
 * Input text into element by locator
 */
export async function inputTextElement(locator: Locator, text: string): Promise<ActionResult> {
	try {
		await locator.scrollIntoViewIfNeeded()
		await locator.fill('') // Clear first
		await locator.fill(text)
		return {
			success: true,
			message: `✅ Input text (${text}) into element.`,
		}
	} catch (error) {
		return {
			success: false,
			message: `❌ Failed to input text: ${error}`,
		}
	}
}

/**
 * Select dropdown option by locator and option text
 * Skips if no options are available
 */
export async function selectOptionElement(
	locator: Locator,
	optionText: string
): Promise<ActionResult> {
	try {
		await locator.scrollIntoViewIfNeeded()
		
		// Check if element has any options
		const options = locator.locator('option')
		const optionCount = await options.count()
		
		if (optionCount === 0) {
			return {
				success: true,
				message: `⏭️ Skipped selecting option (${optionText}) - no options available in dropdown.`,
			}
		}
		
		// Try to select the option
		await locator.selectOption({ label: optionText })
		return {
			success: true,
			message: `✅ Selected option (${optionText}) in element.`,
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
export async function scrollVertically(
	page: Page,
	down: boolean,
	scrollAmount: number,
	element?: Locator | null
): Promise<string> {
	if (element) {
		// Scroll within element
		try {
			const beforeScroll = await element.evaluate((el) => el.scrollTop)
			await element.evaluate((el, amount) => {
				el.scrollTop += amount
			}, scrollAmount)
			const afterScroll = await element.evaluate((el) => el.scrollTop)
			const actualScroll = afterScroll - beforeScroll

			if (Math.abs(actualScroll) > 0.5) {
				return `✅ Scrolled container by ${actualScroll}px.`
			}
		} catch (error) {
			// Fall through to page scroll
		}
	}

	// Page-level scrolling
	await page.evaluate((amount) => {
		window.scrollBy(0, amount)
	}, scrollAmount)

	return `✅ Scrolled page by ${scrollAmount}px.`
}

/**
 * Scroll horizontally
 */
export async function scrollHorizontally(
	page: Page,
	right: boolean,
	scrollAmount: number,
	element?: Locator | null
): Promise<string> {
	const dx = right ? scrollAmount : -scrollAmount

	if (element) {
		// Scroll within element
		try {
			const beforeScroll = await element.evaluate((el) => el.scrollLeft)
			await element.evaluate((el, amount) => {
				el.scrollLeft += amount
			}, dx)
			const afterScroll = await element.evaluate((el) => el.scrollLeft)
			const actualScroll = afterScroll - beforeScroll

			if (Math.abs(actualScroll) > 0.5) {
				return `✅ Scrolled container horizontally by ${actualScroll}px.`
			}
		} catch (error) {
			// Fall through to page scroll
		}
	}

	// Page-level scrolling
	await page.evaluate((amount) => {
		window.scrollBy(amount, 0)
	}, dx)

	return `✅ Scrolled page horizontally by ${dx}px.`
}

/**
 * Execute JavaScript on the page
 */
export async function executeJavascript(page: Page, script: string): Promise<ActionResult> {
	try {
		const result = await page.evaluate(`(async () => { ${script} })()`)
		return {
			success: true,
			message: `✅ Executed JavaScript. Result: ${result}`,
		}
	} catch (error) {
		return {
			success: false,
			message: `❌ Error executing JavaScript: ${error}`,
		}
	}
}
