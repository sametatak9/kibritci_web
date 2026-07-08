/**
 * Yeni PDF parse → mevcut 76 kişilik roster ile birleştir (OCR çöpünü filtrele)
 * npx tsx scripts/haziran-draft-to-legacy.ts
 */
import fs from 'fs';
import path from 'path';
import { HAZIRAN_2026_YOKLAMA } from '../src/data/haziran2026Yoklama';
import { MAYIS_2026_YOKLAMA } from '../src/data/mayis2026Yoklama';
import type { LegacyExcelPersonRecord } from '../src/data/legacyExcelYoklama';

const draftPath = path.join(process.cwd(), 'scripts/haziran2026-output/haziran2026-draft.json');
const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));

const YEAR = 2026;
const MONTH = 6;
const SUNDAYS = [7, 14, 21, 28];
const MIN_DAYS_NEW_HIRE = 4;

function norm(s: string) {
  return (s || '').toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/İ/g, 'i')
    .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function isValidName(raw: string) {
  if (!raw || raw.length < 4) return false;
  if (/[0-9πλθ:.,]/.test(raw)) return false;
  if (!/[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(raw)) return false;
  const parts = raw.trim().split(/\s+/);
  return parts.length >= 2 && parts[parts.length - 1].length >= 2;
}

/** Bilinen OCR düzeltmeleri → roster norm key */
const ALIASES: Record<string, string> = {
  'omer san': 'omer sari',
  'samet vaner': 'ali samet vaner',
  'merdan mevlan sari': 'mevlan sari',
  'hakan demirboga': 'hakan demirbag',
  'servet ozkalçin': 'servet ozkalsin',
  'servet ozkalcin': 'servet ozkalsin',
  'servet ozkalşin': 'servet ozkalsin',
  'muhammet altintas': 'muhammed altintas',
  'muhammet hamza': 'muhammet hamza',
  'alper kalak': 'alper kavak',
  'baran kalak': 'baran kavak',
  'mustafa kemal kalak': 'mustafa kemal kavak',
  'dursun celiksoy': 'dursun celiksav',
  'yasin ve efe': 'yasin efe',
  'ibrahim pung': 'ibrahim tunc',
  'ibrahim püng': 'ibrahim tunc',
};

interface PersonAcc {
  record: LegacyExcelPersonRecord;
  days: Map<number, number>;
}

function rosterKey(ad: string, soyad: string) {
  return norm(`${ad} ${soyad}`);
}

const roster = new Map<string, PersonAcc>();

for (const p of HAZIRAN_2026_YOKLAMA.personeller) {
  const key = rosterKey(p.ad, p.soyad);
  const days = new Map<number, number>();
  for (const d of p.calismaGunleri) {
    days.set(d, p.mesaiGunleri?.[d] ?? 0);
  }
  const acc = { record: { ...p }, days };
  roster.set(key, acc);
  if (key.includes('ozkalcin')) roster.set(key.replace('ozkalcin', 'ozkalsin'), acc);
  if (key.includes('ozkalsin')) roster.set(key.replace('ozkalsin', 'ozkalcin'), acc);
}

for (const p of MAYIS_2026_YOKLAMA.personeller) {
  const key = rosterKey(p.ad, p.soyad);
  if (!roster.has(key)) {
    roster.set(key, {
      record: {
        excelId: 6200 + roster.size,
        ad: p.ad,
        soyad: p.soyad,
        gorev: p.gorev,
        maas: p.maas,
        iseGirisTarihi: p.iseGirisTarihi,
        calismaGunleri: [],
      },
      days: new Map(),
    });
  }
}

function findRosterKey(raw: string): string | null {
  let k = norm(raw);
  if (ALIASES[k]) k = norm(ALIASES[k]);
  if (roster.has(k)) return k;

  const parts = k.split(' ');
  if (parts.length < 2) return null;
  const soyad = parts[parts.length - 1];
  const adPre = parts[0].slice(0, 4);

  let best: string | null = null;
  for (const rk of roster.keys()) {
    const rp = rk.split(' ');
    if (rp.length < 2) continue;
    if (rp[rp.length - 1] === soyad && rp[0].slice(0, 4) === adPre) {
      best = rk;
      break;
    }
  }
  return best;
}

function dayFromGun(g: { sayfaNo?: number; tarih?: string }) {
  if (g.sayfaNo && g.sayfaNo >= 1 && g.sayfaNo <= 30) return g.sayfaNo;
  const m = (g.tarih || '').match(/2026-06-(\d{2})/);
  return m ? Number(m[1]) : null;
}

const unmatched = new Map<string, { display: string; days: Map<number, number>; gorev?: string }>();
const matchLog: string[] = [];
let skippedGarbage = 0;

for (const gun of draft.gunler) {
  const day = dayFromGun(gun);
  if (!day) continue;
  for (const k of gun.yoklamaKayitlari || []) {
    if (k.durum && k.durum !== 'Geldi') continue;
    const mesai = Math.min(Math.max(0, Number(k.mesaiSaati) || 0), 14);
    const rk = findRosterKey(k.adSoyad);
    if (rk) {
      const acc = roster.get(rk)!;
      const prev = acc.days.get(day) ?? 0;
      acc.days.set(day, Math.max(prev, mesai));
      if (k.gorev && acc.record.gorev === 'DÜZ İŞÇİ') {
        acc.record.gorev = k.gorev.toLocaleUpperCase('tr-TR');
      }
    } else {
      if (!isValidName(k.adSoyad)) { skippedGarbage++; continue; }
      const uk = norm(k.adSoyad);
      if (!unmatched.has(uk)) {
        unmatched.set(uk, { display: k.adSoyad, days: new Map(), gorev: k.gorev });
      }
      const u = unmatched.get(uk)!;
      u.days.set(day, Math.max(u.days.get(day) ?? 0, mesai));
    }
  }
}

let nextId = 6101;
const outputRecords: LegacyExcelPersonRecord[] = [];

for (const [, acc] of roster) {
  if (acc.days.size === 0) continue;
  const calismaGunleri = [...acc.days.keys()].sort((a, b) => a - b);
  const mesaiGunleri: Record<number, number> = {};
  acc.days.forEach((h, d) => { if (h > 0) mesaiGunleri[d] = h; });
  const izinliGunleri = SUNDAYS.filter(d => !calismaGunleri.includes(d));
  const firstDay = calismaGunleri[0];
  outputRecords.push({
    ...acc.record,
    excelId: nextId++,
    iseGirisTarihi: acc.record.iseGirisTarihi || `${YEAR}-06-${String(firstDay).padStart(2, '0')}`,
    calismaGunleri,
    izinliGunleri: izinliGunleri.length ? izinliGunleri : undefined,
    mesaiGunleri: Object.keys(mesaiGunleri).length ? mesaiGunleri : undefined,
  });
}

for (const [uk, u] of unmatched) {
  if (u.days.size < MIN_DAYS_NEW_HIRE) continue;
  if (findRosterKey(u.display)) continue;
  const parts = u.display.trim().split(/\s+/);
  const soyad = parts[parts.length - 1].toLocaleUpperCase('tr-TR');
  const ad = parts.slice(0, -1).join(' ').toLocaleUpperCase('tr-TR');
  const calismaGunleri = [...u.days.keys()].sort((a, b) => a - b);
  const mesaiGunleri: Record<number, number> = {};
  u.days.forEach((h, d) => { if (h > 0) mesaiGunleri[d] = h; });
  outputRecords.push({
    excelId: nextId++,
    ad,
    soyad,
    gorev: u.gorev?.toLocaleUpperCase('tr-TR') || 'DÜZ İŞÇİ',
    maas: 30000,
    iseGirisTarihi: `${YEAR}-06-${String(calismaGunleri[0]).padStart(2, '0')}`,
    calismaGunleri,
    izinliGunleri: SUNDAYS.filter(d => !calismaGunleri.includes(d)),
    mesaiGunleri: Object.keys(mesaiGunleri).length ? mesaiGunleri : undefined,
  });
  matchLog.push(`YENİ: ${ad} ${soyad} (${calismaGunleri.length} gün)`);
}

outputRecords.sort((a, b) => {
  const da = Math.min(...a.calismaGunleri);
  const db = Math.min(...b.calismaGunleri);
  if (da !== db) return da - db;
  return `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, 'tr');
});

// Aynı kişi farklı yazımlarla tekrar etmesin
const deduped = new Map<string, LegacyExcelPersonRecord>();
for (const r of outputRecords) {
  const k = rosterKey(r.ad, r.soyad);
  const existing = deduped.get(k);
  if (!existing) {
    deduped.set(k, r);
    continue;
  }
  const days = new Set([...existing.calismaGunleri, ...r.calismaGunleri]);
  existing.calismaGunleri = [...days].sort((a, b) => a - b);
  existing.mesaiGunleri = { ...(existing.mesaiGunleri || {}), ...(r.mesaiGunleri || {}) };
}
const finalRecords = [...deduped.values()].map((r, i) => ({ ...r, excelId: 6101 + i }));

function fmtRecord(r: LegacyExcelPersonRecord) {
  const parts = [
    `excelId: ${r.excelId}`,
    `ad: '${r.ad}'`,
    `soyad: '${r.soyad}'`,
    `gorev: '${r.gorev}'`,
    `maas: ${r.maas ?? 30000}`,
    `iseGirisTarihi: '${r.iseGirisTarihi}'`,
    `calismaGunleri: [${r.calismaGunleri.join(',')}]`,
  ];
  if (r.izinliGunleri?.length) parts.push(`izinliGunleri: [${r.izinliGunleri.join(',')}]`);
  if (r.mesaiGunleri) {
    const m = Object.entries(r.mesaiGunleri).map(([d, h]) => `${d}: ${h}`).join(', ');
    parts.push(`mesaiGunleri: { ${m} }`);
  }
  return `{ ${parts.join(', ')} }`;
}

const mesaiTotal = outputRecords.reduce((s, r) =>
  s + Object.values(r.mesaiGunleri || {}).reduce((a, b) => a + b, 0), 0);
const mesaiDays = outputRecords.reduce((s, r) => s + Object.keys(r.mesaiGunleri || {}).length, 0);

const ts = `import { LegacyExcelMonthData } from './legacyExcelYoklama';

/** Haziran 2026 — 157-46 Doğrama el yazısı yoklama (son kontrol ${new Date().toISOString().slice(0, 10)}) */
export const HAZIRAN_2026_YOKLAMA: LegacyExcelMonthData = {
  year: ${YEAR},
  month: ${MONTH},
  personeller: [
    ${finalRecords.map(fmtRecord).join(',\n    ')}
  ],
};
`;

fs.writeFileSync(path.join(process.cwd(), 'src/data/haziran2026Yoklama.ts'), ts);

const report = [
  'HAZİRAN 2026 — SON KONTROL (roster merge)',
  `Personel: ${finalRecords.length}`,
  `Mesai kayıtlı gün: ${finalRecords.reduce((s, r) => s + Object.keys(r.mesaiGunleri || {}).length, 0)}, toplam saat: ${finalRecords.reduce((s, r) => s + Object.values(r.mesaiGunleri || {}).reduce((a, b) => a + b, 0), 0)}`,
  `OCR çöp atlandı: ${skippedGarbage}`,
  ...matchLog,
  '',
  ...finalRecords
    .map(r => `${String(r.calismaGunleri.length).padStart(2)} gün — ${r.ad} ${r.soyad}${r.mesaiGunleri ? ` (mesai ${Object.values(r.mesaiGunleri).reduce((a, b) => a + b, 0)}s)` : ''}`)
    .sort((a, b) => Number(b.split(' ')[0]) - Number(a.split(' ')[0])),
].join('\n');

fs.writeFileSync(path.join(process.cwd(), 'scripts/haziran2026-output/kontrol-raporu-final.txt'), report);
console.log(report);
