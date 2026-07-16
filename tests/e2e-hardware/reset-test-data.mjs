import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Mirrors tests/e2e/reset-test-data.mjs but for the hardware suite's own
// isolated scratch dirs — see that file's comment for why this must run
// once, in its own process, before playwright.hardware.config.ts loads.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../.rcw-test-data-hardware');
const authDir = path.resolve(__dirname, '../.auth-hardware');

fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });
fs.rmSync(authDir, { recursive: true, force: true });
fs.mkdirSync(authDir, { recursive: true });
