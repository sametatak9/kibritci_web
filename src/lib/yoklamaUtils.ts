import { AylikYoklamaMap, Personel, YoklamaDurum } from '../types/erp';

export interface YoklamaGunKaydi {
  durum: YoklamaDurum;
  mesaiSaati: number;
  gonderen?: string;
}

export function yoklamaDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseYoklamaDateKey(key: string): { year: number; month: number; day: number } | null {
  const parts = key.split('-');
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

function isLegacyPersonelMap(personMap: Record<string, YoklamaGunKaydi>): boolean {
  return Object.keys(personMap).length > 0 && Object.keys(personMap).every(k => /^\d{1,2}$/.test(k));
}

export function getYoklamaDay(
  personMap: Record<string, YoklamaGunKaydi> | undefined,
  year: number,
  month: number,
  day: number
): YoklamaGunKaydi | undefined {
  if (!personMap) return undefined;
  const dateKey = yoklamaDateKey(year, month, day);
  if (personMap[dateKey]) return personMap[dateKey];
  if (isLegacyPersonelMap(personMap)) {
    return personMap[String(day)] ?? personMap[day as unknown as string];
  }
  return undefined;
}

export function setYoklamaDay(
  personMap: Record<string, YoklamaGunKaydi> | undefined,
  year: number,
  month: number,
  day: number,
  data: YoklamaGunKaydi
): Record<string, YoklamaGunKaydi> {
  const dateKey = yoklamaDateKey(year, month, day);
  return { ...(personMap || {}), [dateKey]: data };
}

const MEANINGFUL_YOKLAMA_DURUM: YoklamaDurum[] = ['Geldi', 'Yok', 'İzinli', 'Raporlu'];

export function personHasYoklamaInMonth(
  personMap: Record<string, YoklamaGunKaydi> | undefined,
  year: number,
  month: number
): boolean {
  let found = false;
  iterateMonthYoklama(personMap, year, month, (_day, data) => {
    if (data?.durum && MEANINGFUL_YOKLAMA_DURUM.includes(data.durum)) found = true;
  });
  return found;
}

export function isPersonelVisibleInMonth(
  p: Personel,
  year: number,
  month: number,
  personMap?: Record<string, YoklamaGunKaydi>
): boolean {
  const isAktif = p.durum === true || String(p.durum).toLowerCase() === 'true';
  let visibleByDates = true;

  if (p.iseGirisTarihi) {
    const [hireY, hireM] = p.iseGirisTarihi.split('-').map(Number);
    if (hireY > year || (hireY === year && hireM > month)) visibleByDates = false;
  }
  if (visibleByDates && p.istenCikisTarihi) {
    const [exitY, exitM] = p.istenCikisTarihi.split('-').map(Number);
    if (exitY < year || (exitY === year && exitM < month)) visibleByDates = false;
  } else if (visibleByDates && !isAktif && !p.istenCikisTarihi) {
    visibleByDates = false;
  }

  if (visibleByDates) return true;
  return personMap ? personHasYoklamaInMonth(personMap, year, month) : false;
}

export function isDayActiveForPersonel(
  p: Personel,
  year: number,
  month: number,
  day: number,
  personMap?: Record<string, YoklamaGunKaydi>
): boolean {
  const dayData = personMap ? getYoklamaDay(personMap, year, month, day) : undefined;
  if (dayData?.durum && MEANINGFUL_YOKLAMA_DURUM.includes(dayData.durum)) return true;

  if (p.iseGirisTarihi) {
    const [hireY, hireM, hireD] = p.iseGirisTarihi.split('-').map(Number);
    const currentDateVal = year * 10000 + month * 100 + day;
    const hireDateVal = hireY * 10000 + hireM * 100 + hireD;
    if (currentDateVal < hireDateVal) return false;
  }
  if (p.istenCikisTarihi) {
    const [exitY, exitM, exitD] = p.istenCikisTarihi.split('-').map(Number);
    const currentDateVal = year * 10000 + month * 100 + day;
    const exitDateVal = exitY * 10000 + exitM * 100 + exitD;
    if (currentDateVal > exitDateVal) return false;
  }
  return true;
}

export function iterateMonthYoklama(
  personMap: Record<string, YoklamaGunKaydi> | undefined,
  year: number,
  month: number,
  callback: (day: number, data: YoklamaGunKaydi) => void
): void {
  if (!personMap) return;
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  let foundDateKeys = false;

  Object.entries(personMap).forEach(([key, data]) => {
    if (key.startsWith(prefix)) {
      foundDateKeys = true;
      const day = Number(key.slice(prefix.length));
      if (day >= 1 && day <= 31) callback(day, data);
    }
  });

  if (!foundDateKeys && isLegacyPersonelMap(personMap)) {
    Object.entries(personMap).forEach(([key, data]) => {
      const day = Number(key);
      if (day >= 1 && day <= 31) callback(day, data);
    });
  }
}

export function migrateLegacyYoklamaMap(
  map: AylikYoklamaMap,
  defaultYear = 2026,
  defaultMonth = 6
): AylikYoklamaMap {
  const migrated: AylikYoklamaMap = {};
  Object.entries(map).forEach(([personelId, personMap]) => {
    if (!personMap || typeof personMap !== 'object') return;
    if (!isLegacyPersonelMap(personMap as Record<string, YoklamaGunKaydi>)) {
      migrated[personelId] = personMap;
      return;
    }
    const nextMap: Record<string, YoklamaGunKaydi> = {};
    Object.entries(personMap as Record<string, YoklamaGunKaydi>).forEach(([dayKey, data]) => {
      const day = Number(dayKey);
      if (day >= 1 && day <= 31) {
        nextMap[yoklamaDateKey(defaultYear, defaultMonth, day)] = data;
      }
    });
    migrated[personelId] = nextMap;
  });
  return migrated;
}

export function normalizeTurkishName(name: string): string {
  return name
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/\s+/g, ' ')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/\s/g, '');
}

