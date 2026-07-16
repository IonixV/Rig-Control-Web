import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Runs exactly once, in its own process, before `playwright test` starts.
// playwright.config.ts is imported multiple times per run (main process +
// each worker process) — doing this wipe at config-module scope instead
// would re-run it mid-test, deleting the live server's just-seeded
// users.json/settings.json out from under it.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../.rcw-test-data');
const authDir = path.resolve(__dirname, '../.auth');

fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });
fs.rmSync(authDir, { recursive: true, force: true });
fs.mkdirSync(authDir, { recursive: true });
