import { expect, test } from '@playwright/test';
import { adminToken, createMachine, createPart, createLog, createSchedule, e2eEnv } from './support/api';
import { hasHorizontalOverflow, signInAndWaitForDashboard } from './support/ui';

const PAGES = [
  { path: '/dashboard', heading: /Good (morning|afternoon|evening)|Dashboard/ },
  { path: '/dashboard/machines', heading: 'Machines' },
  { path: '/dashboard/logs', heading: 'Machine Logs' },
  { path: '/dashboard/logs/create', heading: 'Record maintenance activity' },
  { path: '/dashboard/maintenance', heading: 'Maintenance' },
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

  test('machine and part pages fit the viewport once parts exist', async ({ page }, testInfo) => {
    const token = await adminToken();
    const machine = await createMachine(token);
    const part = await createPart(token, machine.id, { name: 'Hydraulic pump', isCritical: true });
    await createPart(token, machine.id, { name: 'Cooling fan', isCritical: false });
    await createLog(token, {
      machineId: machine.id,
      machinePartId: part.id,
      resultingState: 'UNDER_MAINTENANCE',
      operationalImpact: 'BLOCKING',
      faultDescription: 'Pressure drop on the main cylinder',
    });
    await createSchedule(token, machine.id, { taskName: 'External cleaning', intervalDays: 1 });
    await createSchedule(token, machine.id, { machinePartId: part.id, intervalDays: 7 });

    await signInAndWaitForDashboard(page, e2eEnv.adminEmail, e2eEnv.adminPassword);

    const targets = [
      { path: `/dashboard/machines/${machine.id}`, name: 'machine-detail', heading: machine.name },
      { path: `/dashboard/machines/${machine.id}/parts/${part.id}`, name: 'machine-part', heading: part.name },
    ];
    for (const target of targets) {
      await page.goto(target.path);
      // Wait for the page itself, not just the session-restore screen.
      await expect(page.getByRole('heading', { level: 1, name: target.heading })).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
      expect(await hasHorizontalOverflow(page), `${target.path} overflows horizontally`).toBe(false);
      await page.screenshot({
        path: `e2e/.artifacts/screens/${testInfo.project.name}-${target.name}.png`,
        fullPage: true,
      });
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
