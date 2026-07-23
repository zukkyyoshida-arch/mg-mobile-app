import { defineConfig } from 'vite';

// Vitest 用の設定。tests/e2e (Playwright 専用) は対象外にする。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
