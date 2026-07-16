import { chromium } from '@playwright/test';
import { AUTH_STATE_PATH, BASE_URL } from '../../playwright.config.ts';

/**
 * Logs in once as the freshly-seeded default ADMIN user (see server/auth.ts
 * — a fresh RCW_DATA_DIR has no users.json, so ADMIN/admin is created with
 * mustChangePassword: true), completes the forced password change, and
 * saves the resulting authenticated storageState for every test to reuse.
 */
export default async function globalSetup() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await page.goto(BASE_URL);

  await page.getByPlaceholder('W1ABC').fill('ADMIN');
  await page.locator('input[type="password"]').fill('admin');
  await page.getByRole('button', { name: /sign in/i }).click();

  // Freshly-seeded ADMIN account is forced through a password change —
  // wait for that screen's own button before touching its inputs, so we
  // don't race the still-visible login screen's password field.
  const saveButton = page.getByRole('button', { name: /save password/i });
  await saveButton.waitFor({ state: 'visible' });
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.nth(0).fill('admin');
  await passwordInputs.nth(1).fill('TestHarness123!');
  await passwordInputs.nth(2).fill('TestHarness123!');
  await saveButton.click();

  // Main app shell has loaded once the login/password-change screens are gone.
  await page.getByPlaceholder('W1ABC').waitFor({ state: 'detached' }).catch(() => {});
  await page.waitForLoadState('networkidle');

  await context.storageState({ path: AUTH_STATE_PATH });
  await browser.close();
}
