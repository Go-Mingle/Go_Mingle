import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

// SWC keeps NestJS decorator metadata, which Vitest's default transform drops.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
})
