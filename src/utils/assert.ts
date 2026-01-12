/**
 * Assert that a condition is true, throw error if not
 */
export function assert(condition: any, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message || 'Assertion failed')
	}
}
