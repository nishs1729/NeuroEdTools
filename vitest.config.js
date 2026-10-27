import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',  // pure math — no DOM needed
    include: ['tests/unit/**/*.test.js'],
    reporters: ['verbose'],
    coverage: {
      reporter: ['text', 'html'],
      outputDir: 'tests/reports/coverage',
    },
  },
});
