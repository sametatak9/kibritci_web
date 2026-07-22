import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { storage } from './firebase';
import type { GuvenlikFotoMetod, GuvenlikFotoPaket, GuvenlikFotoSlot } from './guvenlikEvrakFotolar';
import { compressImage } from './imageCompress';

const STORAGE_UPLOAD_TIMEOUT_MS = 7000;

function extForSlot(slot: GuvenlikFotoSlot): string {
  const t = (slot.fileType || '').toLowerCase();
  if (t.includes('pdf')) return 'pdf';
  if (t.includes('png')) return 'png';
  if (t.includes('webp')) return 'webp';
  return 'jpg';
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

async function compressSlotPayload(slot: GuvenlikFotoSlot): Promise<string> {
  const raw = String(slot.dataUrl || '').trim();
  if (!raw) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if ((slot.fileType || '').startsWith('image/') || raw.startsWith('data:image/')) {
    try {
      return await compressImage(raw, 720, 720, 0.55);
    } catch {
      return raw;
    }
  }
  return raw;
}

/**
 * Fotoğrafı Storage’a yüklemeyi dener; 7 sn içinde olmazsa sıkıştırılmış
 * data URL ile devam eder (gönder butonu takılı kalmasın).
 */
export async function uploadGuvenlikFotoSlot(
  docId: string,
  slot: GuvenlikFotoSlot
): Promise<GuvenlikFotoSlot> {
  const raw = String(slot.dataUrl || '').trim();
  if (!raw) return slot;
  if (/^https?:\/\//i.test(raw)) return slot;

  const payload = await compressSlotPayload(slot);

  // Çok büyük PDF / data URL — Storage’a gönderme (asılabilir); inline sıkıştırılmış kullan
  if (payload.startsWith('data:') && payload.length > 900_000) {
    console.warn('Güvenlik foto çok büyük, Storage atlandı:', slot.fileName);
    return { ...slot, dataUrl: payload };
  }

  try {
    const path = `guvenlik-evrak/${docId}/${slot.metod}/${slot.id}.${extForSlot(slot)}`;
    const storageRef = ref(storage, path);
    await withTimeout(
      uploadString(storageRef, payload, 'data_url', {
        contentType:
          slot.fileType ||
          (payload.startsWith('data:image/') ? 'image/jpeg' : 'application/octet-stream'),
        customMetadata: {
          metod: slot.metod,
          fileName: slot.fileName || '',
        },
      }),
      STORAGE_UPLOAD_TIMEOUT_MS,
      'Storage upload'
    );
    const url = await withTimeout(
      getDownloadURL(storageRef),
      5000,
      'Storage downloadURL'
    );
    return { ...slot, dataUrl: url };
  } catch (err) {
    console.warn(
      'Güvenlik foto Storage atlandı (timeout/izin/ağ), data URL kullanılacak:',
      slot.fileName,
      err
    );
    return { ...slot, dataUrl: payload };
  }
}

export async function uploadGuvenlikFotoPaket(
  docId: string,
  paket: GuvenlikFotoPaket
): Promise<GuvenlikFotoPaket> {
  // Sıralı yükleme: paralel Storage bazı ortamlarda asılıyor / kota yiyor
  const mapSlots = async (slots: GuvenlikFotoSlot[]) => {
    const out: GuvenlikFotoSlot[] = [];
    for (const s of slots || []) {
      out.push(await uploadGuvenlikFotoSlot(docId, s));
    }
    return out;
  };

  return {
    kalemFotolar: await mapSlots(paket.kalemFotolar || []),
    firmaFotolar: await mapSlots(paket.firmaFotolar || []),
    faturaFotolar: await mapSlots(paket.faturaFotolar || []),
  };
}

/** Firestore doküman boyutu tahmini (UTF-16 ≈ 2 byte/char üst sınır). */
export function estimateFirestoreJsonBytes(value: unknown): number {
  try {
    return JSON.stringify(value).length * 2;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

const FIRESTORE_SAFE_LIMIT = 850_000;

export function isFirestorePayloadTooLarge(value: unknown): boolean {
  return estimateFirestoreJsonBytes(value) > FIRESTORE_SAFE_LIMIT;
}

/** Pakette kalan data URL’leri daha agresif sıkıştır (Storage yoksa son çare). */
export async function aggressiveCompressPaket(
  paket: GuvenlikFotoPaket
): Promise<GuvenlikFotoPaket> {
  const compressSlot = async (slot: GuvenlikFotoSlot): Promise<GuvenlikFotoSlot> => {
    const raw = String(slot.dataUrl || '');
    if (!raw.startsWith('data:image/')) return slot;
    try {
      const dataUrl = await compressImage(raw, 480, 480, 0.4);
      return { ...slot, dataUrl };
    } catch {
      return slot;
    }
  };
  return {
    kalemFotolar: await Promise.all((paket.kalemFotolar || []).map(compressSlot)),
    firmaFotolar: await Promise.all((paket.firmaFotolar || []).map(compressSlot)),
    faturaFotolar: await Promise.all((paket.faturaFotolar || []).map(compressSlot)),
  };
}

/**
 * Firestore’a yazılacak yalın paket: aynı görseli 3 kez kopyalamaz.
 * fotoUrl = primary; fotoUrls yalnızca http(s) ise doldurulur (inline’da slot’lar yeterli).
 */
export function buildLeanGuvenlikEvrakFotoFields(paket: GuvenlikFotoPaket): {
  kalemFotolar: GuvenlikFotoSlot[];
  firmaFotolar: GuvenlikFotoSlot[];
  faturaFotolar: GuvenlikFotoSlot[];
  fotoUrl: string;
  fotoUrls: string[];
  storageBackend: string;
} {
  const kalemFotolar = paket.kalemFotolar || [];
  const firmaFotolar = paket.firmaFotolar || [];
  const faturaFotolar = paket.faturaFotolar || [];
  const all = [...kalemFotolar, ...firmaFotolar, ...faturaFotolar];
  const fotoUrl = all[0]?.dataUrl || '';
  const httpUrls = all.map((s) => s.dataUrl).filter((u) => /^https?:\/\//i.test(u));
  const storageBackend = httpUrls.length > 0 ? 'FIREBASE_STORAGE' : 'INLINE_DATA_URL';
  return {
    kalemFotolar,
    firmaFotolar,
    faturaFotolar,
    fotoUrl,
    // Inline data URL’leri fotoUrls’de tekrar etme (Firestore 1MB)
    fotoUrls: httpUrls.length ? Array.from(new Set(httpUrls)) : fotoUrl ? [fotoUrl] : [],
    storageBackend,
  };
}

export function metodLabelShort(metod: GuvenlikFotoMetod): string {
  if (metod === 'KALEM') return 'Kalem';
  if (metod === 'FIRMA') return 'Firma';
  return 'Fatura';
}

/** YZ API için data URL veya http(s) → base64 payload. */
export async function toAiParsePayload(
  url: string
): Promise<{ fileBase64: string; mimeType: string } | null> {
  const raw = String(url || '').trim();
  if (!raw) return null;

  if (raw.startsWith('data:')) {
    const parts = raw.split(',');
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/data:(.*?);base64/);
    return {
      mimeType: mimeMatch?.[1] || 'image/jpeg',
      fileBase64: parts[1],
    };
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const res = await withTimeout(fetch(raw), 8000, 'YZ foto fetch');
      if (!res.ok) return null;
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return toAiParsePayload(dataUrl);
    } catch (err) {
      console.warn('YZ için foto indirilemedi:', err);
      return null;
    }
  }

  return null;
}
