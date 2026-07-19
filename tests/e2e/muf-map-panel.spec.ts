import { test, expect, type Page } from '@playwright/test';

// MufMapPanel ("mufmap") is in DEFAULT_COMPACT_LAYOUT (useLayoutConfig.ts) —
// no layout seeding needed. It's a bare <img src="https://prop.kc2g.com/
// renders/current/${metric}-normal-${timeSlot}.svg?v=${refreshKey}">
// (MufMapPanel.tsx), so page.route() intercepts it like any resource load.
//
// Determinism: the panel caches its refreshKey/lastRefreshed in localStorage
// (key "mufmap-view-v1" — confirmed, like Tier 3's "grid-layout-v1" finding,
// this is never callsign-namespaced in practice since callsign is still ""
// at the hook's first render) for up to 1 hour (CACHE_MS) across
// collapse/expand remounts. A fresh test context has no such key, so
// refreshKey defaults to a fresh Date.now() each run — no explicit clearing
// needed.

const CANNED_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="blue"/></svg>';

async function routeMufMap(page: Page, opts: { fail?: boolean } = {}) {
  await page.route('**/prop.kc2g.com/renders/current/**', (route) => {
    if (opts.fail) {
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({ body: CANNED_SVG, contentType: 'image/svg+xml' });
  });
}

// MufMapPanel is collapsed by default in the compact layout
// (isCompactMufMapCollapsed defaults to true, usePanelState.ts) — its body,
// including the <img>, isn't in the DOM at all until expanded (PanelChrome
// only renders children when !isCollapsed). Walk up from the "MUF Map"
// header title span to the shared header <div> (its grandparent) that also
// contains the chevron button, to avoid ambiguity with other panels'
// identically-titled "Expand" buttons elsewhere on the page.
async function expandMufMapPanel(page: Page) {
  await page.getByText('MUF Map', { exact: true }).locator('xpath=../..').getByTitle('Expand').click();
}

test.describe('MufMapPanel with a mocked prop.kc2g.com feed', () => {
  test('loads the default MUFD/Now map with no error', async ({ page }) => {
    await routeMufMap(page);
    await page.goto('/');
    await expandMufMapPanel(page);

    const img = page.getByAltText('MUFD world map');
    await expect(img).toBeVisible();
    await expect(page.getByText('Map unavailable — check connection')).not.toBeVisible();
  });

  test('switching metric to foF2 requests the foF2 image', async ({ page }) => {
    await routeMufMap(page);
    await page.goto('/');
    await expandMufMapPanel(page);
    await expect(page.getByAltText('MUFD world map')).toBeVisible();

    await page.getByRole('button', { name: 'foF2', exact: true }).click();
    const img = page.getByAltText('foF2 world map');
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute('src', /fof2-normal-now\.svg/);
  });

  test('switching time slot to -1h requests the -1h image', async ({ page }) => {
    await routeMufMap(page);
    await page.goto('/');
    await expandMufMapPanel(page);
    const img = page.getByAltText('MUFD world map');
    await expect(img).toBeVisible();

    await page.getByRole('button', { name: '−1h', exact: true }).click();
    await expect(img).toHaveAttribute('src', /mufd-normal-1h\.svg/);
  });

  test('shows an error state when the map fails to load', async ({ page }) => {
    await routeMufMap(page, { fail: true });
    await page.goto('/');
    await expandMufMapPanel(page);

    await expect(page.getByText('Map unavailable — check connection')).toBeVisible({ timeout: 10_000 });
  });
});
