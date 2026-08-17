import type { Personel } from '../types/erp';

/** Firestore'a yazılmamalı — yalnızca bellek içi foto/PDF tutucu. */
export const PERSONEL_MEDIA_CACHE_SENTINEL = '__media_cache__';

const MAX_INLINE_MEDIA = 80_000;

type PersonelMedia = {
  fotografUrl?: string;
  sigortaEvrakUrl?: string;
};

const mediaById = new Map<string, PersonelMedia>();

function isHeavyDataUrl(value: string): boolean {
  return value.startsWith('data:') && value.length > MAX_INLINE_MEDIA;
}

export function isUsablePersonelMediaUrl(value?: string | null): boolean {
  const raw = String(value || '').trim();
  if (!raw || raw === PERSONEL_MEDIA_CACHE_SENTINEL) return false;
  return (
    raw.startsWith('data:') ||
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('blob:')
  );
}

export function cachePersonelMedia(id: string, patch: PersonelMedia): void {
  if (!id) return;
  const prev = mediaById.get(id) || {};
  mediaById.set(id, { ...prev, ...patch });
}

export function getCachedPersonelMedia(id: string): PersonelMedia | undefined {
  return mediaById.get(id);
}

export function personelFotoSrc(personel: Personel): string {
  const raw = String(personel.fotografUrl || (personel as Personel & { fotograf_url?: string }).fotograf_url || '').trim();
  if (isUsablePersonelMediaUrl(raw)) return raw;
  return String(mediaById.get(personel.id)?.fotografUrl || '').trim();
}

export function personelSigortaSrc(personel: Personel): string {
  const raw = String(personel.sigortaEvrakUrl || '').trim();
  if (isUsablePersonelMediaUrl(raw)) return raw;
  return String(mediaById.get(personel.id)?.sigortaEvrakUrl || '').trim();
}

/** Liste state'inden megabaytlık data URL'leri çıkar; kartlar bellek önbelleğinden okur. */
export function detachHeavyPersonelMedia(list: Personel[]): Personel[] {
  if (!list.length) return list;
  let changed = false;
  const next = list.map((p) => {
    const foto = String(p.fotografUrl || '');
    const sigorta = String(p.sigortaEvrakUrl || '');
    const fotoHeavy = isHeavyDataUrl(foto);
    const sigortaHeavy = isHeavyDataUrl(sigorta);
    if (!fotoHeavy && !sigortaHeavy) return p;
    changed = true;
    cachePersonelMedia(p.id, {
      ...(fotoHeavy ? { fotografUrl: foto } : {}),
      ...(sigortaHeavy ? { sigortaEvrakUrl: sigorta } : {}),
    });
    return {
      ...p,
      fotografUrl: fotoHeavy ? PERSONEL_MEDIA_CACHE_SENTINEL : p.fotografUrl,
      sigortaEvrakUrl: sigortaHeavy ? PERSONEL_MEDIA_CACHE_SENTINEL : p.sigortaEvrakUrl,
    };
  });
  return changed ? next : list;
}

export function richerPersonelMediaUrl(a?: string, b?: string): string | undefined {
  const aOk = isUsablePersonelMediaUrl(a) || a === PERSONEL_MEDIA_CACHE_SENTINEL;
  const bOk = isUsablePersonelMediaUrl(b) || b === PERSONEL_MEDIA_CACHE_SENTINEL;
  if (aOk && isUsablePersonelMediaUrl(a)) return a;
  if (bOk && isUsablePersonelMediaUrl(b)) return b;
  if (aOk) return a;
  if (bOk) return b;
  return a || b;
}
