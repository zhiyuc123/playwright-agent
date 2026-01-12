/**
 * Test file for PlaywrightAgent
 * 
 * Run with: npx tsx test.ts
 * Or: npm test
 */

import 'dotenv/config'
import { chromium } from 'playwright'
import { PlaywrightAgent } from './src/PlaywrightAgent'

async function testBasicOperations() {
	console.log('🧪 Testing PlaywrightAgent basic operations...')

	const browser = await chromium.launch({
		headless: true,
	})

	const page = await browser.newPage()

	try {
		// Test 1: Initialize agent
		console.log('\n1. Testing agent initialization...')
		const agent = new PlaywrightAgent({
			page,
			model: process.env.OPENAI_MODEL || process.env.MODEL || 'gpt-5-mini',
			apiKey: process.env.OPENAI_API_KEY || process.env.API_KEY || 'test-key',
			baseURL: process.env.OPENAI_BASE_URL || process.env.BASE_URL,
		})
		console.log('✅ Agent initialized')

		// Test 2: Navigate to page
		console.log('\n2. Testing page navigation...')
		await page.goto('https://example.com')
		console.log('✅ Page navigated')

		// Test 3: Update DOM tree
		console.log('\n3. Testing DOM tree update...')
		await agent.playwrightController.updateTree()
		const html = await agent.playwrightController.getSimplifiedHTML()
		console.log('✅ DOM tree updated')
		console.log('HTML length:', html.length)

		// Test 4: Get page info
		console.log('\n4. Testing page info...')
		const pageInfo = await agent.playwrightController.getPageInfo()
		console.log('✅ Page info retrieved')
		console.log('Viewport:', pageInfo.viewport_width, 'x', pageInfo.viewport_height)

		// Test 5: Get element count
		console.log('\n5. Testing element count...')
		const count = await agent.playwrightController.getElementCount()
		console.log('✅ Element count:', count)

		// Clean up
		agent.dispose()
		console.log('\n✅ All tests passed!')
	} catch (error) {
		console.error('❌ Test failed:', error)
		throw error
	} finally {
		await browser.close()
	}
}

async function testWithTask() {
	console.log('\n🧪 Testing PlaywrightAgent with task execution...')

	const apiKey = process.env.OPENAI_API_KEY || process.env.API_KEY
	if (!apiKey) {
		console.log('⚠️  OPENAI_API_KEY or API_KEY not set, skipping task execution test')
		return
	}

	const browser = await chromium.launch({
		headless: false,
	})

	const page = await browser.newPage()

	try {
		await page.goto('https://example.com')

		const agent = new PlaywrightAgent({
			page,
			model: process.env.OPENAI_MODEL || process.env.MODEL || 'gpt-4',
			apiKey: apiKey,
			baseURL: process.env.OPENAI_BASE_URL || process.env.BASE_URL,
		})

		console.log('\n🤖 Executing test task...')
		const result = await agent.execute('Describe what you see on this page')

		console.log('\n📊 Task Results:')
		console.log('Success:', result.success)
		console.log('Data:', result.data)
		console.log('History steps:', result.history.length)

		agent.dispose()
	} catch (error) {
		console.error('❌ Task execution test failed:', error)
		throw error
	} finally {
		await browser.close()
	}
}

async function runTests() {
	try {
		await testBasicOperations()
		await testWithTask()
		console.log('\n🎉 All tests completed!')
	} catch (error) {
		console.error('\n💥 Tests failed:', error)
		process.exit(1)
	}
}

runTests()
