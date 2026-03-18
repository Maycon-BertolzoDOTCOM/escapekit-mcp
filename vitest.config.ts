import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    reporter: ['json', 'verbose'],
    outputFile: {
      json: 'vitest-results.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types/',
      ],
    },
  },
});