import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    // de rules-test heeft de Firestore-emulator nodig: npm run test:rules
    exclude: ['**/node_modules/**', '**/*.rules.test.ts'],
  },
})
