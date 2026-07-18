import { expect, type Page } from '@playwright/test';
import type { DummyRigctld } from '../fixtures/rigctld-dummy.ts';

/** Points the app's Settings modal at a running Dummy rigctld and connects,
 *  via the real UI — the same boilerplate every rig-status e2e spec repeats. */
export async function connectToDummy(page: Page, dummy: DummyRigctld): Promise<void> {
  await page.getByTitle('Rigctld Settings').click();
  // Scoped by label text: the modal also has a "Listen Address" field
  // (rigctld's own bind address) with the same 127.0.0.1 placeholder.
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
}

/** Disconnects cleanly before the Dummy rigctld process is stopped in
 *  afterAll — all e2e specs share one server process for the run, and an
 *  abrupt process kill while still "connected" reads as an unexpected drop,
 *  triggering the server's 5s auto-reconnect loop against a port that no
 *  longer exists and interfering with whichever spec runs next. */
export async function disconnectFromDummy(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeVisible({
    timeout: 5_000,
  });
}
