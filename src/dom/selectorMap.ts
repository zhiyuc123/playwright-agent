import type { FlatDomTree, InteractiveElementDomNode } from './type'

/**
 * Get selector map from flat tree
 */
export function getSelectorMap(flatTree: FlatDomTree): Map<number, InteractiveElementDomNode> {
	const selectorMap = new Map<number, InteractiveElementDomNode>()

	const keys = Object.keys(flatTree.map)
	for (const key of keys) {
		const node = flatTree.map[key]
		if (node.isInteractive && typeof node.highlightIndex === 'number') {
			selectorMap.set(node.highlightIndex, node as InteractiveElementDomNode)
		}
	}

	return selectorMap
}
