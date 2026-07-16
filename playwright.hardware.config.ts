import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, devices } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Separate from the main suite's tests/.rcw-test-data — this suite is run
// manually/locally against real FT-710 hardware, never in CI, and should
// never share state (or a port, or a Dummy-rigctld instance) with the
// hardware-independent suite. See playwright.config.ts for why the
// destructive wipe lives in a one-time pre-script (tests/e2e-hardware/
// reset-test-data.mjs) rather than at this file's module scope.
export const RCW_TEST_DATA_DIR = path.resolve(__dirname, 'tests/.rcw-test-data-hardware');
export const AUTH_STATE_PATH = path.resolve(__dirname, 'tests/.auth-hardware/state.json');
export const TEST_PORT = 3178;
export const BASE_URL = `https://localhost:${TEST_PORT}`;

export default defineConfig({
  testDir: './tests/e2e-hardware',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './tests/e2e-hardware/global-setup.ts',
  globalTeardown: './tests/e2e-hardware/global-teardown.ts',

  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    storageState: AUTH_STATE_PATH,
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      ...process.env,
      RCW_DATA_DIR: RCW_TEST_DATA_DIR,
      RCW_PORT: String(TEST_PORT),
    },
  },
});
