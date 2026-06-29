/**
 * Mayıs mesai/gün düzeltmesi — Excel özet tablosu hedefi.
 * npx tsx scripts/generate-mayis-fixes.mjs
 */
import { writeFileSync } from 'fs';
import { MAYIS_2026_YOKLAMA } from '../src/data/mayis2026Yoklama.ts';
import { countRecord } from './verify-yoklama-utils.mjs';

const ALL = Array.from({ length: 31 }, (_, i) => i + 1);

const TARGET = {
  1: { gun: 30, mesai: 169 }, 2: { gun: 30, mesai: 124 }, 3: { gun: 30, mesai: 70 },
  4: { gun: 27, mesai: 15 }, 5: { gun: 27, mesai: 17 }, 6: { gun: 30, mesai: 68 },
  7: { gun: 30, mesai: 65 }, 8: { gun: 17, mesai: 4 }, 9: { gun: 30, mesai: 109 },
  10: { gun: 30, mesai: 65 }, 11: { gun: 30, mesai: 69 }, 12: { gun: 12, mesai: 8 },
  13: { gun: 27, mesai: 57 }, 14: { gun: 10 }, 15: { gun: 27, mesai: 35 },
  16: { gun: 24, mesai: 28 }, 17: { gun: 29, mesai: 88 }, 18: { gun: 30, mesai: 100 },
  19: { gun: 20, mesai: 21 }, 20: { gun: 12, mesai: 15 }, 21: { gun: 12, mesai: 8 },
  22: { gun: 29, mesai: 59 }, 23: { gun: 30, mesai: 85 }, 24: { gun: 30, mesai: 148 },
  25: { gun: 30, mesai: 103 }, 26: { gun: 30, mesai: 91 }, 27: { gun: 29, mesai: 80 },
  28: { gun: 28, mesai: 32 }, 29: { gun: 30, mesai: 81 }, 30: { gun: 17, mesai: 15 },
  31: { gun: 30, mesai: 84 }, 32: { gun: 9, mesai: 6 }, 33: { gun: 23, mesai: 22 },
  34: { gun: 30, mesai: 90 }, 35: { gun: 28, mesai: 25 }, 36: { gun: 30, mesai: 120 },
  37: { gun: 30, mesai: 46 }, 38: { gun: 30, mesai: 46 }, 39: { gun: 30, mesai: 8 },
  40: { gun: 1 }, 41: { gun: 30, mesai: 16 }, 42: { gun: 7, mesai: 5 },
  43: { gun: 30, mesai: 121 }, 44: { gun: 26, mesai: 41 }, 45: { gun: 1 },
  46: { gun: 1 }, 47: { gun: 1 }, 48: { gun: 25, mesai: 19 }, 49: { gun: 30, mesai: 90 },
  50: { gun: 28, mesai: 14 }, 51: { gun: 16 }, 52: { gun: 29, mesai: 45 },
  53: { gun: 1 }, 54: { gun: 1 }, 55: { gun: 16, mesai: 18 }, 56: { gun: 1 },
  57: { gun: 14, mesai: 16 }, 58: { gun: 0 }, 59: { gun: 15, mesai: 29 },
  60: { gun: 9, mesai: 11 }, 61: { gun: 13, mesai: 55 }, 62: { gun: 14, mesai: 49 },
  63: { gun: 14, mesai: 33 }, 64: { gun: 14, mesai: 71 }, 65: { gun: 11, mesai: 25 },
  66: { gun: 11, mesai: 24 }, 67: { gun: 21, mesai: 80 }, 68: { gun: 7, mesai: 34 },
  69: { gun: 31, mesai: 22 }, 70: { gun: 31, mesai: 6 },
};

const CALISMA_OVERRIDE = {
  8: [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
  14: [1, 2, 4, 5, 6, 7, 8, 9, 10, 11],
  35: ALL.filter(d => d <= 30 && d !== 7 && d !== 22),
  53: [1],
};

function adjustMesai(mesai, target, calisma) {
  if (target == null) return mesai;
  const m = { ...(mesai || {}) };
  let sum = Object.values(m).reduce((a, b) => a + b, 0);
  let delta = target - sum;
  if (Math.abs(delta) < 0.01) return m;
  const days = [...calisma].sort((a, b) => b - a);
  for (const d of days) {
    if (Math.abs(delta) < 0.01) break;
    const cur = m[d] || 0;
    if (delta > 0) {
      m[d] = cur + delta;
      delta = 0;
    } else {
      const take = Math.min(cur, -delta);
      m[d] = cur - take;
      delta += take;
    }
  }
  if (Math.abs(delta) >= 0.01) {
    const d = days[0] || 19;
    m[d] = (m[d] || 0) + delta;
  }
  return m;
}

const fixed = MAYIS_2026_YOKLAMA.personeller.map(p => {
  const t = TARGET[p.excelId];
  const calisma = CALISMA_OVERRIDE[p.excelId] ?? p.calismaGunleri;
  let mesai = { ...(p.mesaiGunleri || {}) };

  if (p.excelId === 37 || p.excelId === 38) {
    mesai = { 1: 8, 2: 3, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 11: 3, 12: 3, 16: 8, 18: 3, 19: 8, 20: 3, 21: 3 };
    mesai = adjustMesai(mesai, t?.mesai, calisma);
  } else {
    mesai = adjustMesai(mesai, t?.mesai, calisma);
  }

  const next = { ...p, calismaGunleri: [...calisma], mesaiGunleri: mesai };
  if (p.excelId === 8) next.istenCikisTarihi = '2026-05-18';
  if (p.excelId === 14) next.istenCikisTarihi = '2026-05-10';
  if (p.excelId === 24) { next.ad = 'TAHSİN'; next.soyad = 'OTHAN'; }
  return next;
});

let fails = 0;
fixed.forEach(p => {
  const t = TARGET[p.excelId];
  const c = countRecord(p);
  if (t?.gun != null && c.calisma !== t.gun) {
    console.log(`GUN #${p.excelId} ${p.ad}: ${c.calisma} != ${t.gun}`);
    fails++;
  }
  if (t?.mesai != null && Math.abs(c.mesai - t.mesai) > 0.5) {
    console.log(`MESAI #${p.excelId} ${p.ad}: ${c.mesai} != ${t.mesai}`);
    fails++;
  }
});

writeFileSync('scripts/mayis-fixed.json', JSON.stringify(fixed, null, 2));
console.log(fails === 0 ? 'OK — scripts/mayis-fixed.json' : `${fails} kalan hata`);
