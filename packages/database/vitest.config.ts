import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // Cada arquivo sobe um Postgres em WASM; limitar o paralelismo evita picos de memória.
    maxWorkers: 2,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
