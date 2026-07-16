import { chromium } from '@playwright/test';
import { AUTH_STATE_PATH, BASE_URL } from '../../playwright.hardware.config.ts';

// Mirrors tests/e2e/global-setup.ts against this suite's own isolated
// server instance/port — see that file for the rationale of each step.
export default async function globalSetup() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await page.goto(BASE_URL);

  await page.getByPlaceholder('W1ABC').fill('ADMIN');
  await page.locator('input[type="password"]').fill('admin');
  await page.getByRole('button', { name: /sign in/i }).click();

  const saveButton = page.getByRole('button', { name: /save password/i });
  await saveButton.waitFor({ state: 'visible' });
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.nth(0).fill('admin');
  await passwordInputs.nth(1).fill('TestHarness123!');
  await passwordInputs.nth(2).fill('TestHarness123!');
  await saveButton.click();

  await page.getByPlaceholder('W1ABC').waitFor({ state: 'detached' }).catch(() => {});
  await page.waitForLoadState('networkidle');

  await context.storageState({ path: AUTH_STATE_PATH });
  await browser.close();
}
