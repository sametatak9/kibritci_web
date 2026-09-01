/** Taşeron grup otomasyon girişi — PDF+alt yazı. WhatsApp grubu dinlenmez; kuyruk yazılır, kadro yazılmaz. */

import { timingSafeEqual } from 'node:crypto';
import { Type } from '@google/genai';
import type { CariKart, Personel } from '../types/erp';
import { extractPdfTextLayout } from '../lib/pdfTextLayout';
import {
  assembleTaseronGrupFromParts,
  buildTaseronCikisTalepDoc,
  buildTaseronGirisTalepDoc,
  findOpenTaseronGrupTalep,
  findTaseronPersonelByTc,
  parseSgkEBildirgeText,
  resolveTaseronGrupFirmaAdi,
  TASERON_GRUP_KAYNAK,
  TASERON_GRUP_OTOMASYON,
  taseronGrupKuyrukHazir,
  taseronGrupParseHasIdentity,
  type TaseronGrupParse,
  type TaseronGrupTalepKayit,
} from '../lib/taseronGrupSablon';
import { generateGeminiWithFallback } from './geminiGenerate';
import { getFirebaseAdmin, isFirebaseAdminConfigured } from './firebaseAdmin';

const GEMINI_PROMPT = `
This is ONE official Turkish SGK e-Bildirge PDF (JasperReports / iText) from the Arnavutköy İşe Giriş WhatsApp group.
Titles are exactly:
- "SİGORTALI İŞE GİRİŞ BİLDİRGESİ" → yon=giris. Date = field 16 "Sigortalının işe başladığı tarih" (DD.MM.YYYY).
- "SİGORTALI İŞTEN AYRILIŞ BİLDİRGESİ" → yon=cikis. Date = field 15 "Sigortalının İşten Ayrılış Tarihi" (DD.MM.YYYY).
Never a weekly roster. Prefer the TITLE if both dates appear.

Extract yon, firmaAdi (işveren ünvanı, not address), isGorev (meslek without numeric code),
ad (field 1), soyad (field 2), tcNo (11 digits), tarih (YYYY-MM-DD).
`;

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export function intakeSecretOk(headerVal?: string | string[]): boolean {
  const expected = String(process.env.TASERON_GRUP_INTAKE_SECRET || '').trim();
  if (!expected) return false;
  const got = String(Array.isArray(headerVal) ? headerVal[0] : headerVal || '').trim();
  if (!got || got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function isTaseronGrupIntakeConfigured(): boolean {
  return Boolean(String(process.env.TASERON_GRUP_INTAKE_SECRET || '').trim());
}

export function isWhatsAppTaseronWebhookConfigured(): boolean {
  return Boolean(
    String(process.env.WHATSAPP_VERIFY_TOKEN || '').trim() &&
      String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim()
  );
}

async function geminiFill(
  fileBase64: string,
  mimeType: string,
  fileName: string
): Promise<Partial<TaseronGrupParse>> {
  const { text } = await generateGeminiWithFallback({
    contents: [
      { inlineData: { mimeType, data: fileBase64 } },
      `${GEMINI_PROMPT}\nFile name: ${fileName}`,
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          yon: { type: Type.STRING },
          firmaAdi: { type: Type.STRING },
          isGorev: { type: Type.STRING },
          ad: { type: Type.STRING },
          soyad: { type: Type.STRING },
          tcNo: { type: Type.STRING },
          tarih: { type: Type.STRING },
        },
        required: ['yon', 'ad', 'soyad', 'tarih'],
      },
    },
    label: 'Taşeron grup evrak analizi',
  });
  return JSON.parse(text) as Partial<TaseronGrupParse>;
}

export async function parseTaseronGrupUpload(opts: {
  fileBase64: string;
  mimeType: string;
  fileName?: string;
  caption?: string;
}): Promise<{ parsed: TaseronGrupParse; source: string }> {
  const fileName = String(opts.fileName || '');
  const caption = String(opts.caption || '');
  let fromPdf: Partial<TaseronGrupParse> = {};
  if (/pdf/i.test(opts.mimeType) || /\.pdf$/i.test(fileName)) {
    try {
      fromPdf = parseSgkEBildirgeText(extractPdfTextLayout(Buffer.from(opts.fileBase64, 'base64')));
    } catch (e) {
      console.warn('taşeron grup PDF metin çıkarma atlandı:', e);
    }
  }
  const textOnly = assembleTaseronGrupFromParts({ fromPdf, fileName, caption });
  const textComplete = taseronGrupParseHasIdentity(textOnly) && Boolean(textOnly.firmaAdi && (textOnly.tcNo || textOnly.tarih));
  if (textComplete) {
    return { parsed: textOnly, source: 'pdf-text' };
  }
  try {
    const fromGemini = await geminiFill(opts.fileBase64, opts.mimeType, fileName);
    return {
      parsed: assembleTaseronGrupFromParts({ fromPdf, fromGemini, fileName, caption }),
      source: 'pdf-text+gemini',
    };
  } catch (err) {
    if (taseronGrupParseHasIdentity(textOnly) || textOnly.tcNo) {
      return { parsed: textOnly, source: 'pdf-text' };
    }
    throw err;
  }
}

