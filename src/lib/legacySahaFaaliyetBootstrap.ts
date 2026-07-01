import { SahaFaaliyeti } from '../types/erp';
import {
  MAYIS_2026_SAHA_FAALIYETLERI,
  MAYIS_2026_SAHA_FAALIYET_COUNT,
} from '../data/mayis2026SahaFaaliyetleri';
import {
  HAZIRAN_2026_SAHA_FAALIYETLERI,
  HAZIRAN_2026_SAHA_FAALIYET_COUNT,
} from '../data/haziran2026SahaFaaliyetleri';

export const LEGACY_SAHA_FAALIYET_VERSION = 3;
const STORAGE_KEY = 'kibritci_legacy_saha_faaliyet_v';

const LEGACY_PREFIXES = ['SF-MAY26-', 'SF-HAZ26-'];

function isLegacyImportId(id: string | undefined): boolean {
  return LEGACY_PREFIXES.some(p => id?.startsWith(p));
}

export function countMayis2026SahaFaaliyet(existing: SahaFaaliyeti[]): number {
  return existing.filter(
    sf => sf.tarih?.startsWith('2026-05') || sf.id?.startsWith('SF-MAY26-')
  ).length;
}

export function countHaziran2026SahaFaaliyet(existing: SahaFaaliyeti[]): number {
  return existing.filter(
    sf => sf.tarih?.startsWith('2026-06') || sf.id?.startsWith('SF-HAZ26-')
  ).length;
}

export function mayis2026SahaNeedsBootstrap(existing: SahaFaaliyeti[]): boolean {
  return countMayis2026SahaFaaliyet(existing) < MAYIS_2026_SAHA_FAALIYET_COUNT - 5;
}

export function haziran2026SahaNeedsBootstrap(existing: SahaFaaliyeti[]): boolean {
  return HAZIRAN_2026_SAHA_FAALIYET_COUNT > 0
    && countHaziran2026SahaFaaliyet(existing) < HAZIRAN_2026_SAHA_FAALIYET_COUNT - 5;
}

export function shouldBootstrapLegacySahaFaaliyet(existing: SahaFaaliyeti[]): boolean {
  if (mayis2026SahaNeedsBootstrap(existing)) return true;
  if (haziran2026SahaNeedsBootstrap(existing)) return true;
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  return stored !== String(LEGACY_SAHA_FAALIYET_VERSION);
}

export function markLegacySahaFaaliyetBootstrapped(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(LEGACY_SAHA_FAALIYET_VERSION));
  }
}

/** Mayıs + Haziran legacy PDF faaliyetlerini mevcut listeye birleştir */
export function bootstrapLegacySahaFaaliyet(existing: SahaFaaliyeti[]): SahaFaaliyeti[] | null {
  if (!shouldBootstrapLegacySahaFaaliyet(existing)) return null;

  const byId = new Map<string, SahaFaaliyeti>();
  existing.forEach(sf => {
    if (!isLegacyImportId(sf.id)) byId.set(sf.id, sf);
  });
  MAYIS_2026_SAHA_FAALIYETLERI.forEach(sf => byId.set(sf.id, sf));
  HAZIRAN_2026_SAHA_FAALIYETLERI.forEach(sf => byId.set(sf.id, sf));

  return Array.from(byId.values());
}
