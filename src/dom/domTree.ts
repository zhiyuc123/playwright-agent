import type { Page } from 'playwright'
import type { FlatDomTree, InteractiveElementDomNode } from './type'
import { VIEWPORT_EXPANSION } from '../config/constants'

export interface DomTreeConfig {
	viewportExpansion?: number
	include_attributes?: string[]
}

/**
 * Extract interactive elements and build a flat DOM tree using Playwright
 */
export async function getFlatTree(
	page: Page,
	config: DomTreeConfig = {}
): Promise<FlatDomTree> {
	const viewportExpansion = config.viewportExpansion ?? VIEWPORT_EXPANSION

	// First, mark all interactive elements with unique data attributes
	// Use string function to avoid TypeScript compilation issues with __name helper
	// We create a function string and evaluate it in the browser context
	const evaluateCode = `function({ viewportExpansion }) {
			// Clean up previous marks
			document.querySelectorAll('[data-pw-agent-index]').forEach((el) => {
				el.removeAttribute('data-pw-agent-index')
			})

			const ID = { current: 0 }
			const DOM_HASH_MAP = {}
			let highlightIndex = 0

			// Helper to check if element is interactive
			function isInteractiveElement(element) {
				if (!element || element.nodeType !== Node.ELEMENT_NODE) {
					return false
				}

				const tagName = element.tagName.toLowerCase()
				const style = window.getComputedStyle(element)

				// Interactive elements
				const interactiveElements = new Set([
					'a',
					'button',
					'input',
					'select',
					'textarea',
					'details',
					'summary',
					'label',
				])

				if (interactiveElements.has(tagName)) {
					if (element.disabled || element.readOnly) return false
					return true
				}

				// Check cursor style
				const interactiveCursors = new Set(['pointer', 'text', 'grab', 'grabbing'])
				if (style.cursor && interactiveCursors.has(style.cursor)) {
					return true
				}

				// Check contenteditable
				if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
					return true
				}

				// Check role
				const role = element.getAttribute('role')
				const interactiveRoles = new Set([
					'button',
					'link',
					'menuitem',
					'checkbox',
					'radio',
					'tab',
					'switch',
					'textbox',
					'combobox',
				])
				if (role && interactiveRoles.has(role)) {
					return true
				}

				// Check onclick
				if (element.hasAttribute('onclick') || typeof element.onclick === 'function') {
					return true
				}

				return false
			}

			// Check if element is visible
			function isElementVisible(element) {
				const style = window.getComputedStyle(element)
				return (
					element.offsetWidth > 0 &&
					element.offsetHeight > 0 &&
					style.visibility !== 'hidden' &&
					style.display !== 'none'
				)
			}

			// Check if element is in viewport
			function isInViewport(element, expansion) {
				if (expansion === -1) return true

				const rect = element.getBoundingClientRect()
				const viewportHeight = window.innerHeight
				const viewportWidth = window.innerWidth

				return !(
					rect.bottom < -expansion ||
					rect.top > viewportHeight + expansion ||
					rect.right < -expansion ||
					rect.left > viewportWidth + expansion
				)
			}

			// Check if element is topmost
			function isTopElement(element, expansion) {
				if (expansion === -1) return true

				const rect = element.getBoundingClientRect()
				if (rect.width === 0 || rect.height === 0) return false

				const centerX = rect.left + rect.width / 2
				const centerY = rect.top + rect.height / 2

				const topEl = document.elementFromPoint(centerX, centerY)
				if (!topEl) return false

				let current = topEl
				while (current && current !== document.documentElement) {
					if (current === element) return true
					current = current.parentElement
				}
				return false
			}

			// Get element attributes
			function getElementAttributes(element) {
				const attrs = {}
				for (let i = 0; i < element.attributes.length; i++) {
					const attr = element.attributes[i]
					attrs[attr.name] = attr.value
				}
				if (element.tagName.toLowerCase() === 'input') {
					if (element.type === 'checkbox' || element.type === 'radio') {
						attrs.checked = element.checked ? 'true' : 'false'
					}
				}
				return attrs
			}

			// Check if element is scrollable
			function isScrollableElement(element) {
				const style = window.getComputedStyle(element)
				const overflowX = style.overflowX
				const overflowY = style.overflowY

				const scrollableX = overflowX === 'auto' || overflowX === 'scroll'
				const scrollableY = overflowY === 'auto' || overflowY === 'scroll'

				if (!scrollableX && !scrollableY) return null

				const scrollWidth = element.scrollWidth - element.clientWidth
				const scrollHeight = element.scrollHeight - element.clientHeight

				if (scrollWidth < 4 && scrollHeight < 4) return null

				return {
					top: element.scrollTop,
					right: element.scrollWidth - element.clientWidth - element.scrollLeft,
					bottom: element.scrollHeight - element.clientHeight - element.scrollTop,
					left: element.scrollLeft,
				}
			}

			// Build DOM tree recursively
			function buildDomTree(node) {
				if (!node || node.nodeType !== Node.ELEMENT_NODE) {
					return null
				}

				const element = node

				// Skip script, style, etc.
				const tagName = element.tagName.toLowerCase()
				const skipTags = new Set(['script', 'style', 'link', 'meta', 'noscript', 'template'])
				if (skipTags.has(tagName)) {
					return null
				}

				const nodeData = {
					tagName,
					attributes: {},
					children: [],
				}

				// Check visibility and interactivity
				if (isElementVisible(element)) {
					nodeData.isVisible = true
					nodeData.isTopElement = isTopElement(element, viewportExpansion)
					nodeData.isInViewport = isInViewport(element, viewportExpansion)

					if (nodeData.isTopElement && isInteractiveElement(element)) {
						nodeData.isInteractive = true
						if (nodeData.isInViewport || viewportExpansion === -1) {
							nodeData.highlightIndex = highlightIndex
							nodeData.attributes = getElementAttributes(element)
							// Mark element with unique attribute
							element.setAttribute('data-pw-agent-index', highlightIndex.toString())
							highlightIndex++
						}
					}
				}

				// Check scrollability
				const scrollData = isScrollableElement(element)
				if (scrollData) {
					nodeData.extra = {
						scrollable: true,
						scrollData,
					}
				}

				// Process children
				for (let i = 0; i < element.childNodes.length; i++) {
					const child = element.childNodes[i]
					if (child.nodeType === Node.TEXT_NODE) {
						const textContent = child.textContent ? child.textContent.trim() : ''
						if (textContent) {
							const textId = String(ID.current++)
							DOM_HASH_MAP[textId] = {
								type: 'TEXT_NODE',
								text: textContent,
								isVisible: true,
							}
							nodeData.children.push(textId)
						}
					} else if (child.nodeType === Node.ELEMENT_NODE) {
						const childId = buildDomTree(child)
						if (childId) {
							nodeData.children.push(childId)
						}
					}
				}

				const id = String(ID.current++)
				DOM_HASH_MAP[id] = nodeData
				return id
			}

			// Start from body
			const rootId = buildDomTree(document.body)

			return {
				rootId: rootId || '0',
				map: DOM_HASH_MAP,
			}
	}({ viewportExpansion: ${viewportExpansion} })`;
	
	// Evaluate the string code directly
	const markedElements = await page.evaluate(evaluateCode) as FlatDomTree

	// Now create locators for interactive elements
	const flatTreeData = markedElements
	for (const [nodeId, nodeData] of Object.entries(flatTreeData.map)) {
		const data = nodeData as any
		if (data.isInteractive && typeof data.highlightIndex === 'number') {
			// Create locator using the data attribute we just added
			const locator = page.locator(`[data-pw-agent-index="${data.highlightIndex}"]`)

			const interactiveNode: InteractiveElementDomNode = {
				tagName: data.tagName,
				attributes: data.attributes,
				children: data.children,
				isVisible: data.isVisible,
				isTopElement: data.isTopElement,
				isInViewport: data.isInViewport,
				isInteractive: true,
				highlightIndex: data.highlightIndex,
				locator: locator,
				extra: data.extra,
			}

			flatTreeData.map[nodeId] = interactiveNode
		}
	}

	return flatTreeData as FlatDomTree
}
