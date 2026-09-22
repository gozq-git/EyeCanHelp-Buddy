import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    // vitest's 5s default is measured per test but competes with every other file's
    // jsdom environment running in parallel. AcknowledgementForm's submit test needs
    // ~1.5s alone and still timed out in a full-suite run here; CI runners have fewer
    // cores, so 5s flakes there too — and a failed frontend-tests job skips the Sonar
    // scan through `needs`. This ceiling only applies to hangs, not to passing tests.
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      // Written to the shared artifact folder so the reports container can serve it.
      reportsDirectory: '../reports/frontend/coverage',
      // lcov is what SonarCloud reads (sonar.javascript.lcov.reportPaths); text is
      // for the console and html for the reports container.
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/__tests__/**'],
    },
  },
})
