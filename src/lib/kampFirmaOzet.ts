import { KampKaydi, Personel } from '../types/erp';
import { isPersonelActiveOnDate } from './guvenlikHelpers';
import { isPersonelAktifDurum } from './kampPlacementUtils';
import { firmaEslesir } from './taseronUtils';
import {
  CANONICAL_ANA_FIRMA_ADI,
  isKibritciCompany,
  isTaseronPersonel,
} from './yoklamaUtils';

export type KampFirmaOzetRow = {
  firma: string;
  /** Aktif kadro (işten çıkmamış personel kartı) */
  toplamCalisan: number;
  /** Aktif kamp konaklama */
  kampta: number;
  odaSayisi: number;
};

function normalizeFirmaKey(raw: string, existing: string[]): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed || isKibritciCompany(trimmed)) return CANONICAL_ANA_FIRMA_ADI;
  const upper = trimmed.toLocaleUpperCase('tr-TR');
  if (upper === 'ANA FİRMA' || upper === 'ANA FIRMA') return CANONICAL_ANA_FIRMA_ADI;
  for (const key of existing) {
    if (firmaEslesir(key, trimmed)) return key;
  }
  return upper;
}

function resolvePersonelFirma(p: Personel): string {
  if (!isTaseronPersonel(p)) return CANONICAL_ANA_FIRMA_ADI;
  return p.firmaAdi?.trim() || 'TAŞERON';
}

function resolveKampFirma(k: KampKaydi, personeller: Personel[]): string {
  // Personel kartı varsa çalışan kolonundaki firma ile aynı olsun
  const p = k.personelId ? personeller.find((x) => x.id === k.personelId) : undefined;
  if (p) return resolvePersonelFirma(p);

  if (k.firmaTipi === 'ANA_FIRMA' || isKibritciCompany(k.calistigiFirma || '')) {
    return CANONICAL_ANA_FIRMA_ADI;
  }
  const fromKamp = k.calistigiFirma?.trim();
  if (fromKamp) return fromKamp;
  return 'TAŞERON';
}

/** Firma bazında: toplam çalışan + kampta kalan + oda sayısı. */
export function buildKampFirmaOzeti(
  personeller: Personel[],
  kampKayitlari: KampKaydi[],
  options?: { onlyActivePersonel?: boolean; asOfDate?: string }
): KampFirmaOzetRow[] {
  const onlyActive = options?.onlyActivePersonel !== false;
  const asOf = options?.asOfDate || new Date().toISOString().slice(0, 10);
  const map = new Map<string, KampFirmaOzetRow>();
  const roomsByFirm = new Map<string, Set<string>>();

  const ensure = (raw: string): KampFirmaOzetRow => {
    const key = normalizeFirmaKey(raw, Array.from(map.keys()));
    let row = map.get(key);
    if (!row) {
      row = { firma: key, toplamCalisan: 0, kampta: 0, odaSayisi: 0 };
      map.set(key, row);
    }
    return row;
  };

  for (const p of personeller) {
    if (onlyActive) {
      if (!isPersonelAktifDurum(p.durum)) continue;
      if (!isPersonelActiveOnDate(p, asOf)) continue;
    }
    ensure(resolvePersonelFirma(p)).toplamCalisan += 1;
  }

  for (const k of kampKayitlari) {
    if (k.durum !== 'AKTIF') continue;
    const row = ensure(resolveKampFirma(k, personeller));
    row.kampta += 1;
    const rid = k.odaId || k.roomId;
    if (rid) {
      if (!roomsByFirm.has(row.firma)) roomsByFirm.set(row.firma, new Set());
      roomsByFirm.get(row.firma)!.add(rid);
    }
  }

  for (const [firma, rooms] of roomsByFirm) {
    const row = map.get(firma);
    if (row) row.odaSayisi = rooms.size;
  }

  return Array.from(map.values())
    .filter((r) => r.toplamCalisan > 0 || r.kampta > 0)
    .sort((a, b) => b.kampta - a.kampta || b.toplamCalisan - a.toplamCalisan || a.firma.localeCompare(b.firma, 'tr'));
}
