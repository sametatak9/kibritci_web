import type { Personel } from '../types/erp';

/** Admin SDK `select()` ve yerel özet önbelleği — foto/PDF hariç. */
export const PERSONEL_LEAN_FIELDS = [
  'ad',
  'soyad',
  'tcNo',
  'babaAdi',
  'dogumTarihi',
  'telefonNo',
  'eposta',
  'adres',
  'il',
  'ilce',
  'departman',
  'gorev',
  'iseGirisTarihi',
  'istenCikisTarihi',
  'cinsiyet',
  'maas',
  'ucretTipi',
  'sgkDurumu',
  'bankaAdi',
  'subeAdi',
  'ibanNo',
  'durum',
  'firmaTipi',
  'firmaAdi',
  'personelGrubu',
  'onayDurumu',
  'kaynak',
  'mykDurumu',
  'takipEtiketleri',
] as const;

export function toLeanPersonelRecord(id: string, data: Record<string, unknown>): Personel {
  const out: Record<string, unknown> = { id };
  for (const key of PERSONEL_LEAN_FIELDS) {
    if (key in data) out[key] = data[key];
  }
  return out as unknown as Personel;
}
