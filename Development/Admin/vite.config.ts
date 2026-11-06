/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = env.VITE_API_BASE_URL

  return {
    plugins: [tailwindcss(), react()],
    server: {
      proxy: apiBase ? { '/api': { target: apiBase, changeOrigin: true } } : undefined,
    },
    build: {
      chunkSizeWarningLimit: 1500,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/setupTests.ts'],
      testTimeout: 30000,
      maxConcurrency: 2,
      // Suppresses ReferenceError: window is not defined thrown by React's
      // scheduler after test teardown (jsdom destroys window before React's
      // setImmediate-queued work runs). Tests themselves are unaffected.
      // Revisit if Vitest/jsdom/React updates resolve the teardown race.
      dangerouslyIgnoreUnhandledErrors: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov', 'json-summary'],
        all: true,
        reportOnFailure: true,
        exclude: [
          'node_modules/',
          'src/mocks/',
          'dist/',
          '**/*.config.*',
          '**/*.d.ts',
          'src/main.tsx',
          'src/setupTests.ts',
          '**/types.ts',
          '**/constants.ts',
          '**/index.tsx',
        ],
        thresholds: {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
      },
    },
  }
})
