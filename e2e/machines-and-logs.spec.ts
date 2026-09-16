import { expect, test } from '@playwright/test';
import { adminToken, createActivatedTechnician, createLog, createMachine, e2eEnv, getMachine, uniqueSuffix } from './support/api';
import { signInAndWaitForDashboard } from './support/ui';

test.describe('machines and maintenance logs', () => {
  test('an administrator adds a machine, which starts as Active', async ({ page }) => {
    const token = await adminToken();
    const existing = await createMachine(token);
    await signInAndWaitForDashboard(page, e2eEnv.adminEmail, e2eEnv.adminPassword);

    await page.goto('/dashboard/machines');
    await page.getByRole('button', { name: 'Add machine' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Add machine' });
    const name = `Laser ${uniqueSuffix()}`;
    await dialog.getByLabel('Machine name').fill(name);

    await dialog.getByLabel('Serial number').fill(existing.serialNumber.toLowerCase());
    await dialog.getByRole('button', { name: 'Add machine' }).click();
    await expect(dialog.getByText('A machine with this serial number already exists.')).toBeVisible();

    await dialog.getByLabel('Serial number').fill(`lsr-${uniqueSuffix()}`);
    await dialog.getByRole('button', { name: 'Add machine' }).click();

    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(page.getByText('Current state').locator('..').getByText('Active', { exact: true })).toBeVisible();
  });

  test('recording maintenance changes the machine status through a log', async ({ page }) => {
    const machine = await createMachine(await adminToken());
    await signInAndWaitForDashboard(page, e2eEnv.adminEmail, e2eEnv.adminPassword);

    await page.goto(`/dashboard/machines/${machine.id}`);
    await page.getByRole('link', { name: 'Record activity' }).first().click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/logs/create\\?machineId=${machine.id}$`));
    await expect(page.getByText('Current machine state')).toBeVisible();

    await page.getByLabel('Fault description').fill('Cooling fan making grinding noise');
    const resulting = page.getByLabel('Resulting state');
    await expect(resulting).toBeEnabled();
    await resulting.selectOption('UNDER_MAINTENANCE');
    await expect(page.getByLabel('Log status').locator('option[value="CLOSED"]')).toBeDisabled();
    await page.getByRole('button', { name: 'Save log' }).click();

    await expect(page).toHaveURL(/\/dashboard\/logs\/\d+$/);
    await expect(page.getByRole('heading', { name: 'State transition' })).toBeVisible();
    expect((await getMachine(await adminToken(), machine.id)).status).toBe('UNDER_MAINTENANCE');
  });

  test('status changes made by another technician appear live on the board', async ({ page }) => {
    const token = await adminToken();
    const machine = await createMachine(token);
    const technician = await createActivatedTechnician(token);
    await signInAndWaitForDashboard(page, e2eEnv.adminEmail, e2eEnv.adminPassword);

    await page.goto(`/dashboard/machines?search=${encodeURIComponent(machine.name)}`);
    const main = page.locator('main');
    await expect(main.getByRole('link', { name: machine.name }).first()).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /^Live$/ }).first()).toBeVisible();

    await createLog(technician.token, {
      machineId: machine.id,
      entryStatus: 'ACTIVE',
      resultingState: 'DOWNTIME',
      faultDescription: 'Emergency stop triggered',
    });

    const row = main.locator('tr', { hasText: machine.name });
    await expect(row.getByText('Downtime', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Status changes, 1 new/ }).click();
    await expect(page.getByRole('dialog').getByText(`By ${technician.fullName}`)).toBeVisible();
  });

  test('deleting a log is administrator-only and always confirmed', async ({ page, browser }) => {
    const token = await adminToken();
    const machine = await createMachine(token);
    const log = await createLog(token, {
      machineId: machine.id,
      entryStatus: 'ACTIVE',
      resultingState: 'UNDER_TEST',
      faultDescription: 'Calibration run after repair',
    });
    const technician = await createActivatedTechnician(token);

    const technicianContext = await browser.newContext();
    const technicianPage = await technicianContext.newPage();
    await signInAndWaitForDashboard(technicianPage, technician.email, technician.password);
    await technicianPage.goto(`/dashboard/logs/${log.id}`);
    await expect(technicianPage.getByRole('link', { name: 'Edit' })).toBeVisible();
    await expect(technicianPage.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    await technicianContext.close();

    await signInAndWaitForDashboard(page, e2eEnv.adminEmail, e2eEnv.adminPassword);
    await page.goto(`/dashboard/logs/${log.id}`);
    await page.getByRole('button', { name: 'Delete' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete maintenance log?' });
    await expect(dialog).toContainText("This action may affect the machine's historical activity.");
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete log' }).click();
    await expect(page).toHaveURL(/\/dashboard\/logs$/);
    expect((await getMachine(token, machine.id)).status).toBe('ACTIVE');
  });
});
