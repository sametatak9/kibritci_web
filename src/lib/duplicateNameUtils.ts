import { CariKart, StokKart } from '../types/erp';

export function normalizeCardName(name: string): string {
  return name.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
}

export function findDuplicateCariNames(cariKartlar: CariKart[], name: string, excludeId?: string): CariKart[] {
  const n = normalizeCardName(name);
  if (!n) return [];
  return cariKartlar.filter(
    (c) => c.id !== excludeId && normalizeCardName(c.unvan) === n
  );
}

export function findDuplicateStokNames(stokKartlar: StokKart[], name: string, excludeId?: string): StokKart[] {
  const n = normalizeCardName(name);
  if (!n) return [];
  return stokKartlar.filter(
    (s) => s.id !== excludeId && normalizeCardName(s.stokAdi) === n
  );
}

export function formatDuplicateCariWarning(matches: CariKart[]): string {
  const list = matches.map((m) => `"${m.unvan}" (${m.kod})`).join(', ');
  return `Bu cari unvanı sistemde tekrar ediyor: ${list}. Lütfen ismi değiştirin veya mevcut kartı kullanın.`;
}

export function formatDuplicateStokWarning(matches: StokKart[]): string {
  const list = matches.map((m) => `"${m.stokAdi}" (${m.stokKodu})`).join(', ');
  return `Bu stok adı sistemde tekrar ediyor: ${list}. Lütfen ismi değiştirin veya mevcut kartı seçin.`;
}

export function warnIfDuplicateCari(cariKartlar: CariKart[], name: string, excludeId?: string): boolean {
  const dup = findDuplicateCariNames(cariKartlar, name, excludeId);
  if (dup.length === 0) return false;
  alert(formatDuplicateCariWarning(dup));
  return true;
}

export function warnIfDuplicateStok(stokKartlar: StokKart[], name: string, excludeId?: string): boolean {
  const dup = findDuplicateStokNames(stokKartlar, name, excludeId);
  if (dup.length === 0) return false;
  alert(formatDuplicateStokWarning(dup));
  return true;
}
