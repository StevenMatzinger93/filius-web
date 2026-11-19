import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/engine/**/*.test.ts', 'tests/scenarios/**/*.test.ts', 'tests/unit/**/*.test.{ts,tsx}'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts', 'src/io/**/*.ts', 'src/store/**/*.ts'],
      exclude: ['src/io/storage.ts', 'src/io/file.ts'],
      thresholds: {
        'src/engine/**/*.ts': { statements: 80, branches: 80, functions: 80, lines: 80 },
      },
    },
  },
});
