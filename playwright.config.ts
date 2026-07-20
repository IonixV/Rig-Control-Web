import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, devices } from '@playwright/test';
import { SOLAR_FIXTURE_HAMQSL_URL, SOLAR_FIXTURE_KC2G_URL } from './tests/fixtures/solar-fixture-server.ts';
import { ensureFakeVideoFixture } from './tests/fixtures/fake-video.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Generated once (if missing) at config-eval time so its path is stable for
// the video-fake-device project's launchOptions.args below. Lives next to
// the other e2e scratch state — see RCW_TEST_DATA_DIR.
const FAKE_VIDEO_PATH = ensureFakeVideoFixture(
  path.resolve(__dirname, 'tests/.rcw-test-data/fake-video.y4m'),
);

// Isolated scratch data dir for the server under test (settings.json, TLS
// certs, users.json) — see server.ts's RCW_DATA_DIR override. Keeps e2e runs
// from touching a developer's real local settings/login state.
//
// NOTE: this file is loaded multiple times per run (main process + each
// worker process), so it must never contain destructive side effects at
// module scope — a wipe here would re-run mid-test and delete the live
// server's just-seeded users.json/settings.json out from under it. The
// one-time wipe lives in tests/e2e/reset-test-data.mjs, run once via the
// test:e2e npm script before `playwright test` starts.
export const RCW_TEST_DATA_DIR = path.resolve(__dirname, 'tests/.rcw-test-data');
export const AUTH_STATE_PATH = path.resolve(__dirname, 'tests/.auth/state.json');

// Deliberately NOT the app's default port 3000 — a real dev/production
// instance (potentially controlling a real, currently-connected radio) may
// already be running there. Tests must never attach to that; they always
// get their own dedicated instance on a dedicated port (see server.ts's
// RCW_PORT override) and reuseExistingServer is always false below.
export const TEST_PORT = 3177;
export const BASE_URL = `https://localhost:${TEST_PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  // All specs share a single server process (one webServer instance) which
  // in turn owns a single rig connection (ctx.rigSocket) — the app doesn't
  // support more than one active rig connection at a time. Running spec
  // files across multiple workers lets two tests fight over that one
  // connection concurrently, so this suite must always run single-worker.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',

  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    storageState: AUTH_STATE_PATH,
    trace: 'retain-on-failure',
  },

  // Chromium only: the app's real target renderer is Electron/Chromium, and
  // this is a pilot suite — Firefox/WebKit coverage isn't worth the extra
  // cost until the pattern proves out across more panels.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/video-feed-panel.spec.ts'],
    },
    // video-feed-panel.spec.ts needs a fake camera device — Chromium only
    // applies --use-fake-device-for-media-stream etc. at browser-launch
    // scope, not per-test, so this spec gets its own project rather than
    // sharing launchOptions.args with every other spec in the suite.
    {
      name: 'video-fake-device',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['camera', 'microphone'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            `--use-file-for-fake-video-capture=${FAKE_VIDEO_PATH}`,
          ],
        },
      },
      testMatch: ['**/video-feed-panel.spec.ts'],
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    ignoreHTTPSErrors: true,
    // Always spawn a fresh, isolated instance — never attach to a server
    // that happens to already be listening (that could be a real, in-use
    // instance, potentially controlling real radio hardware).
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      ...process.env,
      RCW_DATA_DIR: RCW_TEST_DATA_DIR,
      RCW_PORT: String(TEST_PORT),
      RCW_SOLAR_HAMQSL_URL: SOLAR_FIXTURE_HAMQSL_URL,
      RCW_SOLAR_KC2G_URL: SOLAR_FIXTURE_KC2G_URL,
    },
  },
});
