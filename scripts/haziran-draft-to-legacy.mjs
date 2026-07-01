/**
 * Haziran 2026 el yazısı draft JSON → haziran2026Yoklama.ts
 * node scripts/haziran-draft-to-legacy.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const draft = JSON.parse(readFileSync(join(__dir, 'haziran2026-output/haziran2026-draft.json'), 'utf8'));

const EXCEL_ID_BASE = 6101;
const YEAR = 2026;
const MONTH = 6;
const SUNDAYS = [7, 14, 21, 28];

/** AI yanlış okuma → doğru isim (Mayıs listesiyle uyumlu) */
const CANONICAL_NAMES = {
  'omer san': { ad: 'ÖMER', soyad: 'SARI' },
  'omer sari': { ad: 'ÖMER', soyad: 'SARI' },
  'samet vaner': { ad: 'ALİ SAMET', soyad: 'VANER' },
  'merdan mevlan sari': { ad: 'MEVLAN', soyad: 'SARI' },
  'mevlan sari': { ad: 'MEVLAN', soyad: 'SARI' },
  'hakan demirboga': { ad: 'HAKAN', soyad: 'DEMİRBAĞ' },
};

function upperWords(s) {
  return s.trim().split(/\s+/).map(w =>
    w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1).toLocaleLowerCase('tr-TR')
  ).join(' ');
}

function splitName(adSoyad, keyHint) {
  const key = keyHint || norm(adSoyad);
  if (CANONICAL_NAMES[key]) return CANONICAL_NAMES[key];
  const parts = adSoyad.trim().split(/\s+/);
  if (parts.length <= 1) return { ad: upperWords(parts[0] || adSoyad).toLocaleUpperCase('tr-TR'), soyad: '' };
  const soyad = upperWords(parts[parts.length - 1]).toLocaleUpperCase('tr-TR');
  const ad = upperWords(parts.slice(0, -1).join(' ')).toLocaleUpperCase('tr-TR');
  return { ad, soyad };
}