async function loadKuruluFromAdmin(): Promise<{ cariKartlar: CariKart[]; personeller: Personel[] }> {
  if (!isFirebaseAdminConfigured()) return { cariKartlar: [], personeller: [] };
  const db = getFirebaseAdmin().firestore();
  const [cariSnap, persSnap] = await Promise.all([
    db.collection('cariKartlar').get(),
    db.collection('personeller').get(),
  ]);
  return {
    cariKartlar: cariSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as CariKart),
    personeller: persSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Personel),
  };
}

export async function enqueueTaseronGrupParse(opts: {
  parsed: TaseronGrupParse;
  evrakDataUrl?: string;
  gonderen: string;
}): Promise<{ id: string; duplicate?: boolean; skipped?: string }> {
  if (!isFirebaseAdminConfigured()) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON yok — kuyruk sunucudan yazılamaz.');
  }
  const { cariKartlar, personeller } = await loadKuruluFromAdmin();
  const parsed: TaseronGrupParse = {
    ...opts.parsed,
    firmaAdi: resolveTaseronGrupFirmaAdi(opts.parsed.firmaAdi, cariKartlar, personeller),
  };
  if (!taseronGrupKuyrukHazir(parsed)) {
    return { id: '', skipped: 'ad/soyad/firma/tarih eksik' };
  }
  const db = getFirebaseAdmin().firestore();
  const col = parsed.yon === 'cikis' ? 'personelCikisTalepleri' : 'personelGirisTalepleri';
  const pendingSnap = await db.collection(col).get();
  const pending = pendingSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as TaseronGrupTalepKayit[];
  const open = findOpenTaseronGrupTalep(pending, parsed);
  if (open?.id) {
    return { id: String(open.id), duplicate: true };
  }
  const gonderen = opts.gonderen || 'otomasyon';
  if (parsed.yon === 'cikis') {
    const id = `CIKIS-${TASERON_GRUP_KAYNAK}-${Date.now()}`;
    const hit = findTaseronPersonelByTc(personeller, parsed.tcNo);
    const doc = stripUndefined(
      buildTaseronCikisTalepDoc({
        id,
        parsed,
        evrakUrl: opts.evrakDataUrl,
        gonderen,
        personelId: hit?.id,
      })
    );
    await db.collection(col).doc(id).set(doc);
    return { id };
  }
  const id = `GIRIS-${TASERON_GRUP_KAYNAK}-${Date.now()}`;
  const doc = stripUndefined(
    buildTaseronGirisTalepDoc({ id, parsed, evrakUrl: opts.evrakDataUrl, gonderen })
  );
  await db.collection(col).doc(id).set(doc);
  return { id };
}

export function taseronGrupOtomasyonSozlesme() {
  return {
    ...TASERON_GRUP_OTOMASYON,
    intakeSecretConfigured: isTaseronGrupIntakeConfigured(),
    whatsappConfigured: isWhatsAppTaseronWebhookConfigured(),
    adminConfigured: isFirebaseAdminConfigured(),
    not: 'Mevcut WhatsApp grubu dinlenmez. Otomasyon bu sözleşmeyle PDF gönderir; kadro Onay’da yazılır.',
  };
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<{ base64: string; mimeType: string }> {
  const token = String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN yok');
  const metaRes = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(mediaId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) throw new Error(`WhatsApp media meta ${metaRes.status}`);
  const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!meta.url) throw new Error('WhatsApp media url yok');
  const binRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!binRes.ok) throw new Error(`WhatsApp media indirilemedi ${binRes.status}`);
  const buf = Buffer.from(await binRes.arrayBuffer());
  return { base64: buf.toString('base64'), mimeType: meta.mime_type || 'application/pdf' };
}

type WaMessage = {
  type?: string;
  from?: string;
  text?: { body?: string };
  document?: { id?: string; filename?: string; caption?: string; mime_type?: string };
  image?: { id?: string; caption?: string; mime_type?: string };
};

export async function handleWhatsAppTaseronMessages(messages: WaMessage[]): Promise<{ processed: number; queued: number; skipped: number }> {
  let processed = 0;
  let queued = 0;
  let skipped = 0;
  for (const msg of messages) {
    const doc = msg.document;
    const img = msg.type === 'image' ? msg.image : undefined;
    const mediaId = doc?.id || img?.id;
    if (!mediaId) {
      skipped += 1;
      continue;
    }
    processed += 1;
    try {
      const media = await downloadWhatsAppMedia(mediaId);
      const fileName = doc?.filename || '';
      const caption = String(doc?.caption || img?.caption || msg.text?.body || '');
      const { parsed } = await parseTaseronGrupUpload({
        fileBase64: media.base64,
        mimeType: media.mimeType || doc?.mime_type || img?.mime_type || 'application/pdf',
        fileName,
        caption,
      });
      const evrakDataUrl = `data:${media.mimeType};base64,${media.base64}`;
      const result = await enqueueTaseronGrupParse({
        parsed,
        evrakDataUrl,
        gonderen: msg.from ? `wa:${msg.from}` : 'whatsapp-otomasyon',
      });
      if (result.id && !result.skipped) queued += 1;
      else skipped += 1;
    } catch (err) {
      console.warn('WhatsApp taşeron mesaj atlandı:', err);
      skipped += 1;
    }
  }
  return { processed, queued, skipped };
}
