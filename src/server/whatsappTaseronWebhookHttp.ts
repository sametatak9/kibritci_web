import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  handleWhatsAppTaseronMessages,
  isWhatsAppTaseronWebhookConfigured,
} from './taseronGrupIntake';
import { collectWhatsAppMessages, readJsonBody, sendJson, sendText } from './nodeHttpUtil';

type NodeReq = IncomingMessage & { body?: unknown };

export default async function whatsappTaseronWebhookHandler(
  req: NodeReq,
  res: ServerResponse
): Promise<void> {
  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (method === 'GET' || method === 'HEAD') {
    const host = String(req.headers.host || 'localhost');
    const url = new URL(req.url || '/', `http://${host}`);
    const mode = String(url.searchParams.get('hub.mode') || '');
    const token = String(url.searchParams.get('hub.verify_token') || '');
    const challenge = String(url.searchParams.get('hub.challenge') || '');
    const expected = String(process.env.WHATSAPP_VERIFY_TOKEN || '').trim();
    if (mode === 'subscribe' && expected && token === expected) {
      sendText(res, 200, challenge);
      return;
    }
    sendJson(res, 403, { error: 'WhatsApp verify token uyuşmadı veya tanımlı değil.' });
    return;
  }
  if (method !== 'POST') {
    sendJson(res, 405, { error: 'Yalnızca GET/POST' });
    return;
  }
  if (!isWhatsAppTaseronWebhookConfigured()) {
    sendJson(res, 503, {
      error:
        'WhatsApp otomasyonu yapılandırılmamış. WHATSAPP_ACCESS_TOKEN + WHATSAPP_VERIFY_TOKEN gerekir.',
    });
    return;
  }
  try {
    const body = await readJsonBody(req, 8000);
    const messages = collectWhatsAppMessages(body);
    const result = await handleWhatsAppTaseronMessages(messages as never);
    sendJson(res, 200, { success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'webhook hata';
    console.error('WhatsApp taşeron webhook:', error);
    sendJson(res, 200, { success: false, error: message });
  }
}
