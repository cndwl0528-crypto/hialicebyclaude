/**
 * vitest.config.js
 * HiAlice Backend — Vitest Test Runner Configuration
 *
 * ESM-native project (package.json "type":"module") so no transform needed.
 * Tests live in src/__tests__/ and follow the *.test.js convention.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use node environment — no DOM needed for backend unit tests.
    environment: 'node',

    // Glob patterns for test discovery.
    include: ['src/__tests__/**/*.test.js'],

    // Coverage settings (used when running `vitest run --coverage`).
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/__tests__/**', 'src/index.js'],
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },

    // Report format: verbose shows each test name individually.
    reporter: 'verbose',

    // Global test timeout (ms). Prompt tests are pure string ops — fast.
    testTimeout: 10000,

    // Sequentially run test files to keep deterministic output.
    // Switch to pool:'threads' if parallelism is needed in CI.
    pool: 'forks',
  },
});
