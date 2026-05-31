/** Server-sent events — notify admin dashboards when leads change. */

const clients = new Set();

export function subscribeLeadsStream(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(': connected\n\n');
  clients.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clients.delete(res);
      clearInterval(heartbeat);
    }
  }, 25_000);

  return () => {
    clearInterval(heartbeat);
    clients.delete(res);
  };
}

export function notifyLeadsChanged() {
  if (clients.size === 0) return;

  const data = JSON.stringify({ at: Date.now() });
  const message = `event: leads-changed\ndata: ${data}\n\n`;

  for (const res of clients) {
    try {
      res.write(message);
    } catch {
      clients.delete(res);
    }
  }
}
