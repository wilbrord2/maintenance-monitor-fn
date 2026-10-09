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
  getPart,
  getSchedule,
  listSchedules,
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
  test('an administrator adds a machine-wide task and a part task', async ({ page }) => {
    const token = await adminToken();
    const machine = await createMachine(token);
    const part = await createPart(token, machine.id, { name: `Cutting head ${uniqueSuffix()}` });
    await signInAndWaitForDashboard(page, e2eEnv.adminEmail, e2eEnv.adminPassword);
    await page.goto(`/dashboard/machines/${machine.id}`);

    await expect(page.getByText('No maintenance tasks')).toBeVisible();
    await page.getByRole('button', { name: 'Add task' }).first().click();

    // Whole machine: a name is required.
    let dialog = page.getByRole('dialog', { name: 'Add maintenance task' });
    await dialog.getByRole('button', { name: 'Add task' }).click();
    await expect(dialog.getByText('Enter a name for this machine-wide task')).toBeVisible();
    await dialog.getByLabel('Task name').fill('External cleaning');
    await dialog.getByLabel('Frequency').selectOption('daily');
    await dialog.getByRole('button', { name: 'Add task' }).click();
    await expect(dialog).toBeHidden();

    const tasks = page.getByRole('table', { name: `Maintenance tasks of ${machine.name}` });
    await expect(tasks.locator('tr', { hasText: 'External cleaning' }).getByText('Daily')).toBeVisible();

    // Part: the name follows the part, and the reminder must fit in the interval.
    await page.getByRole('button', { name: 'Add task' }).first().click();
    dialog = page.getByRole('dialog', { name: 'Add maintenance task' });
    await dialog.getByRole('radio', { name: 'Part' }).click();
    await dialog.getByLabel('Part').selectOption(String(part.id));
    await expect(dialog.getByLabel('Task name')).toHaveValue(part.name);
    await dialog.getByLabel('Frequency').selectOption('weekly');
    await dialog.getByLabel('Remind this many days before').fill('10');
    await dialog.getByRole('button', { name: 'Add task' }).click();
    await expect(dialog.getByText(/reminder can't start earlier/)).toBeVisible();
    await dialog.getByLabel('Remind this many days before').fill('2');
    await dialog.getByRole('button', { name: 'Add task' }).click();
    await expect(dialog).toBeHidden();

    await expect(tasks.getByText(`Part inspections · ${part.name}`)).toBeVisible();
    const schedules = await listSchedules(token, machine.id);
    expect(schedules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskName: 'External cleaning', machinePartId: null, intervalDays: 1 }),
        expect.objectContaining({ taskName: part.name, machinePartId: part.id, intervalDays: 7, reminderDaysBefore: 2 }),
      ]),
    );

    // Deactivating a task keeps it, greyed out behind the "All" filter.
    await tasks.getByRole('checkbox', { name: 'External cleaning active' }).click();
    await expect(tasks.locator('tr', { hasText: 'External cleaning' })).toHaveCount(0);
    await page.getByRole('radio', { name: /All \(1 inactive\)/ }).click();
    await expect(tasks.locator('tr', { hasText: 'External cleaning' }).getByText('Inactive')).toBeVisible();

    // Maintenance tasks never change the machine's operational status.
    expect((await getMachine(token, machine.id)).operationalStatus).toBe('OPERATING');
  });

  test('an overdue part task is listed with its machine and part while the machine keeps operating', async ({ page }) => {
    const token = await adminToken();
    const machine = await createMachine(token);
    const part = await createPart(token, machine.id, { name: `Nozzle ${uniqueSuffix()}` });
    const past = new Date(Date.now() - 3 * 86_400_000).toISOString();
    await createSchedule(token, machine.id, { machinePartId: part.id, taskName: 'Nozzle inspection', intervalDays: 7, nextMaintenanceAt: past });

    await signInAndWaitForDashboard(page, e2eEnv.adminEmail, e2eEnv.adminPassword);
    await page.goto(`/dashboard/maintenance?state=OVERDUE&machineId=${machine.id}`);

    const row = page.locator('tr', { hasText: machine.name });
    await expect(row.getByText('Nozzle inspection')).toBeVisible();
    await expect(row.getByText(part.name)).toBeVisible();
    await expect(row.getByText('Overdue', { exact: true })).toBeVisible();
    await expect(row.getByText('3 days late')).toBeVisible();

    // Machine-wide only: the part task drops out.
    await page.getByLabel('Task type').selectOption('machine');
    await expect(page.locator('tr', { hasText: 'Nozzle inspection' })).toHaveCount(0);

    await page.goto(`/dashboard/machines/${machine.id}`);
    await expect(page.getByText('Machine status').locator('..').getByText('Operating', { exact: true })).toBeVisible();
    expect((await getMachine(token, machine.id)).operationalStatus).toBe('OPERATING');
  });

  test('a part task puts the part under maintenance and completing it starts the next cycle', async ({ page }) => {
    const token = await adminToken();
    const machine = await createMachine(token);
    const part = await createPart(token, machine.id, { name: `Cutting head ${uniqueSuffix()}` });
    const task = await createSchedule(token, machine.id, {
      machinePartId: part.id,
      intervalDays: 7,
      nextMaintenanceAt: new Date(Date.now() - 86_400_000).toISOString(),
    });

    await signInAndWaitForDashboard(page, e2eEnv.adminEmail, e2eEnv.adminPassword);
    await page.goto(`/dashboard/machines/${machine.id}`);
    const tasks = page.getByRole('table', { name: `Maintenance tasks of ${machine.name}` });
    const parts = page.getByRole('table', { name: `Parts of ${machine.name}` });

    await tasks.getByRole('button', { name: `Start maintenance: ${task.taskName}` }).click();
    const startDialog = page.getByRole('dialog', { name: 'Start maintenance' });
    await expect(startDialog.getByLabel(/Put part under maintenance/)).toBeChecked();
    await startDialog.getByRole('button', { name: 'Start maintenance' }).click();
    await expect(startDialog).toBeHidden();

    // The part changes; the machine's status is re-derived from it by the server and refetched.
    await expect(parts.locator('tr', { hasText: part.name }).getByText('Under maintenance', { exact: true })).toBeVisible();
    expect((await getPart(token, machine.id, part.id)).status).toBe('UNDER_MAINTENANCE');
    const during = await getMachine(token, machine.id);
    expect(during.status).toBe('UNDER_MAINTENANCE');
    expect(during.systemStatus).toBe('ACTIVE');

    await tasks.getByRole('button', { name: `Complete maintenance: ${task.taskName}` }).click();
    const completeDialog = page.getByRole('dialog', { name: 'Complete maintenance' });
    await expect(completeDialog.getByLabel(/Return it to active when completed/)).toBeChecked();
    await completeDialog.getByRole('button', { name: 'Complete maintenance' }).click();
    await expect(completeDialog).toBeHidden();

    await expect(parts.locator('tr', { hasText: part.name }).getByText('Active', { exact: true })).toBeVisible();
    expect((await getMachine(token, machine.id)).status).toBe('ACTIVE');

    // The API rolls the task forward from the actual completion, not from the planned date.
    const schedule = await getSchedule(token, task.id);
    const expectedNext = new Date(Date.parse(schedule.lastMaintenanceAt ?? '') + 7 * 86_400_000);
    expect(Math.abs(Date.parse(schedule.nextMaintenanceAt) - expectedNext.getTime())).toBeLessThan(60_000);
    expect(Date.parse(schedule.nextMaintenanceAt)).toBeGreaterThan(Date.now());
  });
});
