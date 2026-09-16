import {
  type AnalyticsDowntime,
  type AnalyticsFaults,
  type AnalyticsFaultsParams,
  type AnalyticsMaintenanceEvents,
  type AnalyticsOverview,
  type AnalyticsRangeParams,
  type AnalyticsTechnicians,
  type AnalyticsTopParams,
} from '@/types/analytics';
import { getData, type RequestOptions } from './client';

export const analyticsApi = {
  overview: (range: AnalyticsRangeParams, options?: RequestOptions) =>
    getData<AnalyticsOverview>('/analytics/overview', range, options),

  downtime: (params: AnalyticsTopParams, options?: RequestOptions) =>
    getData<AnalyticsDowntime>('/analytics/downtime', params, options),

  maintenanceEvents: (params: AnalyticsTopParams, options?: RequestOptions) =>
    getData<AnalyticsMaintenanceEvents>('/analytics/maintenance-events', params, options),

  technicians: (params: AnalyticsTopParams, options?: RequestOptions) =>
    getData<AnalyticsTechnicians>('/analytics/technicians', params, options),

  faults: (params: AnalyticsFaultsParams, options?: RequestOptions) =>
    getData<AnalyticsFaults>('/analytics/faults', params, options),
};
