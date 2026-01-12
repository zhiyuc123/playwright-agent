# Playwright Agent

Playwright version of [page-agent](https://github.com/alibaba/page-agent) - AI agent for browser automation using Playwright.

## Features

- **HTML Dehydration**: Extracts and simplifies page elements for LLM consumption
- **Natural Language Interface**: Uses LLM to understand and execute tasks
- **Playwright Integration**: Uses Playwright API for reliable browser automation
- **Element Indexing**: Interactive elements are indexed for easy reference

## Installation

```bash
npm install playwright-agent
```

## Quick Start

### 1. Install Dependencies

```bash
cd playwright-agent
npm install

# Install Playwright browsers
npx playwright install
```

### 2. Configure Environment Variables

Copy the example environment file and edit it:

```bash
cp env.example .env
```

Edit the `.env` file and set your API Key:

```env
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1  # Optional
OPENAI_MODEL=gpt-5-mini  # Optional, defaults to gpt-5-mini
```

Or use simplified variable names:
```env
API_KEY=your-api-key-here
BASE_URL=https://api.openai.com/v1
MODEL=gpt-5-mini
```

### 3. Run Tests

```bash
# Basic test (no API key required)
npm test

# Full test (requires API key, read from .env file)
npm test
```

## Usage

### Basic Example

```typescript
import 'dotenv/config'
import { chromium } from 'playwright'
import { PlaywrightAgent } from 'playwright-agent'

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  
  await page.goto('https://example.com')
  
  const agent = new PlaywrightAgent({
    page,
    model: process.env.OPENAI_MODEL || process.env.MODEL || 'gpt-4',
    apiKey: process.env.OPENAI_API_KEY || process.env.API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL || process.env.BASE_URL,
  })
  
  const result = await agent.execute('Click the login button and fill in the form')
  
  console.log('Task completed:', result.success)
  console.log('Result:', result.data)
  
  agent.dispose()
  await browser.close()
}
```

### Run Tests

```bash
# Basic test (no API key required)
npm test

# Full test (requires API key from .env file)
npm test
```

> All scripts automatically load environment variables from the `.env` file, no need to manually `export`

## Configuration

See `src/config/index.ts` for available configuration options.

## Architecture

- **PlaywrightAgent**: Main agent class that orchestrates task execution
- **PlaywrightController**: Manages DOM operations and element interactions
- **Tools**: Set of actions available to the agent (click, input, scroll, etc.)
- **DOM Extraction**: Extracts and simplifies page structure for LLM

## Differences from page-agent

1. **Environment**: Node.js vs Browser
2. **DOM Access**: Playwright API vs Direct DOM API
3. **UI Components**: No UI (Node.js) vs Panel/Mask (Browser)
4. **Element References**: `Locator` vs `HTMLElement`
