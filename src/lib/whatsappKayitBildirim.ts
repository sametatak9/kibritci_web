/** Onay sonrası gönderene WhatsApp metni. Cloud API gruplara yazamaz; wa: numarasına döner. */

export function isWhatsAppCloudSendConfigured(): boolean {
  return Boolean(
    String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim() &&
      String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim()
  );
}

export function waSenderToE164(gonderen?: string | null): string | null {
  const raw = String(gonderen || '').trim();
  if (!raw) return null;
  const wa = raw.match(/wa:(\+?\d{8,20})/i);
  const digits = (wa ? wa[1] : raw).replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  if (digits.startsWith('90')) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;
  return digits;
}

export function buildPersonelKayitAcildiText(opts: {
  ad?: string;
  soyad?: string;
  personelIsim?: string;
  firmaAdi?: string;
  yon?: 'giris' | 'cikis';
}): string {
  const name = String(opts.personelIsim || `${opts.ad || ''} ${opts.soyad || ''}`)
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('tr-TR');
  const firma = String(opts.firmaAdi || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('tr-TR') || '—';
  const kim = name || 'PERSONEL';
  if (opts.yon === 'cikis') {
    return `${kim} personeli ${firma} firmasında kaydı kapatıldı.`;
  }
  return `${kim} personeli ${firma} firmasında kaydı açıldı.`;
}

export function uniqueWhatsAppNotifyTargets(opts: {
  gonderen?: string | null;
  extraTo?: string | null;
  ownHatE164?: string | null;
}): string[] {
  const own = String(opts.ownHatE164 || '').replace(/\D/g, '');
  const extraEnv = String(process.env.WHATSAPP_NOTIFY_TO || opts.extraTo || '');
  const candidates = [waSenderToE164(opts.gonderen), waSenderToE164(extraEnv)].filter(
    (n): n is string => Boolean(n)
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of candidates) {
    if (own && n === own) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export async function sendWhatsAppCloudText(opts: {
  to: string;
  body: string;
  accessToken?: string;
  phoneNumberId?: string;
}): Promise<{ ok: boolean; status: number; detail?: string }> {
  const token = String(opts.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneId = String(opts.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const to = String(opts.to || '').replace(/\D/g, '');
  if (!token || !phoneId) {
    return { ok: false, status: 503, detail: 'WHATSAPP_ACCESS_TOKEN veya WHATSAPP_PHONE_NUMBER_ID yok' };
  }
  if (!to) return { ok: false, status: 400, detail: 'alıcı yok' };
  const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneId)}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: String(opts.body || '').slice(0, 4096) },
    }),
  });
  const raw = await res.text().catch(() => '');
  if (!res.ok) {
    return { ok: false, status: res.status, detail: raw.slice(0, 300) };
  }
  return { ok: true, status: res.status };
}
