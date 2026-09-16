import { type MachineState } from './machine';

export const MACHINE_STATUS_UPDATED_EVENT = 'machine.status.updated';
export const SESSION_EXPIRED_EVENT = 'session.expired';

export type MachineStatusChangeSource = 'MACHINE_LOG_CREATED' | 'MACHINE_LOG_UPDATED' | 'MACHINE_LOG_DELETED';

/** Payload of `machine.status.updated`, emitted by the API after the change is committed. */
export interface MachineStatusUpdatedEvent {
  machineId: number;
  machineName: string;
  serialNumber: string;
  previousStatus: MachineState;
  newStatus: MachineState;
  updatedBy: { id: number; name: string };
  logId: number;
  source: MachineStatusChangeSource;
  timestamp: string;
}

export interface StatusBoardServerEvents {
  [MACHINE_STATUS_UPDATED_EVENT]: (event: MachineStatusUpdatedEvent) => void;
  [SESSION_EXPIRED_EVENT]: (payload: { reason: 'ACCESS_TOKEN_EXPIRED' }) => void;
}

export type RealtimeConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';
