# Playwright Agent

[page-agent](https://github.com/alibaba/page-agent) 的 Playwright 版本 - 使用 Playwright 进行浏览器自动化的 AI 智能体。

## 特性

- **HTML 脱水处理**：提取并简化页面元素，供 LLM 使用
- **自然语言接口**：使用 LLM 理解和执行任务
- **Playwright 集成**：使用 Playwright API 实现可靠的浏览器自动化
- **元素索引**：交互式元素被索引以便于引用

## 安装

```bash
npm install playwright-agent
```

## 快速开始

### 1. 安装依赖

```bash
cd playwright-agent
npm install

# 安装 Playwright 浏览器
npx playwright install
```

### 2. 配置环境变量

复制示例环境变量文件并编辑：

```bash
cp env.example .env
```

编辑 `.env` 文件，设置你的 API Key：

```env
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1  # 可选
OPENAI_MODEL=gpt-5-mini  # 可选，默认 gpt-5-mini
```

或者使用简化的变量名：
```env
API_KEY=your-api-key-here
BASE_URL=https://api.openai.com/v1
MODEL=gpt-5-mini
```

### 3. 运行测试

```bash
# 基础测试（不需要 API key）
npm test

# 完整测试（需要 API key，从 .env 文件读取）
npm test
```

## 使用方法

### 基础示例

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

### 运行测试

```bash
# 基础测试（不需要 API key）
npm test

# 完整测试（需要 .env 文件中的 API key）
npm test
```

> 所有脚本会自动从 `.env` 文件加载环境变量，无需手动 `export`

## 配置

查看 `src/config/index.ts` 了解可用的配置选项。

## 架构

- **PlaywrightAgent**：编排任务执行的主智能体类
- **PlaywrightController**：管理 DOM 操作和元素交互
- **Tools**：智能体可用的操作集合（点击、输入、滚动等）
- **DOM 提取**：提取并简化页面结构供 LLM 使用

## 与 page-agent 的区别

1. **运行环境**：Node.js vs 浏览器
2. **DOM 访问**：Playwright API vs 直接 DOM API
3. **UI 组件**：无 UI（Node.js）vs 面板/遮罩（浏览器）
4. **元素引用**：`Locator` vs `HTMLElement`
