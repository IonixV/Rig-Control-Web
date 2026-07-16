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
      // NOTE: deliberately does not include tests/fixtures/**/*.test.ts —
      // those spawn a real rigctld process / send real UDP packets to
      // sanity-check the e2e fixtures themselves (already exercised at the
      // e2e layer by tests/e2e/vfo-panel.spec.ts and
      // spectrum-hamlib-panel.spec.ts), not pure logic. Vitest applies
      // `include` even to explicitly-named files on the CLI, so there's no
      // way to run them ad hoc against this config — use
      // `npm run test:fixtures` (vitest.fixtures.config.ts) instead.
      include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    },
  }),
);
