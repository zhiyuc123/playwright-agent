// @ts-check
import chalk from 'chalk'
import { dirname, resolve } from 'path'
import dts from 'unplugin-dts/vite'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

console.log(chalk.cyan(`📦 Building playwright-agent`))

export default defineConfig({
	clearScreen: false,
	plugins: [dts({ tsconfigPath: './tsconfig.dts.json', bundleTypes: true })],
	publicDir: false,
	esbuild: {
		keepNames: true,
	},
	build: {
		lib: {
			entry: resolve(__dirname, 'src/PlaywrightAgent.ts'),
			name: 'PlaywrightAgent',
			fileName: 'playwright-agent',
			formats: ['es'],
		},
		outDir: resolve(__dirname, 'dist', 'esm'),
		rollupOptions: {
			external: ['@page-agent/*', 'playwright'],
		},
		minify: false,
		sourcemap: true,
	},
	define: {
		'process.env.NODE_ENV': '"production"',
	},
})
