import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    globals: false,
    // Проверки генератора и ESLint загружают большие графы зависимостей; ограничиваем нагрузку на память.
    fileParallelism: false,
    typecheck: {
      enabled: true,
      include: ['test/**/*.test-d.ts'],
    },
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