function norm(s) {
  return (s || '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/İ/g, 'i')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalKey(adSoyad) {
  const k = norm(adSoyad);
  if (k === 'omer san') return 'omer sari';
  if (k === 'merdan mevlan sari') return 'mevlan sari';
  if (k === 'hakan demirboga') return 'hakan demirbag';
  return k;
}

function dayFromGun(g) {
  if (g.sayfaNo >= 1 && g.sayfaNo <= 30) return g.sayfaNo;
  const m = (g.tarih || '').match(/2026-06-(\d{2})/);
  return m ? Number(m[1]) : null;
}

/** personKey → { ad, soyad, gorev, days: Map<day,{mesai,durum}> } */
const people = new Map();

for (const gun of draft.gunler) {
  const day = dayFromGun(gun);
  if (!day) continue;
  for (const kayit of gun.yoklamaKayitlari || []) {
    if (kayit.durum && kayit.durum !== 'Geldi') continue;
    const key = canonicalKey(kayit.adSoyad);
    if (!people.has(key)) {
      const { ad, soyad } = splitName(kayit.adSoyad, key);
      people.set(key, {
        ad,
        soyad,
        gorev: kayit.gorev ? kayit.gorev.toLocaleUpperCase('tr-TR') : 'DÜZ İŞÇİ',
        days: new Map(),
      });
    }
    const p = people.get(key);
    if (kayit.gorev && p.gorev === 'DÜZ İŞÇİ') {
      p.gorev = kayit.gorev.toLocaleUpperCase('tr-TR');
    }
    const mesai = Number(kayit.mesaiSaati) || 0;
    const prev = p.days.get(day);
    if (!prev || mesai > prev.mesai) {
      p.days.set(day, { mesai });
    }
  }
}

// Drop very short partial names (belirsiz tek kelime, 1 gün)
for (const [key, p] of [...people.entries()]) {
  if (!p.soyad && p.days.size <= 2 && key === 'ismail') {
    people.delete(key);
  }
}

const records = [...people.values()]
  .map(p => {
    const calismaGunleri = [...p.days.keys()].sort((a, b) => a - b);
    const mesaiGunleri = {};
    p.days.forEach((v, d) => {
      if (v.mesai > 0) mesaiGunleri[d] = v.mesai;
    });
    const izinliGunleri = SUNDAYS.filter(d => !calismaGunleri.includes(d));
    const firstDay = calismaGunleri[0] || 1;
    const iseGiris = `${YEAR}-06-${String(firstDay).padStart(2, '0')}`;
    return {
      ad: p.ad,
      soyad: p.soyad,
      gorev: p.gorev,
      calismaGunleri,
      izinliGunleri: izinliGunleri.length ? izinliGunleri : undefined,
      mesaiGunleri: Object.keys(mesaiGunleri).length ? mesaiGunleri : undefined,
      iseGirisTarihi: iseGiris,
    };
  })
  .sort((a, b) => {
    const da = Math.min(...a.calismaGunleri);
    const db = Math.min(...b.calismaGunleri);
    if (da !== db) return da - db;
    return `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, 'tr');
  })
  .map((r, i) => ({ excelId: EXCEL_ID_BASE + i, ...r }));

function fmtRecord(r) {
  const parts = [
    `excelId: ${r.excelId}`,
    `ad: '${r.ad}'`,
    `soyad: '${r.soyad}'`,
    `gorev: '${r.gorev}'`,
    `maas: 30000`,
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

const ts = `import { LegacyExcelMonthData } from './legacyExcelYoklama';

/** Haziran 2026 — el yazısı günlük yoklama (157-46 Doğrama) PDF taraması
 *  Kaynak: scripts/haziran2026-tarama.pdf
 *  Oluşturulma: ${new Date().toISOString()}
 *  2. kontrol: isim birleştirme, sayfaNo=gün, excelId 6101+
 */
export const HAZIRAN_2026_YOKLAMA: LegacyExcelMonthData = {
  year: ${YEAR},
  month: ${MONTH},
  personeller: [
    ${records.map(fmtRecord).join(',\n    ')}
  ],
};
`;

writeFileSync(join(__dir, '../src/data/haziran2026Yoklama.ts'), ts);

// Kontrol raporu
const daysSeen = new Set();
draft.gunler.forEach(g => {
  const d = dayFromGun(g);
  if (d) daysSeen.add(d);
});
const mesaiCount = records.reduce((s, r) => s + Object.keys(r.mesaiGunleri || {}).length, 0);
const report = [
  'HAZİRAN 2026 — 2. KONTROL RAPORU',
  `Oluşturulma: ${new Date().toISOString()}`,
  `Gün kapsamı: ${daysSeen.size}/30 (${[...Array(30)].map((_, i) => i + 1).filter(d => !daysSeen.has(d)).join(', ') || 'eksik yok'})`,
  `Personel: ${records.length}`,
  `Mesai kayıtlı gün: ${mesaiCount}`,
  '',
  'İsim birleştirmeleri:',
  '  Ömer San → Ömer Sarı',
  '  Samet Vaner → Ali Samet Vaner',
  '  Merdan Mevlan Sarı → Mevlan Sarı',
  '  Belirsiz tek "İsmail" (≤2 gün) silindi',
  '',
  'Personel listesi (gün sayısı):',
  ...records
    .map(r => `${String(r.calismaGunleri.length).padStart(2)} gün — ${r.ad} ${r.soyad}${r.mesaiGunleri ? ` (mesai: ${Object.values(r.mesaiGunleri).reduce((a, b) => a + b, 0)}s)` : ''}`)
    .sort((a, b) => Number(b.split(' ')[0]) - Number(a.split(' ')[0])),
].join('\n');

writeFileSync(join(__dir, 'haziran2026-output/kontrol-raporu-v2.txt'), report);
console.log(report);
console.log(`\nYazıldı: src/data/haziran2026Yoklama.ts (${records.length} personel)`);
