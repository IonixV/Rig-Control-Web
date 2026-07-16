import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Separate from vitest.config.ts (which deliberately excludes these) — for
// manually/locally sanity-checking the e2e fixtures themselves (they spawn
// a real rigctld process / send real UDP packets), not part of `npm test`
// or CI. Run via `npm run test:fixtures`. Each fixture test file already
// carries its own `// @vitest-environment node` docblock, so this config
// doesn't need to set one.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['tests/fixtures/**/*.test.ts'],
    },
  }),
);