export function findPersonelByName(personeller: Personel[], adSoyad: string): Personel | undefined {
  const target = normalizeTurkishName(adSoyad);
  if (!target) return undefined;

  return personeller.find(p => {
    const full = normalizeTurkishName(`${p.ad} ${p.soyad}`);
    return full === target || full.includes(target) || target.includes(full);
  });
}

export function createMinimalPersonel(ad: string, soyad: string, opts?: {
  gorev?: string;
  maas?: number;
  iseGirisTarihi?: string;
  istenCikisTarihi?: string;
  legacyExcelId?: number;
}): Personel {
  const stamp = Date.now().toString().slice(-4);
  const legacySuffix = opts?.legacyExcelId != null ? `-L${opts.legacyExcelId}` : '';
  return {
    id: `PRS-LEGACY${legacySuffix}-${stamp}`,
    tcNo: '',
    ad: ad.trim().toUpperCase(),
    soyad: soyad.trim().toUpperCase(),
    babaAdi: '',
    dogumTarihi: '1990-01-01',
    telefonNo: '',
    eposta: '',
    adres: 'Yüksekova Konut Şantiyesi Kampı',
    il: '',
    ilce: '',
    departman: 'Şantiye',
    gorev: opts?.gorev || 'DÜZ İŞÇİ',
    iseGirisTarihi: opts?.iseGirisTarihi || '2026-02-01',
    istenCikisTarihi: opts?.istenCikisTarihi,
    cinsiyet: 'Erkek',
    maas: opts?.maas ?? 30000,
    ucretTipi: 'Aylık',
    sgkDurumu: 'Sigortasız',
    bankaAdi: '',
    subeAdi: '',
    ibanNo: '',
    durum: !opts?.istenCikisTarihi,
  };
}
