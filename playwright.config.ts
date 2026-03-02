import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  webServer: {
    command: 'npm run dev',
    env: { ...process.env, PORT: '3001' },
    port: 3001,
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: 'http://localhost:3001' },
})
