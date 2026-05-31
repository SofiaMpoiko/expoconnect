import { api } from './api.js';

const KEY = 'cz_offline_lead_queue_v1';
const MAX = 100;

function readQueue() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items) {
  localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX)));
}

export function enqueueOfflineLead(payload) {
  const items = readQueue();
  items.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    payload,
  });
  writeQueue(items);
}

export function peekQueue() {
  return readQueue();
}

export function removeQueueItem(id) {
  const items = readQueue().filter((x) => x.id !== id);
  writeQueue(items);
}

export function isLikelyNetworkError(err) {
  return Boolean(err && !err.response && (err.code === 'ERR_NETWORK' || err.message === 'Network Error'));
}

export async function flushOfflineQueue() {
  const items = readQueue();
  if (!items.length) return;

  for (const item of items) {
    try {
      await api.post('/leads', item.payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      removeQueueItem(item.id);
    } catch {
      break;
    }
  }
}
