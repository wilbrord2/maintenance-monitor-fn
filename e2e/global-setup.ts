import { adminToken, createLog, createMachine, listMachines } from './support/api';

const FLEET = ['Laser 1', 'Compressor 1', 'Press 1', 'CNC Rolling Machine', 'Spot Welding Machine 1', 'Chiller 1'];

/**
 * Ensures a small, realistic fleet exists so screens are exercised with data.
 * Idempotent: machines are created only when missing.
 */
export default async function globalSetup(): Promise<void> {
  const token = await adminToken();
  const existing = new Set((await listMachines(token)).map((machine) => machine.name));
  const hour = 3_600_000;

  for (const [index, name] of FLEET.entries()) {
    if (existing.has(name)) continue;
    const machine = await createMachine(token, name);
    if (index === 1) {
      await createLog(token, {
        machineId: machine.id,
        entryStatus: 'ACTIVE',
        resultingState: 'DOWNTIME',
        faultDescription: 'Motor overheating during start-up',
        startedAt: new Date(Date.now() - 5 * hour).toISOString(),
      });
    }
    if (index === 2) {
      await createLog(token, {
        machineId: machine.id,
        entryStatus: 'ACTIVE',
        resultingState: 'UNDER_MAINTENANCE',
        faultDescription: 'Hydraulic pressure drop on main cylinder',
        startedAt: new Date(Date.now() - 3 * hour).toISOString(),
      });
    }
    if (index === 3) {
      await createLog(token, {
        machineId: machine.id,
        entryStatus: 'ACTIVE',
        resultingState: 'ACTIVE',
        faultDescription: 'Scheduled inspection of rollers',
        logStatus: 'CLOSED',
        startedAt: new Date(Date.now() - 26 * hour).toISOString(),
        endedAt: new Date(Date.now() - 25 * hour).toISOString(),
      });
    }
  }
}
