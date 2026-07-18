import { CariKart } from '../types/erp';

export const ENTO_MADEN_UNVAN = 'Ento Maden';

export type MicirMalzemeTipi = 'MICIR' | 'STABILIZE';

/** Unvan normalize — karşılaştırma için */
export function normalizeFirmaUnvan(name?: string | null): string {
  return String(name || '')
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isEntoMadenFirma(name?: string | null): boolean {
  const n = normalizeFirmaUnvan(name);
  return n.includes('ENTO') && n.includes('MADEN');
}

export function findEntoMadenCari(cariKartlar: CariKart[]): CariKart | undefined {
  return (cariKartlar || []).find((c) => isEntoMadenFirma(c.unvan));
}

export function malzemeTipiLabel(tip?: MicirMalzemeTipi | string | null): string {
  if (tip === 'STABILIZE') return 'Stabilize';
  return 'Mıcır';
}
