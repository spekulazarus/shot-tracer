import preact from '@preact/preset-vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [preact()],
  build: {
    // iOS Safari 16.4 is the oldest engine with WebCodecs video; see docs/adr/0002.
    target: ['es2022', 'safari16.4'],
  },
  worker: {
    format: 'es',
  },
  test: {
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
    environment: 'node',
  },
})
