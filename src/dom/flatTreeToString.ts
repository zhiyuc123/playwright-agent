import type { FlatDomTree, ElementDomNode, InteractiveElementDomNode, TextDomNode } from './type'

/**
 * TreeNode for internal processing
 */
interface TreeNode {
	type: 'text' | 'element'
	parent: TreeNode | null
	children: TreeNode[]
	isVisible: boolean
	text?: string
	tagName?: string
	attributes?: Record<string, string>
	isInteractive?: boolean
	isTopElement?: boolean
	isNew?: boolean
	highlightIndex?: number
	extra?: Record<string, any>
}

/**
 * Convert flat DOM tree to simplified HTML string
 */
export function flatTreeToString(flatTree: FlatDomTree, include_attributes?: string[]): string {
	const DEFAULT_INCLUDE_ATTRIBUTES = [
		'title',
		'type',
		'checked',
		'name',
		'role',
		'value',
		'placeholder',
		'data-date-format',
		'alt',
		'aria-label',
		'aria-expanded',
		'data-state',
		'aria-checked',
		'id',
		'for',
		'target',
		'aria-haspopup',
		'aria-controls',
		'aria-owns',
	]

	const includeAttrs = [...(include_attributes || []), ...DEFAULT_INCLUDE_ATTRIBUTES]

	// Helper function to cap text length
	const capTextLength = (text: string, maxLength: number): string => {
		if (text.length > maxLength) {
			return text.substring(0, maxLength) + '...'
		}
		return text
	}

	// Build tree structure from flat map
	const buildTreeNode = (nodeId: string): TreeNode | null => {
		const node = flatTree.map[nodeId]
		if (!node) return null

		if (node.type === 'TEXT_NODE') {
			const textNode = node as TextDomNode
			return {
				type: 'text',
				text: textNode.text,
				isVisible: textNode.isVisible,
				parent: null,
				children: [],
			}
		} else {
			const elementNode = node as ElementDomNode | InteractiveElementDomNode
			const children: TreeNode[] = []

			if (elementNode.children) {
				for (const childId of elementNode.children) {
					const child = buildTreeNode(childId)
					if (child) {
						child.parent = null // Will be set later
						children.push(child)
					}
				}
			}

			return {
				type: 'element',
				tagName: elementNode.tagName,
				attributes: elementNode.attributes ?? {},
				isVisible: elementNode.isVisible ?? false,
				isInteractive: typeof elementNode.isInteractive === 'boolean' ? elementNode.isInteractive : false,
				isTopElement: typeof elementNode.isTopElement === 'boolean' ? elementNode.isTopElement : false,
				isNew: typeof elementNode.isNew === 'boolean' ? elementNode.isNew : false,
				highlightIndex: elementNode.highlightIndex,
				parent: null,
				children,
				extra: elementNode.extra ?? {},
			}
		}
	}

	// Set parent references
	const setParentReferences = (node: TreeNode, parent: TreeNode | null = null) => {
		node.parent = parent
		for (const child of node.children) {
			setParentReferences(child, node)
		}
	}

	// Build root node
	const rootNode = buildTreeNode(flatTree.rootId)
	if (!rootNode) return ''

	setParentReferences(rootNode)

	// Helper to check if text node has parent with highlight index
	const hasParentWithHighlightIndex = (node: TreeNode): boolean => {
		let current = node.parent
		while (current) {
			if (current.type === 'element' && current.highlightIndex !== undefined) {
				return true
			}
			current = current.parent
		}
		return false
	}

	// Get all text until next clickable element
	const getAllTextTillNextClickableElement = (node: TreeNode, maxDepth = -1): string => {
		const textParts: string[] = []

		const collectText = (currentNode: TreeNode, currentDepth: number) => {
			if (maxDepth !== -1 && currentDepth > maxDepth) {
				return
			}

			// Skip this branch if we hit a highlighted element (except for the current node)
			if (
				currentNode.type === 'element' &&
				currentNode !== node &&
				currentNode.highlightIndex !== undefined
			) {
				return
			}

			if (currentNode.type === 'text' && currentNode.text) {
				textParts.push(currentNode.text)
			} else if (currentNode.type === 'element') {
				for (const child of currentNode.children) {
					collectText(child, currentDepth + 1)
				}
			}
		}

		collectText(node, 0)
		return textParts.join('\n').trim()
	}

	// Main processing function
	const processNode = (node: TreeNode, depth: number, result: string[]): void => {
		let nextDepth = depth
		const depthStr = '\t'.repeat(depth)

		if (node.type === 'element') {
			// Add element with highlight_index
			if (node.highlightIndex !== undefined) {
				nextDepth += 1

				const text = getAllTextTillNextClickableElement(node)
				let attributesHtmlStr = ''

				if (includeAttrs.length > 0 && node.attributes) {
					const attributesToInclude: Record<string, string> = {}

					// Filter attributes
					for (const key of includeAttrs) {
						const value = node.attributes[key]
						if (value && value.trim() !== '') {
							attributesToInclude[key] = value.trim()
						}
					}

					// Remove duplicate values (for attributes longer than 5 chars)
					const orderedKeys = includeAttrs.filter((key) => key in attributesToInclude)
					if (orderedKeys.length > 1) {
						const keysToRemove = new Set<string>()
						const seenValues: Record<string, string> = {}

						for (const key of orderedKeys) {
							const value = attributesToInclude[key]
							if (value.length > 5) {
								if (value in seenValues) {
									keysToRemove.add(key)
								} else {
									seenValues[value] = key
								}
							}
						}

						for (const key of keysToRemove) {
							delete attributesToInclude[key]
						}
					}

					// Remove role if it matches tagName
					if (attributesToInclude.role === node.tagName) {
						delete attributesToInclude.role
					}

					// Remove attributes that duplicate text content
					const attrsToRemoveIfTextMatches = ['aria-label', 'placeholder', 'title']
					for (const attr of attrsToRemoveIfTextMatches) {
						if (
							attributesToInclude[attr] &&
							attributesToInclude[attr].toLowerCase().trim() === text.toLowerCase().trim()
						) {
							delete attributesToInclude[attr]
						}
					}

					if (Object.keys(attributesToInclude).length > 0) {
						attributesHtmlStr = Object.entries(attributesToInclude)
							.map(([key, value]) => `${key}=${capTextLength(value, 20)}`)
							.join(' ')
					}
				}

				// Build the line
				const highlightIndicator = node.isNew ? `*[${node.highlightIndex}]` : `[${node.highlightIndex}]`
				let line = `${depthStr}${highlightIndicator}<${node.tagName ?? ''}`

				if (attributesHtmlStr) {
					line += ` ${attributesHtmlStr}`
				}

				// Add scrollable data
				if (node.extra) {
					if (node.extra.scrollable) {
						let scrollDataText = ''
						if (node.extra.scrollData?.left) scrollDataText += `left=${node.extra.scrollData.left}, `
						if (node.extra.scrollData?.top) scrollDataText += `top=${node.extra.scrollData.top}, `
						if (node.extra.scrollData?.right)
							scrollDataText += `right=${node.extra.scrollData.right}, `
						if (node.extra.scrollData?.bottom)
							scrollDataText += `bottom=${node.extra.scrollData.bottom}`

						line += ` data-scrollable="${scrollDataText}"`
					}
				}

				if (text) {
					const trimmedText = text.trim()
					if (!attributesHtmlStr) {
						line += ' '
					}
					line += `>${trimmedText}`
				} else if (!attributesHtmlStr) {
					line += ' '
				}

				line += ' />'
				result.push(line)
			}

			// Process children regardless
			for (const child of node.children) {
				processNode(child, nextDepth, result)
			}
		} else if (node.type === 'text') {
			// Add text only if it doesn't have a highlighted parent
			if (hasParentWithHighlightIndex(node)) {
				return
			}

			if (
				node.parent &&
				node.parent.type === 'element' &&
				node.parent.isVisible &&
				node.parent.isTopElement
			) {
				result.push(`${depthStr}${node.text ?? ''}`)
			}
		}
	}

	const result: string[] = []
	processNode(rootNode, 0, result)
	return result.join('\n')
}

/**
 * Get element text map from simplified HTML
 */
export function getElementTextMap(simplifiedHTML: string): Map<number, string> {
	const lines = simplifiedHTML
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
	const elementTextMap = new Map<number, string>()
	for (const line of lines) {
		const regex = /^\[(\d+)\]<[^>]+>([^<]*)/
		const match = regex.exec(line)
		if (match) {
			const index = parseInt(match[1], 10)
			elementTextMap.set(index, line)
		}
	}

	return elementTextMap
}
