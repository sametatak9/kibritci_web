import type { IncomingMessage, ServerResponse } from 'node:http';

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function sendText(res: ServerResponse, status: number, text: string): void {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(text);
}

export function getBearerToken(req: IncomingMessage): string {
  const header = String(req.headers.authorization || '').trim();
  const m = header.match(/^Bearer\s+(.+)$/i);
  return (m && m[1] && m[1].trim()) || '';
}

export async function readJsonBody(
  req: IncomingMessage & { body?: unknown },
  timeoutMs = 8000
): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as Record<string, unknown>;
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('İstek gövdesi zaman aşımına uğradı'));
    }, timeoutMs);
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        reject(new Error('JSON gövde okunamadı'));
      }
    });
    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

export function collectWhatsAppMessages(body: Record<string, unknown>): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = [];
  const entries = Array.isArray(body.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray((entry as { changes?: unknown })?.changes)
      ? ((entry as { changes: unknown[] }).changes)
      : [];
    for (const change of changes) {
      const batch = (change as { value?: { messages?: unknown } })?.value?.messages;
      if (Array.isArray(batch)) messages.push(...(batch as Array<Record<string, unknown>>));
    }
  }
  return messages;
}
