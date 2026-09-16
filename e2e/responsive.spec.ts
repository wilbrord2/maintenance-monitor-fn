import { expect, test } from '@playwright/test';
import { e2eEnv } from './support/api';
import { hasHorizontalOverflow, signInAndWaitForDashboard } from './support/ui';

const PAGES = [
  { path: '/dashboard', heading: /Good (morning|afternoon|evening)|Dashboard/ },
  { path: '/dashboard/machines', heading: 'Machines' },
  { path: '/dashboard/logs', heading: 'Machine Logs' },
  { path: '/dashboard/logs/create', heading: 'Record maintenance activity' },
  { path: '/dashboard/analytics', heading: 'Analytics' },
  { path: '/dashboard/technicians', heading: 'Technicians' },
  { path: '/dashboard/audit-logs', heading: 'Audit Logs' },
  { path: '/dashboard/profile', heading: 'Profile' },
];

test.describe('responsive layout', () => {
  test('login screen fits the viewport', async ({ page }, testInfo) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
    await page.screenshot({ path: `e2e/.artifacts/screens/${testInfo.project.name}-login.png`, fullPage: true });
  });

  test('main screens never scroll horizontally', async ({ page }, testInfo) => {
    await signInAndWaitForDashboard(page, e2eEnv.adminEmail, e2eEnv.adminPassword);
    for (const target of PAGES) {
      await page.goto(target.path);
      await expect(page.getByRole('heading', { level: 1, name: target.heading })).toBeVisible();
      // The live socket keeps the network busy, so wait for loading regions to settle instead of network idle.
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
      expect(await hasHorizontalOverflow(page), `${target.path} overflows horizontally`).toBe(false);
      const name = target.path.replace('/dashboard', 'dashboard').replaceAll('/', '-');
      await page.screenshot({ path: `e2e/.artifacts/screens/${testInfo.project.name}-${name}.png`, fullPage: true });
    }
  });

  test('navigation is reachable on every screen size', async ({ page }) => {
    await signInAndWaitForDashboard(page, e2eEnv.adminEmail, e2eEnv.adminPassword);
    const menuButton = page.getByRole('button', { name: 'Open navigation' });
    if (await menuButton.isVisible()) {
      await menuButton.click();
      const drawer = page.getByRole('dialog', { name: 'Navigation' });
      await drawer.getByRole('link', { name: 'Machine Logs' }).click();
      await expect(drawer).toBeHidden();
    } else {
      await page.getByRole('navigation', { name: 'Main' }).first().getByRole('link', { name: 'Machine Logs' }).click();
    }
    await expect(page).toHaveURL(/\/dashboard\/logs$/);
  });
});
