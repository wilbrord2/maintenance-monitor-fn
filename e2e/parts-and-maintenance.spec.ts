import { expect, test } from '@playwright/test';
import {
  adminToken,
  createActivatedTechnician,
  createMachine,
  createPart,
  createLog,
  createSchedule,
  e2eEnv,
  getMachine,
  getSchedule,
  uniqueSuffix,
} from './support/api';
import { signInAndWaitForDashboard } from './support/ui';

test.describe('machine parts', () => {
  test('an administrator adds a part and the machine status comes back from the server', async ({ page }) => {
    const token = await adminToken();
    const machine = await createMachine(token);
    await signInAndWaitForDashboard(page, e2eEnv.adminEmail, e2eEnv.adminPassword);
    await page.goto(`/dashboard/machines/${machine.id}`);

    await expect(page.getByText('No parts configured').first()).toBeVisible();
    await page.getByRole('button', { name: 'Add part' }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Add part' });
    const partName = `Hydraulic pump ${uniqueSuffix()}`;
    await dialog.getByLabel('Part name').fill(partName);
    await dialog.getByLabel('Part code').fill(`pmp-${uniqueSuffix()}`);
    await dialog.getByLabel('Critical part').check();
    await dialog.getByRole('button', { name: 'Add part' }).click();
    await expect(dialog).toBeHidden();

    const row = page.locator('tr', { hasText: partName });
    await expect(row.getByText('Active', { exact: true })).toBeVisible();
    await expect(row.getByText('Critical', { exact: true })).toBeVisible();

    // The machine is still operating, and that is what the API says too.
    const status = page.getByText('Machine status').locator('..');
    await expect(status.getByText('Operating', { exact: true })).toBeVisible();
    expect((await getMachine(token, machine.id)).operationalStatus).toBe('OPERATING');
  });

  test('a blocking part condition stops the machine, a non-blocking one does not', async ({ page }) => {
    const token = await adminToken();
    const machine = await createMachine(token);
    const blocking = await createPart(token, machine.id, { name: 'Main motor', isCritical: true });
    const spare = await createPart(token, machine.id, { name: 'Cooling fan', isCritical: false });

    await signInAndWaitForDashboard(page, e2eEnv.adminEmail, e2eEnv.adminPassword);
    await page.goto(`/dashboard/machines/${machine.id}`);
    await expect(page.getByText('Machine status').locator('..').getByText('Operating', { exact: true })).toBeVisible();

    // A non-blocking condition: the machine keeps running, with a defect.
    await createLog(token, {
      machineId: machine.id,
      machinePartId: spare.id,
      resultingState: 'UNDER_MAINTENANCE',
      operationalImpact: 'NON_BLOCKING',
      faultDescription: 'Bearing noise at high speed',
    });
    await expect(
      page.getByText('Machine status').locator('..').getByText('Operating with defects', { exact: true }),
    ).toBeVisible();
    // The part pulls the effective status down; the machine's own system state is untouched.
    expect(await getMachine(token, machine.id)).toMatchObject({
      status: 'UNDER_MAINTENANCE',
      systemStatus: 'ACTIVE',
      operationalStatus: 'OPERATING_WITH_DEFECTS',
    });

    // The same status on a blocking part stops the machine. Status alone does not decide this.
    await createLog(token, {
      machineId: machine.id,
      machinePartId: blocking.id,
      resultingState: 'UNDER_MAINTENANCE',
      operationalImpact: 'BLOCKING',
      faultDescription: 'Motor overheating during start-up',
    });
    await expect(
      page.getByText('Machine status').locator('..').getByText('Not operating', { exact: true }),
    ).toBeVisible();
    expect((await getMachine(token, machine.id)).operationalStatus).toBe('NOT_OPERATING');

    const motorRow = page.locator('tr', { hasText: 'Main motor' });
    await expect(motorRow.getByText('Blocking', { exact: true })).toBeVisible();
    const fanRow = page.locator('tr', { hasText: 'Cooling fan' });
    await expect(fanRow.getByText('Non-blocking', { exact: true })).toBeVisible();
  });

  test('a technician records a part log from the part row but cannot add or remove parts', async ({ page }) => {
    const token = await adminToken();
    const machine = await createMachine(token);
    const part = await createPart(token, machine.id, { name: 'Valve', isCritical: false });
    const technician = await createActivatedTechnician(token);

    await signInAndWaitForDashboard(page, technician.email, technician.password);
    await page.goto(`/dashboard/machines/${machine.id}`);

    await expect(page.locator('tr', { hasText: 'Valve' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add part' })).toHaveCount(0);

    // The part's record button opens the shared log form with the part preselected.
    await page.getByRole('link', { name: `Record activity for ${part.name}` }).first().click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/logs/create\\?machineId=${machine.id}&partId=${part.id}$`));
    await expect(page.getByLabel('Part')).toHaveValue(String(part.id));
    await expect(page.getByLabel('Operational impact')).toHaveValue('NON_BLOCKING');
    await page.getByLabel('Fault description').fill('Valve jammed shut');
    await page.getByLabel('New state').selectOption('DOWNTIME');
    await page.getByRole('button', { name: 'Save log' }).click();
    await expect(page).toHaveURL(/\/dashboard\/logs\/\d+$/);

    await page.goto(`/dashboard/machines/${machine.id}`);
    await expect(page.locator('tr', { hasText: 'Valve' }).getByText('Downtime', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'More actions for Valve' }).click();
    await expect(page.getByRole('menuitem', { name: 'Remove part' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'View part and history' })).toBeVisible();
  });
});

test.describe('preventive maintenance', () => {
  test('an administrator schedules maintenance and the server owns the due date', async ({ page }) => {
    const token = await adminToken();
    const machine = await createMachine(token);
    await signInAndWaitForDashboard(page, e2eEnv.adminEmail, e2eEnv.adminPassword);
    await page.goto(`/dashboard/machines/${machine.id}`);

    await expect(page.getByText('No preventive maintenance schedule')).toBeVisible();
    await page.getByRole('button', { name: 'Set up schedule' }).click();

    const dialog = page.getByRole('dialog', { name: 'Set up preventive maintenance' });
    await dialog.getByLabel('Maintenance interval (days)').fill('0');
    await dialog.getByRole('button', { name: 'Create schedule' }).click();
    await expect(dialog.getByText('The interval must be at least 1 day')).toBeVisible();

    await dialog.getByLabel('Maintenance interval (days)').fill('20');
    await dialog.getByLabel('Remind this many days before').fill('30');
    await dialog.getByRole('button', { name: 'Create schedule' }).click();
    await expect(dialog.getByText(/reminder can't start earlier/)).toBeVisible();

    await dialog.getByLabel('Remind this many days before').fill('5');
    await dialog.getByRole('button', { name: 'Create schedule' }).click();
    await expect(dialog).toBeHidden();

    const schedule = await getSchedule(token, machine.id);
    expect(schedule.intervalDays).toBe(20);
    await expect(page.getByText('Every 20 days')).toBeVisible();

    // Overdue or not, maintenance state never changes the machine's operational status.
    expect((await getMachine(token, machine.id)).operationalStatus).toBe('OPERATING');
  });

  test('an overdue machine is listed for attention while still operating', async ({ page }) => {
    const token = await adminToken();
    const machine = await createMachine(token);
    const past = new Date(Date.now() - 3 * 86_400_000).toISOString();
    await createSchedule(token, machine.id, { intervalDays: 20, reminderDaysBefore: 5, nextMaintenanceAt: past });

    await signInAndWaitForDashboard(page, e2eEnv.adminEmail, e2eEnv.adminPassword);
    await page.goto('/dashboard/maintenance');

    const row = page.locator('tr', { hasText: machine.name });
    await expect(row.getByText('Overdue', { exact: true })).toBeVisible();
    await expect(row.getByText('3 days late')).toBeVisible();

    await page.goto(`/dashboard/machines/${machine.id}`);
    await expect(page.getByText('Machine status').locator('..').getByText('Operating', { exact: true })).toBeVisible();
    expect((await getMachine(token, machine.id)).operationalStatus).toBe('OPERATING');
  });

  test('completing maintenance starts the next cycle from the completion time', async ({ page }) => {
    const token = await adminToken();
    const machine = await createMachine(token);
    await createSchedule(token, machine.id, {
      intervalDays: 20,
      reminderDaysBefore: 5,
      nextMaintenanceAt: new Date(Date.now() - 86_400_000).toISOString(),
    });

    await signInAndWaitForDashboard(page, e2eEnv.adminEmail, e2eEnv.adminPassword);
    await page.goto(`/dashboard/machines/${machine.id}`);

    await page.getByRole('button', { name: 'Plan maintenance' }).click();
    const planDialog = page.getByRole('dialog', { name: 'Plan maintenance' });
    await planDialog.getByRole('button', { name: 'Plan maintenance' }).click();
    await expect(planDialog).toBeHidden();

    await page.getByRole('button', { name: 'Start maintenance' }).click();
    const startDialog = page.getByRole('dialog', { name: 'Start maintenance' });
    await startDialog.getByRole('button', { name: 'Start maintenance' }).click();
    await expect(startDialog).toBeHidden();
    await expect(page.getByText('Maintenance in progress')).toBeVisible();

    await page.getByRole('button', { name: 'Complete maintenance' }).click();
    const completeDialog = page.getByRole('dialog', { name: 'Complete maintenance' });
    await completeDialog.getByRole('button', { name: 'Complete maintenance' }).click();
    await expect(completeDialog).toBeHidden();

    // The API rolls the cycle forward from the actual completion, not from the planned date.
    const schedule = await getSchedule(token, machine.id);
    const expectedNext = new Date(Date.parse(schedule.lastMaintenanceAt ?? '') + 20 * 86_400_000);
    expect(Math.abs(Date.parse(schedule.nextMaintenanceAt) - expectedNext.getTime())).toBeLessThan(60_000);
    expect(Date.parse(schedule.nextMaintenanceAt)).toBeGreaterThan(Date.now());
  });
});
