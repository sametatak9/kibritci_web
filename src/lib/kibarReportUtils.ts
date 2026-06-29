import { SahaFaaliyeti } from '../types/erp';

const TURKISH_DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

export function formatReportDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  const dayName = TURKISH_DAYS[dt.getDay()] ?? '';
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}${dayName ? ` (${dayName})` : ''}`;
}

export function formatPersonelSayisi(sf: SahaFaaliyeti): string {
  const parts: string[] = [];
  if (sf.ustaSayisi) parts.push(`${sf.ustaSayisi} usta`);
  if (sf.isciSayisi) parts.push(`${sf.isciSayisi} düz işçi`);
  return parts.length ? parts.join(', ') : '—';
}

export function faaliyetIsTanimi(sf: SahaFaaliyeti): string {
  return (sf.isNiteligi || sf.aciklama || '').replace(/\s+/g, ' ').trim() || '—';
}

export function faaliyetParsel(sf: SahaFaaliyeti): string {
  return (sf.parsel || '').replace(/^Parsel Bölge\s+/i, '').trim() || '—';
}

export function faaliyetBlok(sf: SahaFaaliyeti): string {
  if (!sf.blok || sf.blok === 'GENEL SAHA') return '—';
  return sf.blok;
}

export interface FaaliyetRaporSatiri extends SahaFaaliyeti {
  siraNo: number;
  tarihLabel: string;
  parselKisa: string;
  blokKisa: string;
}

/** Tarih sırası (eskiden yeniye) — her kayıt ayrı satır */
export function prepareSahaFaaliyetRaporu(items: SahaFaaliyeti[]): FaaliyetRaporSatiri[] {
  const sorted = [...items].sort((a, b) => {
    const cmp = (a.tarih || '').localeCompare(b.tarih || '');
    if (cmp !== 0) return cmp;
    return faaliyetIsTanimi(a).localeCompare(faaliyetIsTanimi(b), 'tr');
  });

  return sorted.map((sf, idx) => ({
    ...sf,
    siraNo: idx + 1,
    tarihLabel: formatReportDate(sf.tarih || ''),
    parselKisa: faaliyetParsel(sf),
    blokKisa: faaliyetBlok(sf),
  }));
}

export interface KampFaaliyetSatiri {
  id: string;
  tarih: string;
  tarihLabel: string;
  faaliyetTipi: string;
  aciklama: string;
  siraNo: number;
}

export function prepareKampFaaliyetRaporu(items: { id?: string; tarih?: string; faaliyetTipi?: string; aciklama?: string }[]): KampFaaliyetSatiri[] {
  const sorted = [...items].sort((a, b) => (a.tarih || '').localeCompare(b.tarih || ''));
  return sorted.map((kf, idx) => ({
    id: kf.id || `kamp-${idx}`,
    tarih: kf.tarih || '',
    tarihLabel: formatReportDate(kf.tarih || ''),
    faaliyetTipi: kf.faaliyetTipi || '—',
    aciklama: kf.aciklama || '—',
    siraNo: idx + 1,
  }));
}
