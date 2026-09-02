import { defineConfig } from 'vitest/config'

// Aparte config: de rules-test praat met de Firestore-emulator (node, geen DOM)
// en draait daarom niet mee in `npm test`. Zie `npm run test:rules`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.rules.test.ts'],
    testTimeout: 15000,
  },
})
