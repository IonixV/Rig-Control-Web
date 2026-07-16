import fs from 'fs';
import { AUTH_STATE_PATH } from '../../playwright.hardware.config.ts';

export default async function globalTeardown() {
  fs.rmSync(AUTH_STATE_PATH, { force: true });
}
