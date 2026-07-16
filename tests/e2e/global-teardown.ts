import fs from 'fs';
import { AUTH_STATE_PATH } from '../../playwright.config.ts';

// RCW_TEST_DATA_DIR itself is wiped at the start of the *next* run (see
// playwright.config.ts) rather than here, so a failed run's state is left
// on disk for debugging. This just drops the saved auth session so a stale
// token can never leak into a subsequent run.
export default async function globalTeardown() {
  fs.rmSync(AUTH_STATE_PATH, { force: true });
}
