import { useEffect, useState } from 'react';
import { flushOfflineQueue, peekQueue } from '../offlineQueue.js';

export function useOnlineQueueFlusher() {
  useEffect(() => {
    const run = () => {
      if (navigator.onLine) flushOfflineQueue().catch(() => {});
    };
    run();
    window.addEventListener('online', run);
    return () => window.removeEventListener('online', run);
  }, []);
}

export function OfflineBanner({ variant = 'light' }) {
  const [queued, setQueued] = useState(() => peekQueue().length);
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const isDark = variant === 'dark';

  useEffect(() => {
    const tick = () => setQueued(peekQueue().length);
    const id = window.setInterval(tick, 1500);
    window.addEventListener('online', tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('online', tick);
    };
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!queued) return null;

  return (
    <div
      className={
        isDark
          ? 'border-b border-amber-800/50 bg-amber-950/50 px-4 py-3 text-sm text-amber-100'
          : 'border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950'
      }
    >
      {online
        ? `Sending ${queued} offline lead${queued === 1 ? '' : 's'}…`
        : `You are offline. ${queued} lead${queued === 1 ? '' : 's'} saved on this device will send automatically when you reconnect.`}
    </div>
  );
}
