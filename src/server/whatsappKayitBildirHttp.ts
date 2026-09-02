import type { IncomingMessage, ServerResponse } from 'node:http';
import { taseronGrupWpHatE164 } from '../lib/taseronGrupSablon';
import {
  buildPersonelKayitAcildiText,
  isWhatsAppCloudSendConfigured,
  sendWhatsAppCloudText,
  uniqueWhatsAppNotifyTargets,
} from '../lib/whatsappKayitBildirim';
import { getBearerToken, readJsonBody, sendJson } from './nodeHttpUtil';

const FIREBASE_WEB_API_KEY = 'AIzaSyC7DIWBLXrkdDMIufYK_jEnSOjQ7XZQ6VI';
const FOUNDER_EMAILS = new Set(['santiye@kibritci.com', 'sametatak9@gmail.com', 'mudur@gmail.com']);
const ADMIN_ROLES = new Set(['KURUCU', 'YÖNETİCİ', 'YONETICI']);

function callerMayNotify(decoded: Record<string, unknown>): boolean {
  const email = String(decoded.email || '')
    .trim()
    .toLowerCase();
  if (FOUNDER_EMAILS.has(email)) return true;
  const role = String(decoded.role || decoded.rol || '').toLocaleUpperCase('tr-TR');
  return ADMIN_ROLES.has(role);
}

type NodeReq = IncomingMessage & { body?: unknown };

function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split('.')[1];
  if (!part) return {};
  const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  return JSON.parse(json) as Record<string, unknown>;
}

async function verifyFirebaseIdToken(idToken: string): Promise<Record<string, unknown>> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!res.ok) {
    throw new Error('Oturum doğrulanamadı.');
  }
  const data = (await res.json()) as { users?: Array<{ email?: string }> };
  const email = String(data.users?.[0]?.email || '').trim().toLowerCase();
  if (!email) throw new Error('Oturum e-postası yok.');
  const payload = decodeJwtPayload(idToken);
  return { ...payload, email };
}

export default async function whatsappKayitBildirHandler(
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
    sendJson(res, 200, {
      ok: true,
      route: 'whatsapp-kayit-bildir',
      sendConfigured: isWhatsAppCloudSendConfigured(),
    });
    return;
  }
  if (method !== 'POST') {
    sendJson(res, 405, { error: 'Yalnızca POST' });
    return;
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      sendJson(res, 401, { success: false, error: 'Oturum doğrulanamadı.' });
      return;
    }
    const decoded = await verifyFirebaseIdToken(token);
    if (!callerMayNotify(decoded)) {
      sendJson(res, 403, { success: false, error: 'Bu işlem için kurucu / yönetici yetkisi gerekir.' });
      return;
    }

    if (!isWhatsAppCloudSendConfigured()) {
      sendJson(res, 503, {
        success: false,
        error:
          'WhatsApp gönderimi yapılandırılmamış. Vercel’de WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID gerekir.',
        skipped: true,
      });
      return;
    }

    const body = await readJsonBody(req, 4000);
    const yon = String(body.yon || 'giris') === 'cikis' ? 'cikis' : 'giris';
    const text = buildPersonelKayitAcildiText({
      ad: String(body.ad || ''),
      soyad: String(body.soyad || ''),
      personelIsim: String(body.personelIsim || ''),
      firmaAdi: String(body.firmaAdi || ''),
      yon,
    });
    const targets = uniqueWhatsAppNotifyTargets({
      gonderen: String(body.gonderen || ''),
      ownHatE164: taseronGrupWpHatE164(),
    });
    if (!targets.length) {
      sendJson(res, 200, {
        success: true,
        skipped: true,
        reason: 'wa: gönderen yok (Cloud API WhatsApp grubuna yazamaz)',
        text,
      });
      return;
    }

    const results = [];
    for (const to of targets) {
      results.push({ to, ...(await sendWhatsAppCloudText({ to, body: text })) });
    }
    sendJson(res, 200, { success: true, text, results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Bildirim gönderilemedi';
    sendJson(res, 500, { success: false, error: message });
  }
}
