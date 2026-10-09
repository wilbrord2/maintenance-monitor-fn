import { afterEach, describe, expect, it } from 'vitest';
import { makeStatusEvent } from '@/test/factories';
import { useRealtimeStore } from './realtime-store';

describe('realtime store', () => {
  afterEach(() => useRealtimeStore.getState().reset());

  it('records a status change once, even when it is delivered twice', () => {
    const event = makeStatusEvent();
    useRealtimeStore.getState().recordStatusChange(event, false);
    useRealtimeStore.getState().recordStatusChange(event, false);
    expect(useRealtimeStore.getState().notifications).toHaveLength(1);
    expect(useRealtimeStore.getState().unreadCount).toBe(1);
  });

  it('keeps status changes without a log apart', () => {
    const store = useRealtimeStore.getState();
    store.recordStatusChange(makeStatusEvent({ logId: null, trigger: { type: 'MAINTENANCE_EVENT', maintenanceEventId: 60 } }), false);
    store.recordStatusChange(
      makeStatusEvent({ logId: null, trigger: { type: 'MAINTENANCE_EVENT', maintenanceEventId: 61 }, timestamp: '2026-09-15T10:00:00.000Z' }),
      false,
    );
    store.recordStatusChange(makeStatusEvent({ machineId: 6, logId: null, trigger: { type: 'MAINTENANCE_EVENT' } }), false);
    expect(useRealtimeStore.getState().notifications).toHaveLength(3);
  });
});
