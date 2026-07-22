import type { AylikYoklamaMap, Personel } from '../types/erp';
import { isPersonelActiveOnDate } from './guvenlikHelpers';
import { foldFirma } from './taseronUtils';
import { getYoklamaDay, isTaseronPersonel } from './yoklamaUtils';

export type TaseronFirmaMevcudiyet = {
  firma: string;
  aktifKadro: number;
  geldi: number;
  yok: number;
  izinli: number;
  raporlu: number;
  girilmedi: number;
};

export type TaseronMevcudiyetOzet = {
  tarih: string;
  aktifKadro: number;
  geldi: number;
  yok: number;
  izinli: number;
  raporlu: number;
  girilmedi: number;
  byFirma: TaseronFirmaMevcudiyet[];
};

function parseAsOf(asOf?: string): { y: number; m: number; d: number; iso: string } {
  const iso = (asOf || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const [ys, ms, ds] = iso.split('-');
  return {
    iso,
    y: Number(ys),
    m: Number(ms),
    d: Number(ds),
  };
}

/**
 * Bugünkü (veya verilen gün) taşeron mevcudiyeti — salt okunur.
 * Yoklama / personel yazmaz.
 */
export function countTaseronMevcudiyetBugun(
  personeller: Personel[],
  yoklamalar: AylikYoklamaMap,
  asOf?: string
): TaseronMevcudiyetOzet {
  const { y, m, d, iso } = parseAsOf(asOf);
  const aktifTaseron = (personeller || []).filter(
    (p) =>
      isTaseronPersonel(p) &&
      (p.durum === true || String(p.durum) === 'true') &&
      isPersonelActiveOnDate(p, iso)
  );

  const firmaMap = new Map<string, TaseronFirmaMevcudiyet>();

  let geldi = 0;
  let yok = 0;
  let izinli = 0;
  let raporlu = 0;
  let girilmedi = 0;

  for (const p of aktifTaseron) {
    const firmaLabel = String(p.firmaAdi || 'Taşeron (belirtilmemiş)').trim() || 'Taşeron (belirtilmemiş)';
    const key = foldFirma(firmaLabel) || 'taseron';
    let bucket = firmaMap.get(key);
    if (!bucket) {
      bucket = {
        firma: firmaLabel,
        aktifKadro: 0,
        geldi: 0,
        yok: 0,
        izinli: 0,
        raporlu: 0,
        girilmedi: 0,
      };
      firmaMap.set(key, bucket);
    }
    bucket.aktifKadro += 1;

    const day = getYoklamaDay(yoklamalar?.[p.id] || {}, y, m, d);
    const durum = String(day?.durum || 'Girilmedi');
    if (durum === 'Geldi') {
      geldi += 1;
      bucket.geldi += 1;
    } else if (durum === 'Yok') {
      yok += 1;
      bucket.yok += 1;
    } else if (durum === 'İzinli' || durum === 'Izinli') {
      izinli += 1;
      bucket.izinli += 1;
    } else if (durum === 'Raporlu') {
      raporlu += 1;
      bucket.raporlu += 1;
    } else {
      girilmedi += 1;
      bucket.girilmedi += 1;
    }
  }

  const byFirma = Array.from(firmaMap.values()).sort(
    (a, b) => b.geldi - a.geldi || b.aktifKadro - a.aktifKadro || a.firma.localeCompare(b.firma, 'tr')
  );

  return {
    tarih: iso,
    aktifKadro: aktifTaseron.length,
    geldi,
    yok,
    izinli,
    raporlu,
    girilmedi,
    byFirma,
  };
}
