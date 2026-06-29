import { AylikYoklamaMap, Personel } from '../types/erp';
import { LegacyExcelMonthData, LegacyExcelPersonRecord } from '../data/legacyExcelYoklama';
import {
  createMinimalPersonel,
  findPersonelByName,
  normalizeTurkishName,
  setYoklamaDay,
  yoklamaDateKey,
} from './yoklamaUtils';

export interface LegacyImportResult {
  yoklamalar: AylikYoklamaMap;
  personeller: Personel[];
  createdPersonel: string[];
  matchedPersonel: string[];
  skippedDuplicates: number;
  importedDays: number;
  warnings: string[];
}

function splitAdSoyad(ad: string, soyad: string): { ad: string; soyad: string } {
  if (soyad.trim()) return { ad: ad.trim(), soyad: soyad.trim() };
  const parts = ad.trim().split(/\s+/);
  if (parts.length <= 1) return { ad: parts[0] || ad, soyad: '' };
  return { ad: parts.slice(0, -1).join(' '), soyad: parts[parts.length - 1] };
}

function resolvePersonelForLegacyRecord(
  record: LegacyExcelPersonRecord,
  personeller: Personel[],
  excelIdToPersonelId: Map<number, string>
): { personel: Personel; created: boolean } {
  const cachedId = excelIdToPersonelId.get(record.excelId);
  if (cachedId) {
    const cached = personeller.find(p => p.id === cachedId);
    if (cached) return { personel: cached, created: false };
  }

  const fullName = `${record.ad} ${record.soyad}`.trim();
  const matched = findPersonelByName(personeller, fullName);
  if (matched) {
    excelIdToPersonelId.set(record.excelId, matched.id);
    return { personel: matched, created: false };
  }

  const { ad, soyad } = splitAdSoyad(record.ad, record.soyad);
  const created = createMinimalPersonel(ad, soyad, {
    gorev: record.gorev,
    maas: record.maas,
    iseGirisTarihi: record.iseGirisTarihi || `${record.istenCikisTarihi?.slice(0, 7) || '2026-02'}-01`,
    istenCikisTarihi: record.istenCikisTarihi,
    legacyExcelId: record.excelId,
  });
  excelIdToPersonelId.set(record.excelId, created.id);
  return { personel: created, created: true };
}

function isSunday(year: number, month: number, day: number): boolean {
  return new Date(year, month - 1, day).getDay() === 0;
}

export function importLegacyExcelMonth(
  monthData: LegacyExcelMonthData,
  existingPersoneller: Personel[],
  existingYoklamalar: AylikYoklamaMap
): LegacyImportResult {
  const { year, month } = monthData;
  const personeller = [...existingPersoneller];
  const yoklamalar: AylikYoklamaMap = JSON.parse(JSON.stringify(existingYoklamalar || {}));
  const excelIdToPersonelId = new Map<number, string>();
  const createdPersonel: string[] = [];
  const matchedPersonel: string[] = [];
  const warnings: string[] = [];
  let skippedDuplicates = 0;
  let importedDays = 0;

  const daysInMonth = new Date(year, month, 0).getDate();

  monthData.personeller.forEach(record => {
    const { personel, created } = resolvePersonelForLegacyRecord(record, personeller, excelIdToPersonelId);

    if (created) {
      personeller.push(personel);
      createdPersonel.push(`${personel.ad} ${personel.soyad}`);
    } else if (!matchedPersonel.includes(`${personel.ad} ${personel.soyad}`)) {
      matchedPersonel.push(`${personel.ad} ${personel.soyad}`);
    }

    let personMap = { ...(yoklamalar[personel.id] || {}) };

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = yoklamaDateKey(year, month, day);
      const existing = personMap[dateKey];
      const shouldWork = record.calismaGunleri.includes(day);
      const isIzinli = record.izinliGunleri?.includes(day);

      if (shouldWork) {
        if (existing?.durum === 'Geldi') {
          skippedDuplicates++;
          continue;
        }
        const mesai = record.mesaiGunleri?.[day] ?? 0;
        personMap = setYoklamaDay(personMap, year, month, day, {
          durum: 'Geldi',
          mesaiSaati: mesai,
        });
        importedDays++;
      } else if (isIzinli && !existing) {
        personMap = setYoklamaDay(personMap, year, month, day, {
          durum: 'İzinli',
          mesaiSaati: 0,
        });
        importedDays++;
      } else if (isSunday(year, month, day) && !personMap[dateKey]) {
        personMap = setYoklamaDay(personMap, year, month, day, {
          durum: 'Pazar',
          mesaiSaati: 0,
        });
      }
    }
    yoklamalar[personel.id] = personMap;
  });

  const nameCounts = new Map<string, number>();
  monthData.personeller.forEach(r => {
    const key = normalizeTurkishName(`${r.ad} ${r.soyad}`);
    nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
  });
  nameCounts.forEach((count, name) => {
    if (count > 1) warnings.push(`Aynı isim ${count} kez geçiyor (farklı Excel ID): ${name}`);
  });

  return {
    yoklamalar,
    personeller,
    createdPersonel,
    matchedPersonel,
    skippedDuplicates,
    importedDays,
    warnings,
  };
}

export function aiMonthlyDataToLegacyMonth(aiData: {
  yil: number;
  ay: number;
  personelKayitlari: Array<{
    excelId: number;
    adSoyad: string;
    gorev?: string;
    calismaGunleri: number[];
    mesaiGunleri?: Record<number, number>;
    istenCikisTarihi?: string;
  }>;
}): LegacyExcelMonthData {
  return {
    year: aiData.yil,
    month: aiData.ay,
    personeller: aiData.personelKayitlari.map(p => {
      const parts = p.adSoyad.trim().split(/\s+/);
      const soyad = parts.length > 1 ? parts[parts.length - 1] : '';
      const ad = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0];
      return {
        excelId: p.excelId,
        ad,
        soyad,
        gorev: p.gorev || 'DÜZ İŞÇİ',
        maas: 30000,
        istenCikisTarihi: p.istenCikisTarihi,
        calismaGunleri: p.calismaGunleri || [],
        mesaiGunleri: p.mesaiGunleri,
      };
    }),
  };
}

export function importAllLegacyExcelMonths(
  months: LegacyExcelMonthData[],
  existingPersoneller: Personel[],
  existingYoklamalar: AylikYoklamaMap
): LegacyImportResult {
  let personeller = [...existingPersoneller];
  let yoklamalar = { ...existingYoklamalar };
  const aggregate: LegacyImportResult = {
    yoklamalar,
    personeller,
    createdPersonel: [],
    matchedPersonel: [],
    skippedDuplicates: 0,
    importedDays: 0,
    warnings: [],
  };

  months.forEach(monthData => {
    const result = importLegacyExcelMonth(monthData, personeller, yoklamalar);
    personeller = result.personeller;
    yoklamalar = result.yoklamalar;
    aggregate.createdPersonel.push(...result.createdPersonel.filter(n => !aggregate.createdPersonel.includes(n)));
    aggregate.matchedPersonel.push(...result.matchedPersonel.filter(n => !aggregate.matchedPersonel.includes(n)));
    aggregate.skippedDuplicates += result.skippedDuplicates;
    aggregate.importedDays += result.importedDays;
    aggregate.warnings.push(...result.warnings);
  });

  aggregate.personeller = personeller;
  aggregate.yoklamalar = yoklamalar;
  return aggregate;
}
