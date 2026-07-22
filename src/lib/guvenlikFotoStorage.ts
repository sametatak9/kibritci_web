import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { storage } from './firebase';
import type { GuvenlikFotoMetod, GuvenlikFotoPaket, GuvenlikFotoSlot } from './guvenlikEvrakFotolar';
import { compressImage } from './imageCompress';

function extForSlot(slot: GuvenlikFotoSlot): string {
  const t = (slot.fileType || '').toLowerCase();
  if (t.includes('pdf')) return 'pdf';
  if (t.includes('png')) return 'png';
  if (t.includes('webp')) return 'webp';
  return 'jpg';
}

/** data URL veya http(s) — Storage’a yükler; başarısızsa sıkıştırılmış data URL döner. */
export async function uploadGuvenlikFotoSlot(
  docId: string,
  slot: GuvenlikFotoSlot
): Promise<GuvenlikFotoSlot> {
  const raw = String(slot.dataUrl || '').trim();
  if (!raw) return slot;
  if (/^https?:\/\//i.test(raw)) return slot;

  let payload = raw;
  if ((slot.fileType || '').startsWith('image/') || raw.startsWith('data:image/')) {
    try {
      payload = await compressImage(raw, 720, 720, 0.58);
    } catch {
      /* keep original */
    }
  }

  try {
    const path = `guvenlik-evrak/${docId}/${slot.metod}/${slot.id}.${extForSlot(slot)}`;
    const storageRef = ref(storage, path);
    await uploadString(storageRef, payload, 'data_url', {
      contentType: slot.fileType || (payload.startsWith('data:image/') ? 'image/jpeg' : 'application/octet-stream'),
      customMetadata: {
        metod: slot.metod,
        fileName: slot.fileName || '',
      },
    });
    const url = await getDownloadURL(storageRef);
    return { ...slot, dataUrl: url };
  } catch (err) {
    console.warn('Güvenlik foto Storage yüklemesi başarısız, data URL kullanılacak:', slot.fileName, err);
    return { ...slot, dataUrl: payload };
  }
}

export async function uploadGuvenlikFotoPaket(
  docId: string,
  paket: GuvenlikFotoPaket
): Promise<GuvenlikFotoPaket> {
  const mapSlots = async (slots: GuvenlikFotoSlot[]) =>
    Promise.all((slots || []).map((s) => uploadGuvenlikFotoSlot(docId, s)));

  const [kalemFotolar, firmaFotolar, faturaFotolar] = await Promise.all([
    mapSlots(paket.kalemFotolar || []),
    mapSlots(paket.firmaFotolar || []),
    mapSlots(paket.faturaFotolar || []),
  ]);

  return { kalemFotolar, firmaFotolar, faturaFotolar };
}

/** Firestore doküman boyutu tahmini (UTF-16 ≈ 2 byte/char üst sınır). */
export function estimateFirestoreJsonBytes(value: unknown): number {
  try {
    return JSON.stringify(value).length * 2;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

const FIRESTORE_SAFE_LIMIT = 850_000; // ~850 KB güvenlik payı (limit 1 MB)

export function isFirestorePayloadTooLarge(value: unknown): boolean {
  return estimateFirestoreJsonBytes(value) > FIRESTORE_SAFE_LIMIT;
}

/** Pakette kalan data: URL’leri daha agresif sıkıştır (Storage yoksa son çare). */
export async function aggressiveCompressPaket(
  paket: GuvenlikFotoPaket
): Promise<GuvenlikFotoPaket> {
  const compressSlot = async (slot: GuvenlikFotoSlot): Promise<GuvenlikFotoSlot> => {
    const raw = String(slot.dataUrl || '');
    if (!raw.startsWith('data:image/')) return slot;
    try {
      const dataUrl = await compressImage(raw, 560, 560, 0.45);
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
      const res = await fetch(raw);
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
