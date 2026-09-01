import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { storage } from './firebase';
import { compressImage } from './imageCompress';

const UPLOAD_TIMEOUT_MS = 15000;
const URL_TIMEOUT_MS = 8000;

/** wa.me / WhatsApp metnine konabilecek kalıcı görsel adresi. */
export function isShareableHttpUrl(url?: string | null): boolean {
  const u = String(url || '').trim();
  return /^https?:\/\//i.test(u) && !u.startsWith('data:');
}

export function collectKimlikUrls(opts: {
  kimlikFotoUrl?: string | null;
  kimlikFotoUrls?: Array<string | null | undefined> | null;
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw?: string | null) => {
    const u = String(raw || '').trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };
  for (const u of opts.kimlikFotoUrls || []) push(u);
  push(opts.kimlikFotoUrl);
  return out;
}

export function shareableKimlikUrls(opts: {
  kimlikFotoUrl?: string | null;
  kimlikFotoUrls?: Array<string | null | undefined> | null;
}): string[] {
  return collectKimlikUrls(opts).filter(isShareableHttpUrl);
}

export function isPdfKimlikSrc(src?: string | null): boolean {
  const u = String(src || '').trim();
  return u.startsWith('data:application/pdf') || /\.pdf(\?|#|$)/i.test(u);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} zaman aşımı (${ms}ms)`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function contentTypeOf(dataUrl: string): string {
  if (dataUrl.includes('application/pdf')) return 'application/pdf';
  if (dataUrl.includes('image/png')) return 'image/png';
  if (dataUrl.includes('image/webp')) return 'image/webp';
  return 'image/jpeg';
}

function extOf(contentType: string): string {
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

async function preparePayload(dataUrl: string): Promise<string> {
  const raw = String(dataUrl || '').trim();
  if (!raw) return '';
  if (isShareableHttpUrl(raw)) return raw;
  if (raw.startsWith('data:application/pdf')) return raw;
  if (raw.startsWith('data:image/')) {
    try {
      return await compressImage(raw, 1400, 1400, 0.72, 6000);
    } catch {
      return raw;
    }
  }
  return raw.startsWith('data:') ? raw : `data:image/jpeg;base64,${raw}`;
}

/**
 * Kimliği Firebase Storage'a yükler; getDownloadURL token'lı HTTPS verir (WhatsApp'tan tıklanır).
 * Mevcut storage.rules `guvenlik-evrak/**` yazmaya izin verdiği için o önek kullanılır.
 */
export async function uploadPersonelKimlikFoto(opts: {
  talepId: string;
  dataUrl: string;
  slot?: 'on' | 'arka' | string;
}): Promise<string> {
  const raw = String(opts.dataUrl || '').trim();
  if (!raw) return '';
  if (isShareableHttpUrl(raw)) return raw;

  const payload = await preparePayload(raw);
  const ct = contentTypeOf(payload);
  const slot = String(opts.slot || 'on').replace(/[^\w-]/g, '') || 'on';
  const safeId = String(opts.talepId || 'pending').replace(/[^\w.-]/g, '_') || 'pending';
  const path = `guvenlik-evrak/personel-kimlik/${safeId}/${slot}_${Date.now()}.${extOf(ct)}`;
  const storageRef = ref(storage, path);

  await withTimeout(
    uploadString(storageRef, payload, 'data_url', { contentType: ct }),
    UPLOAD_TIMEOUT_MS,
    'Kimlik Storage'
  );
  return withTimeout(getDownloadURL(storageRef), URL_TIMEOUT_MS, 'Kimlik downloadURL');
}

export async function uploadPersonelKimlikFotolar(opts: {
  talepId: string;
  dataUrls: string[];
}): Promise<string[]> {
  const slots = ['on', 'arka'] as const;
  const out: string[] = [];
  for (let i = 0; i < opts.dataUrls.length; i++) {
    const src = opts.dataUrls[i];
    if (!src) continue;
    out.push(await uploadPersonelKimlikFoto({ talepId: opts.talepId, dataUrl: src, slot: slots[i] || `ek_${i}` }));
  }
  return out.filter(Boolean);
}

export function dataUrlToFile(dataUrl: string, filename: string): File | null {
  const raw = String(dataUrl || '').trim();
  if (!raw.startsWith('data:') || typeof atob !== 'function') return null;
  const comma = raw.indexOf(',');
  if (comma < 0) return null;
  const header = raw.slice(0, comma);
  const b64 = raw.slice(comma + 1);
  const mimeMatch = header.match(/data:([^;]+)/i);
  const mime = mimeMatch?.[1] || 'image/jpeg';
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
  } catch {
    return null;
  }
}
