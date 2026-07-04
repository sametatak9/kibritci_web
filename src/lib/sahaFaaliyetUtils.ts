import { AylikYoklamaMap, YoklamaDurum } from '../types/erp';
import { normalizeDateKey } from './dateKeyUtils';
import { getYoklamaDay, setYoklamaDay } from './yoklamaUtils';

export function clampMesaiSaati(raw: number, max = 14): number {
  const safe = Number.isFinite(raw) ? raw : 0;
  const clamped = Math.max(0, Math.min(max, safe));
  return Math.round(clamped * 2) / 2;
}

/** Mesai Saha Faaliyeti kaydındaki saatleri yoklama/puantaj tablosuna yazar. */
export function applySahaMesaiToYoklama(
  yoklamalar: AylikYoklamaMap,
  tarih: string,
  mesaiSaatleri: Record<string, number> | undefined,
  personelIds: string[],
  gonderen: string,
  maxMesai = 14
): AylikYoklamaMap {
  const dk = normalizeDateKey(tarih);
  if (!dk) return yoklamalar;
  const [y, m, d] = dk.split('-').map(Number);
  if (!y || !m || !d) return yoklamalar;

  const next = { ...yoklamalar };
  for (const pid of personelIds) {
    const hours = clampMesaiSaati(mesaiSaatleri?.[pid] ?? 0, maxMesai);
    if (hours <= 0) continue;
    const dayData = getYoklamaDay(next[pid], y, m, d) || {
      durum: 'Girilmedi' as YoklamaDurum,
      mesaiSaati: 0,
    };
    next[pid] = setYoklamaDay(next[pid], y, m, d, {
      ...dayData,
      durum: dayData.durum === 'Girilmedi' ? 'Geldi' : dayData.durum,
      mesaiSaati: hours,
      gonderen,
    });
  }
  return next;
}

export function formatFaaliyetKategoriLabel(kategori?: string): string {
  if (kategori === 'MESAI_SAHA') return 'Mesai Saha Faaliyeti';
  return 'İmalat Faaliyeti';
}
