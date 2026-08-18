import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';
import { getYaesuScopeHelperPath } from '../../server/yaesuScope.ts';
import { startDummyRigctld, type DummyRigctld } from '../fixtures/rigctld-dummy.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

async function canvasFingerprint(canvas: import('@playwright/test').Locator): Promise<number> {
  return canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d')!;
    const { data } = ctx.getImageData(0, 0, el.width, el.height);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    return sum;
  });
}

// Requires a physical Yaesu FT-710 connected via USB with SCU-LAN10: ON
// (see CLAUDE.md's "Spectrum Scope" section) and libft4222 installed on
// this host (see the wiki's FT-710 Spectrum Scope Setup page:
// https://github.com/jbdubbs/Rig-Control-Web/wiki/Spectrum-Scope-FT-710).
// This cannot be faked/mocked meaningfully — the point of this test is
// verifying the real libft4222/USB/NDJSON-parsing chain end-to-end, per
// the FT4222 spectrum scope's decision to test against real hardware
// rather than inject
// synthetic frames the way the Hamlib UDP path does. Deliberately excluded
// from `test:e2e`/CI (no FT-710 on any CI runner) — run manually, locally,
// before tagging a release, with the radio connected.
test.describe('SpectrumHamlibPanel (FT-710 / FT4222) against real hardware', () => {
  let dummy: DummyRigctld;

  test.beforeAll(async () => {
    const binaryPath = getYaesuScopeHelperPath(REPO_ROOT);
    if (!fs.existsSync(binaryPath)) {
      throw new Error(
        `ft4222-scope-reader binary not found at ${binaryPath}. Run 'npm run build:ft4222-reader' before this suite.`,
      );
    }
    // Dummy rigctld here only satisfies the panel's `connected` gate —
    // FT4222 spectrum data itself flows independently of the rigctld
    // connection, straight from the USB-SPI bridge to the real FT-710.
    dummy = await startDummyRigctld(REPO_ROOT);
  });

  test.afterAll(async () => {
    await dummy.stop();
  });

  test('reads live spectrum frames from the FT-710 over USB', async ({ page }) => {
    await page.goto('/');

    await page.getByTitle('Rigctld Settings').click();
    await page
      .locator('div.space-y-1:has(label:text-is("Host Address")) input')
      .fill('127.0.0.1');
    await page
      .locator('div.space-y-1:has(label:text-is("Port")) input[type="number"]')
      .fill(String(dummy.port));
    await page.locator('button:has(svg.lucide-x)').click();
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Disconnect', exact: true })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByTitle('Spectrum scope settings').click();
    await page.getByRole('button', { name: 'FT-710 via USB', exact: true }).click();
    const enableToggle = page
      .locator('div.flex.items-center.justify-between', { hasText: 'Enable Spectrum Scope' })
      .getByRole('button');
    // Source switch above already persists via save-settings; only toggle
    // Enable if it isn't already on from a previous run's saved settings.
    const alreadyEnabled = await enableToggle.evaluate((el) =>
      el.classList.contains('bg-emerald-500'),
    );
    if (!alreadyEnabled) await enableToggle.click();

    // Fail fast with a clear message rather than hang waiting for canvas
    // frames that will never arrive if the reader can't open the device
    // (no FT-710 attached, or libft4222 missing/misconfigured).
    const readerRunning = page.getByText('Reader running', { exact: true });
    const readerStopped = page.getByText('Reader stopped', { exact: true });
    await expect(readerRunning.or(readerStopped)).toBeVisible({ timeout: 10_000 });
    if (!(await readerRunning.isVisible())) {
      const errorDetail = await page
        .locator('div.text-red-400')
        .textContent()
        .catch(() => null);
      throw new Error(
        'FT4222 reader is not running — is the FT-710 connected via USB with SCU-LAN10 ' +
          `enabled, and is libft4222 installed? Reported error: ${errorDetail ?? '(none reported)'}`,
      );
    }

    await page.locator('button:has(svg.lucide-x)').click();

    const panel = page.locator(
      'xpath=//span[normalize-space(text())="Spectrum Scope"]/ancestor::div[contains(@class,"rounded-xl")][1]',
    );
    const spectrumCanvas = panel.locator('canvas').first();
    await expect(spectrumCanvas).toBeVisible();

    // Real hardware streams continuously — a few seconds is enough to see
    // the canvas change across at least one real frame.
    const baseline = await canvasFingerprint(spectrumCanvas);
    await expect(async () => {
      expect(await canvasFingerprint(spectrumCanvas)).not.toBe(baseline);
    }).toPass({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeVisible({
      timeout: 5_000,
    });
  });
});
