import { expect, test } from '@playwright/test';
import { adminToken, createTechnician, e2eEnv, TECHNICIAN_PASSWORD } from './support/api';
import { signIn, signInAndWaitForDashboard } from './support/ui';

/** Against `next dev`, the first visit to a route compiles it, which can take several seconds. */
const FIRST_NAVIGATION_TIMEOUT = 30_000;

test.describe('authentication', () => {
  test('sends signed-out visitors to the login page and back afterwards', async ({ page }) => {
    await page.goto('/dashboard/machines?status=DOWNTIME');
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fmachines%3Fstatus%3DDOWNTIME/);

    await page.getByLabel('Email').fill(e2eEnv.adminEmail);
    await page.getByLabel('Password', { exact: true }).fill(e2eEnv.adminPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard\/machines\?status=DOWNTIME$/, { timeout: FIRST_NAVIGATION_TIMEOUT });
  });

  test('explains invalid credentials', async ({ page }) => {
    await signIn(page, e2eEnv.adminEmail, 'WrongPassword123');
    // Next.js also renders an (empty) route announcer with role="alert".
    await expect(page.getByRole('alert').filter({ hasText: 'Incorrect email or password.' })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('keeps the session across reloads and signs out cleanly', async ({ page }) => {
    await signInAndWaitForDashboard(page, e2eEnv.adminEmail, e2eEnv.adminPassword);
    const storage = await page.evaluate(() => JSON.stringify(window.localStorage) + JSON.stringify(window.sessionStorage));
    expect(storage).not.toMatch(/eyJ/); // no JWT persisted in web storage

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('button', { name: /Account menu/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('forces a first-time technician to replace the temporary password', async ({ page }) => {
    const technician = await createTechnician(await adminToken());

    await signIn(page, technician.email, technician.temporaryPassword);
    await expect(page).toHaveURL(/\/change-password$/, { timeout: FIRST_NAVIGATION_TIMEOUT });
    await expect(page.getByRole('heading', { name: 'Set your password' })).toBeVisible();

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/change-password$/);

    await page.getByLabel('Temporary password').fill(technician.temporaryPassword);
    await page.getByLabel('New password', { exact: true }).fill(TECHNICIAN_PASSWORD);
    await page.getByLabel('Confirm new password').fill(TECHNICIAN_PASSWORD);
    await page.getByRole('button', { name: 'Set password and continue' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    const nav = page.getByRole('navigation', { name: 'Main' }).first();
    await expect(nav.getByRole('link', { name: 'Machine Logs' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Technicians' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Audit Logs' })).toHaveCount(0);

    await page.goto('/dashboard/audit-logs');
    await expect(page.getByText('Access denied')).toBeVisible();
  });
});
