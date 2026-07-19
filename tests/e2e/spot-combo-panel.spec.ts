import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect, type Page } from '@playwright/test';
import { startDummyRigctld, type DummyRigctld } from '../fixtures/rigctld-dummy.ts';
import { connectToDummy, disconnectFromDummy } from './connect-helper.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

// SpotComboPanel ("spots_combo") is in DEFAULT_COMPACT_LAYOUT (useLayoutConfig.ts)
// and POTA/SOTA/WWFF fetch-enable is derived purely from layout membership
// (App.tsx's potaEnabled/sotaEnabled/wwffEnabled), not a settings toggle — all
// three fetches fire automatically on page load with no seeding needed.

// usePotaSpots.tsx parses spotTime/timeStamp as `new Date(s + 'Z').getTime()`
// (the trailing Z is appended by the code, not present in the API's own
// format) — timestamps here must omit it too, or the 15-minute maxAge filter
// silently drops the fixture.
function isoNoZ(d: Date): string {
  return d.toISOString().slice(0, 19);
}

const now = () => new Date();

const POTA_FIXTURE = [{
  activator: 'W1ABC',
  spotTime: isoNoZ(now()),
  frequency: 14074, // kHz — displayed as frequency/1000 = "14.074"
  mode: 'FT8',
  locationDesc: 'US-CT',
  reference: 'K-1234',
  name: 'Test Park',
  spotId: 1001,
}];

const SOTA_FIXTURE = [{
  activatorCallsign: 'W2XYZ',
  timeStamp: isoNoZ(now()),
  frequency: '14.285', // MHz, string
  mode: 'SSB',
  associationCode: 'W2',
  summitCode: 'NS-001',
  id: 2001,
}];

const WWFF_FIXTURE = [{
  activator: 'W3DEF',
  spot_time: Math.floor(now().getTime() / 1000), // unix seconds
  // Deliberately not 14074/7074 kHz: those are the app's built-in default
  // VFO A/B display frequencies (14.074/7.074 MHz, standard FT8 calling
  // channels — see constants/last-vfoA/last-vfoB defaults), which would
  // make usePotaSpots.tsx's "spot matches current frequency" pinning logic
  // duplicate this row (confirmed live — an earlier version of this fixture
  // used 7074 and hit exactly that).
  frequency_khz: 5357,
  mode: 'FT8',
  reference: 'KFF-0001',
  reference_name: 'Test Forest',
  id: 3001,
}];

async function routeSpots(page: Page, opts: { pota?: unknown; sota?: unknown; wwff?: unknown } = {}) {
  await page.route('https://api.pota.app/spot/', (route) =>
    route.fulfill({ json: opts.pota ?? POTA_FIXTURE }));
  await page.route('https://api2.sota.org.uk/api/spots/-1/all', (route) =>
    route.fulfill({ json: opts.sota ?? SOTA_FIXTURE }));
  await page.route('https://spots.wwff.co/static/spots.json', (route) =>
    route.fulfill({ json: opts.wwff ?? WWFF_FIXTURE }));
}

test.describe('SpotComboPanel with mocked POTA/SOTA/WWFF feeds', () => {
  test('defaults to the POTA tab and renders the fixture spot', async ({ page }) => {
    await routeSpots(page);
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'POTA', exact: true })).toBeVisible();
    const row = page.locator('tr', { hasText: 'W1ABC' });
    await expect(row).toContainText('14.074');
    await expect(row).toContainText('FT8');
    await expect(row).toContainText('US-CT');
    await expect(row).toContainText('K-1234');
  });

  test('switches to the SOTA tab and renders the fixture spot', async ({ page }) => {
    await routeSpots(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'SOTA', exact: true }).click();
    const row = page.locator('tr', { hasText: 'W2XYZ' });
    await expect(row).toContainText('14.285');
    await expect(row).toContainText('SSB');
    await expect(row).toContainText('W2/NS-001');
  });

  test('switches to the WWFF tab and renders the fixture spot', async ({ page }) => {
    await routeSpots(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'WWFF', exact: true }).click();
    const row = page.locator('tr', { hasText: 'W3DEF' });
    await expect(row).toContainText('5.357');
    await expect(row).toContainText('FT8');
    await expect(row).toContainText('KFF-0001');
  });

  test('shows the empty state when a feed returns no spots', async ({ page }) => {
    await routeSpots(page, { pota: [] });
    await page.goto('/');

    await expect(page.getByText(/No POTA spots in the last \d+ min/)).toBeVisible();
  });

  test('tune-to-spot round-trips a real frequency change against Dummy rigctld', async ({ page }) => {
    const dummy: DummyRigctld = await startDummyRigctld(REPO_ROOT);
    try {
      await routeSpots(page);
      await page.goto('/');
      await connectToDummy(page, dummy);

      await page.getByRole('button', { name: '14.074', exact: true }).click();
      // Round trip: tune-to-spot -> "F 14074000" -> rigctld -> Dummy -> "f"
      // re-read -> rig-status -> VFO frequency input re-renders.
      const freqInput = page.getByTitle('Click to edit frequency');
      await expect(freqInput).toHaveValue('14.074000', { timeout: 10_000 });

      await disconnectFromDummy(page);
    } finally {
      await dummy.stop();
    }
  });
});
