import { AUTH_BROADCAST_CHANNEL } from '@/constants/session';

export type AuthChannelMessage = { type: 'signed-out' } | { type: 'signed-in' };

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  channel ??= new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
  return channel;
}

/** Tells other tabs of this application that the user signed in or out. */
export function broadcastAuthMessage(message: AuthChannelMessage): void {
  getChannel()?.postMessage(message);
}

export function subscribeToAuthMessages(handler: (message: AuthChannelMessage) => void): () => void {
  const current = getChannel();
  if (!current) return () => undefined;
  const listener = (event: MessageEvent<unknown>) => {
    const data = event.data;
    if (typeof data === 'object' && data !== null && 'type' in data) {
      if (data.type === 'signed-out' || data.type === 'signed-in') handler({ type: data.type });
    }
  };
  current.addEventListener('message', listener);
  return () => current.removeEventListener('message', listener);
}
