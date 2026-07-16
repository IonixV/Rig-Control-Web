import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Default environment is jsdom (for src/**/*.test.tsx component/hook tests).
// Server-side test files that don't need a DOM should override with a
// `// @vitest-environment node` comment at the top of the file.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/unit/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts', 'tests/**/*.test.ts'],
    },
  }),
);
