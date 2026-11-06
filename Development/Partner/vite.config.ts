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
    // amazon-cognito-identity-js depends on buffer@4.9.2, whose index.js reads
    // bare `global` at module top level. In a browser that is a ReferenceError
    // thrown the moment the SDK is imported — so login failed before issuing a
    // single network request. Vite does not shim Node globals, so map it
    // explicitly.
    define: {
      global: 'globalThis',
    },
    // `define` above only reaches code Vite transforms. In dev, node_modules are
    // pre-bundled separately by esbuild, which does not inherit it — so the
    // shim applied to production builds but not to `vite dev`, and login broke
    // on localhost while the built bundle was fine. Both need it.
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
    },
    server: {
      proxy: apiBase ? { '/api': { target: apiBase, changeOrigin: true } } : undefined,
    },
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          // Carve the stable React framework into its own chunk so it caches
          // independently across app deploys. React is always eager (the root
          // needs it), so this adds no first-paint bytes. Everything else is
          // left to Vite's automatic per-route splitting — crucially so heavy,
          // optional AntD deps (date-picker, etc.) stay lazy instead of being
          // pulled into an eager vendor bundle.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return
            if (/\/(react|react-dom|scheduler|react-router|react-i18next)\//.test(id))
              return 'react-vendor'
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/setupTests.ts'],
      // Vitest loads .env files, so without this a developer's local .env —
      // real Cognito pool ids, a real API host — would change which auth
      // provider the suite resolves and which requests MSW intercepts. Pin the
      // values that steer that wiring so the suite is hermetic.
      env: {
        VITE_COGNITO_PARTNERS_POOL_ID: '',
        VITE_COGNITO_PARTNERS_CLIENT_ID: '',
        VITE_ENABLE_MOCKS: 'true',
        VITE_API_BASE_URL: '',
        // Pinned so a local .env (e.g. VITE_AUTH_MODE=api for the backend) cannot
        // switch the suite's auth provider or demo-credentials banner.
        VITE_AUTH_MODE: '',
        VITE_SHOW_DEMO_CREDENTIALS: '',
        // Pinned empty so a developer with a real key in .env cannot make the
        // suite try to load the Maps SDK in jsdom.
        VITE_GOOGLE_MAPS_API_KEY: '',
      },
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
        // Matches the GoMingle Admin Portal quality bar.
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
