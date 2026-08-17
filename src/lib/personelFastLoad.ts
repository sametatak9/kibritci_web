import type { Personel } from '../types/erp';
import { auth } from './firebase';
import {
  detachHeavyPersonelMedia,
  richerPersonelMediaUrl,
} from './personelMediaCache';
import { toLeanPersonelRecord } from './personelLeanFields';

export { PERSONEL_LEAN_FIELDS, toLeanPersonelRecord } from './personelLeanFields';

const PERSONEL_OZET_CACHE_KEY = 'kibritci_personel_ozet_v2';
const PERSONEL_OZET_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type PersonelOzetCache = {
  savedAt: number;
  personeller: Personel[];
};

export function readCachedPersonelOzet(): Personel[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PERSONEL_OZET_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersonelOzetCache;
    if (!parsed || !Array.isArray(parsed.personeller)) return [];
    if (Date.now() - Number(parsed.savedAt || 0) > PERSONEL_OZET_MAX_AGE_MS) return [];
    return parsed.personeller.filter((p) => p && typeof p.id === 'string' && p.id);
  } catch {
    return [];
  }
}

export function writeCachedPersonelOzet(list: Personel[]): void {
  if (typeof localStorage === 'undefined') return;
  if (!Array.isArray(list) || list.length < 5) return;
  const lean = list.map((p) => toLeanPersonelRecord(p.id, p as unknown as Record<string, unknown>));
  try {
    localStorage.setItem(
      PERSONEL_OZET_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), personeller: lean } satisfies PersonelOzetCache)
    );
  } catch {
    try {
      localStorage.removeItem(PERSONEL_OZET_CACHE_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function mergePersonelLists(prev: Personel[], incoming: Personel[]): Personel[] {
  if (!incoming.length) return prev;
  if (!prev.length) return detachHeavyPersonelMedia(incoming);
  if (prev.length >= 20 && incoming.length < Math.max(5, Math.floor(prev.length * 0.25))) {
    return prev;
  }
  const prevMap = new Map(prev.map((p) => [p.id, p]));
  const merged = incoming.map((p) => {
    const old = prevMap.get(p.id);
    if (!old) return p;
    return {
      ...old,
      ...p,
      fotografUrl: richerPersonelMediaUrl(p.fotografUrl, old.fotografUrl),
      sigortaEvrakUrl: richerPersonelMediaUrl(p.sigortaEvrakUrl, old.sigortaEvrakUrl),
    };
  });
  return detachHeavyPersonelMedia(merged);
}

export async function fetchPersonelOzetFromApi(): Promise<Personel[] | null> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return null;
  try {
    const token = await user.getIdToken();
    const res = await fetch('/api/personel-ozet', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { personeller?: Personel[] };
    if (!Array.isArray(json.personeller) || json.personeller.length === 0) return null;
    return json.personeller.filter((p) => p && typeof p.id === 'string' && p.id);
  } catch {
    return null;
  }
}
