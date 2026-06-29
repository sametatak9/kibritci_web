import { SahaFaaliyeti } from '../types/erp';
import {
  MAYIS_2026_SAHA_FAALIYETLERI,
  MAYIS_2026_SAHA_FAALIYET_COUNT,
} from '../data/mayis2026SahaFaaliyetleri';

export const LEGACY_SAHA_FAALIYET_VERSION = 1;
const STORAGE_KEY = 'kibritci_legacy_saha_faaliyet_v';

export function countMayis2026SahaFaaliyet(existing: SahaFaaliyeti[]): number {
  return existing.filter(
    sf => sf.tarih?.startsWith('2026-05') || sf.id?.startsWith('SF-MAY26-')
  ).length;
}

export function mayis2026SahaNeedsBootstrap(existing: SahaFaaliyeti[]): boolean {
  return countMayis2026SahaFaaliyet(existing) < MAYIS_2026_SAHA_FAALIYET_COUNT - 5;
}

export function shouldBootstrapLegacySahaFaaliyet(existing: SahaFaaliyeti[]): boolean {
  if (mayis2026SahaNeedsBootstrap(existing)) return true;
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  return stored !== String(LEGACY_SAHA_FAALIYET_VERSION);
}

export function markLegacySahaFaaliyetBootstrapped(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(LEGACY_SAHA_FAALIYET_VERSION));
  }
}

/** Mayıs 2026 PDF faaliyetlerini mevcut listeye birleştir (SF-MAY26-* id'leri) */
export function bootstrapLegacySahaFaaliyet(existing: SahaFaaliyeti[]): SahaFaaliyeti[] | null {
  if (!shouldBootstrapLegacySahaFaaliyet(existing)) return null;

  const byId = new Map<string, SahaFaaliyeti>();
  existing.forEach(sf => {
    if (!sf.id?.startsWith('SF-MAY26-')) byId.set(sf.id, sf);
  });
  MAYIS_2026_SAHA_FAALIYETLERI.forEach(sf => byId.set(sf.id, sf));

  return Array.from(byId.values());
}
