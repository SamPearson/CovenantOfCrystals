import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  server: {
    port: 8080,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1800,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
