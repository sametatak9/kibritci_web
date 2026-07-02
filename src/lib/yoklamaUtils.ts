import { AylikYoklamaMap, GunlukYoklama, Personel, YoklamaDurum } from '../types/erp';

export interface YoklamaGunKaydi {
  durum: YoklamaDurum;
  mesaiSaati: number;
  gonderen?: string;
}

/** GunlukYoklama → iterateMonthYoklama uyumlu kayıt haritası */
export function asYoklamaGunMap(
  personMap: GunlukYoklama | Record<string, YoklamaGunKaydi> | undefined
): Record<string, YoklamaGunKaydi> | undefined {
  if (!personMap) return undefined;
  return personMap as unknown as Record<string, YoklamaGunKaydi>;
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
  return personMap[dateKey];
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

export function personHasYoklamaInMonth(
  personMap: Record<string, YoklamaGunKaydi> | undefined,
  year: number,
  month: number
): boolean {
  let found = false;
  iterateMonthYoklama(personMap, year, month, (_day, data) => {
    if (data?.durum && data.durum !== 'Girilmedi') found = true;
  });
  return found;
}

export function personHasGeldiInMonth(
  personMap: Record<string, YoklamaGunKaydi> | undefined,
  year: number,
  month: number
): boolean {
  let found = false;
  iterateMonthYoklama(personMap, year, month, (_day, data) => {
    if (data?.durum === 'Geldi') found = true;
  });
  return found;
}

/** Yoklama kaydı varsa işe giriş/çıkış filtresini uygulama */
export function isPersonelVisibleInMonth(
  p: Personel,
  year: number,
  month: number,
  personMap?: Record<string, YoklamaGunKaydi>
): boolean {
  const isAktif = p.durum === true || String(p.durum).toLowerCase() === 'true';
  if (p.iseGirisTarihi) {
    const [hireY, hireM] = p.iseGirisTarihi.split('-').map(Number);
    if (hireY > year || (hireY === year && hireM > month)) return false;
  }
  if (p.istenCikisTarihi) {
    const [exitY, exitM] = p.istenCikisTarihi.split('-').map(Number);
    if (exitY < year || (exitY === year && exitM < month)) return false;
  } else if (!isAktif && !p.istenCikisTarihi) {
    return false;
  }
  if (personMap && personHasYoklamaInMonth(personMap, year, month)) return true;
  return true;
}

/** Kayıtlı yoklama varsa hücreyi her zaman göster (harfiyen) */
export function isDayActiveForPersonel(
  p: Personel,
  year: number,
  month: number,
  day: number,
  personMap?: Record<string, YoklamaGunKaydi>
): boolean {
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

  const dayData = personMap ? getYoklamaDay(personMap, year, month, day) : undefined;
  if (dayData?.durum && dayData.durum !== 'Girilmedi') return true;
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

  Object.entries(personMap).forEach(([key, data]) => {
    if (key.startsWith(prefix)) {
      const day = Number(key.slice(prefix.length));
      if (day >= 1 && day <= 31) callback(day, data);
    }
  });
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
  return {
    id: opts?.legacyExcelId != null ? `PRS-LEGACY-L${opts.legacyExcelId}` : `PRS-LEGACY-${stamp}`,
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

export function buildPersonelListForMonth(
  personeller: Personel[],
  yoklamalar: AylikYoklamaMap,
  year: number,
  month: number,
  resolveStub?: (personelId: string) => Personel | undefined
): Personel[] {
  const byId = new Map(personeller.map(p => [p.id, p]));
  const ids = new Set<string>();

  personeller.forEach(p => {
    if (isPersonelVisibleInMonth(p, year, month, asYoklamaGunMap(yoklamalar[p.id]))) ids.add(p.id);
  });
  Object.entries(yoklamalar).forEach(([id, map]) => {
    // Güvenlik: Personel yönetiminde olmayan (orphan / legacy-stub) ID'leri yoklama listesine taşımayız.
    // Bu, "kayıtlı olmayan personel yoklamada görünüyor" ve mükerrer satır riskini azaltır.
    const existing = byId.get(id);
    if (!existing) return;
    const personMap = asYoklamaGunMap(map);
    if (!personHasYoklamaInMonth(personMap, year, month)) return;
    if (!isPersonelVisibleInMonth(existing, year, month, personMap)) return;
    ids.add(id);
  });

  const list = Array.from(ids)
    .map(id => byId.get(id) ?? resolveStub?.(id))
    .filter((p): p is Personel => !!p)
    .sort((a, b) => `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, 'tr'));

  // Aynı kişinin (özellikle legacy/stub ID kaynaklı) birden fazla satır görünmesini engelle.
  const deduped = new Map<string, Personel>();
  const score = (p: Personel): number => {
    let s = 0;
    if ((p.tcNo || '').trim()) s += 100;
    if (!p.id.startsWith('PRS-LEGACY')) s += 50;
    if (p.durum === true || String(p.durum).toLowerCase() === 'true') s += 10;
    return s;
  };

  for (const p of list) {
    const key = (p.tcNo || '').trim() || normalizeTurkishName(`${p.ad} ${p.soyad}`);
    const existing = deduped.get(key);
    if (!existing || score(p) > score(existing)) {
      deduped.set(key, p);
    }
  }

  return Array.from(deduped.values()).sort((a, b) =>
    `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, 'tr')
  );
}
