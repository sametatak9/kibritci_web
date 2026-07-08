/**
 * Haziran yoklama son kontrol — tekrar, isim, mesai
 * node scripts/haziran-final-verify.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const draftPath = path.join(root, 'haziran2026-output/haziran2026-draft.json');
const mayisTs = fs.readFileSync(path.join(root, '../src/data/mayis2026Yoklama.ts'), 'utf8');

function norm(s) {
  return (s || '').toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/İ/g, 'i')
    .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

const mayisNames = new Set();
for (const m of mayisTs.matchAll(/ad:\s*'([^']+)',\s*soyad:\s*'([^']*)'/g)) {
  mayisNames.add(norm(`${m[1]} ${m[2]}`));
}

const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
const issues = [];
const nameByDay = new Map();
const allNames = new Map();

for (const gun of draft.gunler) {
  const day = gun.sayfaNo || Number((gun.tarih || '').slice(-2));
  for (const k of gun.yoklamaKayitlari || []) {
    const n = norm(k.adSoyad);
    if (!nameByDay.has(n)) nameByDay.set(n, new Set());
    if (nameByDay.get(n).has(day)) {
      issues.push(`TEKRAR: ${k.adSoyad} — ${day} Haziran iki kez`);
    }
    nameByDay.get(n).add(day);
    if (!allNames.has(n)) allNames.set(n, { display: k.adSoyad, days: 0, mesaiDays: 0, maxMesai: 0 });
    const rec = allNames.get(n);
    rec.days++;
    if ((k.mesaiSaati || 0) > 0) {
      rec.mesaiDays++;
      rec.maxMesai = Math.max(rec.maxMesai, k.mesaiSaati);
    }
    if ((k.mesaiSaati || 0) > 14) {
      issues.push(`MESAİ YÜKSEK: ${k.adSoyad} gün ${day} → ${k.mesaiSaati} saat`);
    }
    if (!k.soyad && k.adSoyad.split(/\s+/).length === 1 && k.not === 'belirsiz') {
      issues.push(`BELİRSİZ İSİM: ${k.adSoyad} gün ${day}`);
    }
  }
}

const newWorkers = [];
const continuing = [];
for (const [n, rec] of allNames) {
  if (mayisNames.has(n) || [...mayisNames].some(m => m.includes(n) || n.includes(m))) {
    continuing.push(rec);
  } else if (rec.days >= 3) {
    newWorkers.push(rec);
  }
}

const similarPairs = [];
const keys = [...allNames.keys()];
for (let i = 0; i < keys.length; i++) {
  for (let j = i + 1; j < keys.length; j++) {
    const a = keys[i], b = keys[j];
    if (a.startsWith(b) || b.startsWith(a) || (a.split(' ')[0] === b.split(' ')[0] && a !== b)) {
      similarPairs.push(`${allNames.get(a).display} ~ ${allNames.get(b).display}`);
    }
  }
}

const report = [
  '=== HAZİRAN 2026 SON KONTROL RAPORU ===',
  `Kaynak: ${draft.kaynak}`,
  `Parse: ${draft.parsedAt}`,
  `Gün: ${draft.gunler.length}/30`,
  `Benzersiz isim: ${allNames.size}`,
  `Mayıs'tan devam eden (eşleşen): ~${continuing.length}`,
  `Yeni/3+ gün: ${newWorkers.length}`,
  '',
  '--- SORUNLAR ---',
  ...(issues.length ? issues : ['(kritik sorun yok)']),
  '',
  '--- BENZER İSİMLER (birleştirme adayı) ---',
  ...similarPairs.slice(0, 20),
  '',
  '--- YENİ PERSONEL (3+ gün) ---',
  ...newWorkers.sort((a, b) => b.days - a.days).map(r =>
    `${r.display}: ${r.days} gün${r.mesaiDays ? `, mesai ${r.mesaiDays} gün` : ''}`),
].join('\n');

const outPath = path.join(root, 'haziran2026-output/kontrol-raporu-final.txt');
fs.writeFileSync(outPath, report, 'utf8');
console.log(report);
console.log('\n→', outPath);
