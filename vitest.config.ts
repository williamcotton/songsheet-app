import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        test: {
          name: 'jsdom',
          include: ['test/**/*.test.ts'],
          exclude: ['test/server/**'],
          environment: 'jsdom',
          server: { deps: { inline: ['songsheet'] } },
        },
      },
      {
        test: {
          name: 'node',
          include: ['test/server/**/*.test.ts'],
          environment: 'node',
          server: { deps: { inline: ['songsheet'] } },
        },
      },
    ],
  },
  server: { fs: { allow: ['..'] } },
})
