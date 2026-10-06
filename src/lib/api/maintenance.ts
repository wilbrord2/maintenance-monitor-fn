import {
  type CancelMaintenanceEventRequest,
  type CompleteMaintenanceEventRequest,
  type CreateMaintenanceEventRequest,
  type CreateMaintenanceScheduleRequest,
  type ListMaintenanceEventsParams,
  type MaintenanceEvent,
  type MaintenanceSchedule,
  type MaintenanceScheduleListParams,
  type StartMaintenanceEventRequest,
  type UpdateMaintenanceEventRequest,
  type UpdateMaintenanceScheduleRequest,
} from '@/types/maintenance';
import { getData, getPage, patchData, postData, type RequestOptions } from './client';

/**
 * Recurring maintenance. Due dates, UPCOMING/DUE/OVERDUE and the next cycle after a completion
 * are all calculated by the API; this module only carries them.
 */
export const maintenanceApi = {
  getSchedule: (machineId: number, options?: RequestOptions) =>
    getData<MaintenanceSchedule>(`/machines/${machineId}/maintenance`, undefined, options),

  /** ADMIN only. One schedule per machine. */
  createSchedule: (machineId: number, body: CreateMaintenanceScheduleRequest) =>
    postData<MaintenanceSchedule>(`/machines/${machineId}/maintenance`, body),

  /** ADMIN only. */
  updateSchedule: (machineId: number, body: UpdateMaintenanceScheduleRequest) =>
    patchData<MaintenanceSchedule>(`/machines/${machineId}/maintenance`, body),

  /** Schedules inside their reminder window. */
  upcoming: (params: MaintenanceScheduleListParams, options?: RequestOptions) =>
    getPage<MaintenanceSchedule>('/maintenance/upcoming', params, options),

  due: (params: MaintenanceScheduleListParams, options?: RequestOptions) =>
    getPage<MaintenanceSchedule>('/maintenance/due', params, options),

  overdue: (params: MaintenanceScheduleListParams, options?: RequestOptions) =>
    getPage<MaintenanceSchedule>('/maintenance/overdue', params, options),

  listEvents: (params: ListMaintenanceEventsParams, options?: RequestOptions) =>
    getPage<MaintenanceEvent>('/maintenance-events', params, options),

  getEvent: (id: number, options?: RequestOptions) =>
    getData<MaintenanceEvent>(`/maintenance-events/${id}`, undefined, options),

  createEvent: (body: CreateMaintenanceEventRequest) =>
    postData<MaintenanceEvent>('/maintenance-events', body),

  /** Rescheduling and notes only; the lifecycle uses the three actions below. */
  updateEvent: (id: number, body: UpdateMaintenanceEventRequest) =>
    patchData<MaintenanceEvent>(`/maintenance-events/${id}`, body),

  startEvent: (id: number, body: StartMaintenanceEventRequest) =>
    postData<MaintenanceEvent>(`/maintenance-events/${id}/start`, body),

  /** The completion time starts the next cycle; the API returns the new due date. */
  completeEvent: (id: number, body: CompleteMaintenanceEventRequest) =>
    postData<MaintenanceEvent>(`/maintenance-events/${id}/complete`, body),

  /** ADMIN only. */
  cancelEvent: (id: number, body: CancelMaintenanceEventRequest) =>
    postData<MaintenanceEvent>(`/maintenance-events/${id}/cancel`, body),
};
