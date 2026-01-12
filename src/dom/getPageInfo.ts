import type { Page } from 'playwright'

export interface PageInfo {
	viewport_width: number
	viewport_height: number
	page_width: number
	page_height: number
	scroll_x: number
	scroll_y: number
	pixels_above: number
	pixels_below: number
	pages_above: number
	pages_below: number
	total_pages: number
	current_page_position: number
	pixels_left: number
	pixels_right: number
}

export async function getPageInfo(page: Page): Promise<PageInfo> {
	const viewport = page.viewportSize()
	const viewport_width = viewport?.width ?? 0
	const viewport_height = viewport?.height ?? 0

	const scrollInfo = await page.evaluate(() => {
		const page_width = Math.max(
			document.documentElement.scrollWidth,
			document.body.scrollWidth || 0
		)
		const page_height = Math.max(
			document.documentElement.scrollHeight,
			document.body.scrollHeight || 0
		)

		const scroll_x = window.scrollX || window.pageXOffset || document.documentElement.scrollLeft || 0
		const scroll_y = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0

		return {
			page_width,
			page_height,
			scroll_x,
			scroll_y,
		}
	})

	const pixels_below = Math.max(0, scrollInfo.page_height - (viewport_height + scrollInfo.scroll_y))
	const pixels_right = Math.max(0, scrollInfo.page_width - (viewport_width + scrollInfo.scroll_x))

	return {
		viewport_width,
		viewport_height,
		page_width: scrollInfo.page_width,
		page_height: scrollInfo.page_height,
		scroll_x: scrollInfo.scroll_x,
		scroll_y: scrollInfo.scroll_y,
		pixels_above: scrollInfo.scroll_y,
		pixels_below,
		pages_above: viewport_height > 0 ? scrollInfo.scroll_y / viewport_height : 0,
		pages_below: viewport_height > 0 ? pixels_below / viewport_height : 0,
		total_pages: viewport_height > 0 ? scrollInfo.page_height / viewport_height : 0,
		current_page_position:
			scrollInfo.scroll_y / Math.max(1, scrollInfo.page_height - viewport_height),
		pixels_left: scrollInfo.scroll_x,
		pixels_right,
	}
}
