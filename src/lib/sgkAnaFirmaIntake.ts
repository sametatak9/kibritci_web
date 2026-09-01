/**
 * Ana Firma (KİBRİTÇİ İNŞAAT) SGK PDF — aynı WhatsApp hattı, ayrı kuyruk.
 * Yoklama kilidi: mevcut Formen/Kampçı/Tesisatçı görev-durum-firma dokunulmaz.
 * Yeni kart: görev boş (arafta), nitelik = SGK meslek. Kadro yalnızca Onay’da.
 */

import type { Personel } from '../types/erp';
import { digitsTc, findSgkGrupBildirimi, type SgkTalepKayit } from './sgkGrupSablon';
import { isTaseronPersonelRecord } from './taseronUtils';
import type { TaseronGrupParse } from './taseronGrupSablon';
import { TASERON_GRUP_WP_HAT } from './taseronGrupSablon';
import { CANONICAL_ANA_FIRMA_ADI } from './yoklamaUtils';

export const ANA_FIRMA_SGK_KAYNAK = 'SGK_GRUP' as const;

function foldFirma(name: string): string {
  return String(name || '')
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/\s+/g, ' ')
    .trim();
}

/** PDF işveren ünvanında Kibritçi geçmeli. Boş ünvan Ana Firma sayılmaz. */
export function isKibritciSgkIsveren(firmaAdi?: string | null): boolean {
  const n = foldFirma(String(firmaAdi || ''));
  return n.includes('KIBRITCI');
}

export function findAnaFirmaPersonelByTc(
  personeller: Personel[] | undefined,
  tcRaw?: string
): Personel | undefined {
  const tc = digitsTc(tcRaw);
  if (tc.length !== 11) return undefined;
  return (personeller || []).find(
    (p) => !isTaseronPersonelRecord(p) && digitsTc(p.tcNo) === tc
  );
}

export function findTaseronPersonelByTcAny(
  personeller: Personel[] | undefined,
  tcRaw?: string
): Personel | undefined {
  const tc = digitsTc(tcRaw);
  if (tc.length !== 11) return undefined;
  return (personeller || []).find(
    (p) => isTaseronPersonelRecord(p) && digitsTc(p.tcNo) === tc
  );
}

/** Mevcut kadro + yoklama alanları korunur; yalnızca boş kimlik / SGK evrakı dolar. */
export function attachAnaFirmaSgkEvrakPreservingYoklama(
  existing: Personel,
  opts: {
    evrakUrl?: string;
    tcNo?: string;
    ad?: string;
    soyad?: string;
    nitelik?: string;
    iseGirisTarihi?: string;
  }
): Personel {
  const tc = digitsTc(opts.tcNo) || existing.tcNo || '';
  const nitelik = String(existing.nitelik || opts.nitelik || '')
    .trim()
    .toLocaleUpperCase('tr-TR');
  return {
    ...existing,
    tcNo: existing.tcNo || tc,
    ad: existing.ad || String(opts.ad || '').toLocaleUpperCase('tr-TR'),
    soyad: existing.soyad || String(opts.soyad || '').toLocaleUpperCase('tr-TR'),
    nitelik: nitelik || existing.nitelik,
    iseGirisTarihi: existing.iseGirisTarihi || opts.iseGirisTarihi || existing.iseGirisTarihi,
    sigortaEvrakUrl: opts.evrakUrl || existing.sigortaEvrakUrl,
    durum: existing.durum,
    istenCikisTarihi: existing.istenCikisTarihi,
    gorev: existing.gorev,
    firmaTipi: existing.firmaTipi,
    firmaAdi: existing.firmaAdi,
    personelGrubu: existing.personelGrubu,
  };
}

export function anaFirmaWpGirisKuyrukHazir(p?: Partial<TaseronGrupParse> | null): boolean {
  return Boolean(
    String(p?.ad || '').trim() &&
      String(p?.soyad || '').trim() &&
      p?.yon === 'giris' &&
      String(p?.tarih || '').trim() &&
      isKibritciSgkIsveren(p?.firmaAdi)
  );
}

export function anaFirmaWpCikisKuyrukHazir(p?: Partial<TaseronGrupParse> | null): boolean {
  return Boolean(
    p?.yon === 'cikis' &&
      digitsTc(p?.tcNo).length === 11 &&
      String(p?.tarih || '').trim() &&
      isKibritciSgkIsveren(p?.firmaAdi)
  );
}

export function buildAnaFirmaWpGirisTalepDoc(opts: {
  id: string;
  parsed: TaseronGrupParse;
  evrakUrl?: string;
  gonderen: string;
  mevcut?: Personel | null;
  bildirimGorev?: string;
}): Record<string, unknown> {
  const ad = opts.parsed.ad.trim().toLocaleUpperCase('tr-TR');
  const soyad = opts.parsed.soyad.trim().toLocaleUpperCase('tr-TR');
  const meslek = String(opts.parsed.isGorev || '')
    .trim()
    .toLocaleUpperCase('tr-TR');
  const gorev = String(opts.bildirimGorev || '').trim().toLocaleUpperCase('tr-TR');
  const evrak = opts.evrakUrl || '';
  const arafta = !gorev;
  return {
    id: opts.id,
    ad,
    soyad,
    personelIsim: `${ad} ${soyad}`.trim(),
    tcNo: digitsTc(opts.parsed.tcNo) || '',
    gorev: gorev || undefined,
    nitelik: meslek || undefined,
    iseGirisTarihi: opts.parsed.tarih,
    tarih: new Date().toISOString(),
    durum: 'BEKLEMEDE',
    kaynak: ANA_FIRMA_SGK_KAYNAK,
    firmaTipi: 'ANA_FIRMA',
    firmaAdi: CANONICAL_ANA_FIRMA_ADI,
    grupBildirildi: true,
    sgkEvrakGeldi: Boolean(evrak),
    sgkEvrakUrl: evrak || undefined,
    girisEvrakPdfUrl: evrak || undefined,
    gonderenFormen: opts.gonderen,
    wpHat: TASERON_GRUP_WP_HAT,
    gorevBosArafta: arafta,
    personelId: opts.mevcut?.id || undefined,
    yoklamaKilit:
      'Mevcut yoklama görevi ezilmez. Yeni kart görev boş (arafta); meslek niteliktir. Kadro Onay’da.',
  };
}

export function buildAnaFirmaWpCikisTalepDoc(opts: {
  id: string;
  parsed: TaseronGrupParse;
  evrakUrl?: string;
  gonderen: string;
  mevcut?: Personel | null;
}): Record<string, unknown> {
  const ad = (opts.parsed.ad || opts.mevcut?.ad || '').trim().toLocaleUpperCase('tr-TR');
  const soyad = (opts.parsed.soyad || opts.mevcut?.soyad || '').trim().toLocaleUpperCase('tr-TR');
  const evrak = opts.evrakUrl || '';
  const tcNo = digitsTc(opts.parsed.tcNo) || digitsTc(opts.mevcut?.tcNo);
  return {
    id: opts.id,
    ad,
    soyad,
    personelIsim: `${ad} ${soyad}`.trim() || opts.mevcut?.ad,
    personelId: opts.mevcut?.id || '',
    personelGorev: opts.mevcut?.gorev || '',
    personelMaas: opts.mevcut?.maas ?? 0,
    tcNo: tcNo || '',
    firmaTipi: 'ANA_FIRMA',
    firmaAdi: CANONICAL_ANA_FIRMA_ADI,
    cikisTarihi: opts.parsed.tarih,
    sgkCikisTarihi: opts.parsed.tarih,
    cikisNedeni: 'Ana Firma SGK — işten çıkış (WhatsApp hattı)',
    hedefYoneticiRole: 'YÖNETİCİ',
    tarih: new Date().toISOString(),
    durum: 'BEKLEMEDE',
    kaynak: ANA_FIRMA_SGK_KAYNAK,
    grupBildirildi: true,
    sgkEvrakGeldi: Boolean(evrak),
    sgkEvrakUrl: evrak || undefined,
    cikisEvrakPdfUrl: evrak || undefined,
    gonderenFormen: opts.gonderen,
    wpHat: TASERON_GRUP_WP_HAT,
    yoklamaKilit: 'Çıkış Onay’da kartı pasife alır; yoklama günleri silinmez / taşınmaz.',
  };
}

export function findOpenAnaFirmaSgkTalep(
  kuyruk: SgkTalepKayit[],
  parsed: Pick<TaseronGrupParse, 'ad' | 'soyad' | 'tcNo'>
): SgkTalepKayit | undefined {
  return findSgkGrupBildirimi(kuyruk, {
    ad: parsed.ad,
    soyad: parsed.soyad,
    tcNo: parsed.tcNo,
    personelIsim: `${parsed.ad || ''} ${parsed.soyad || ''}`.trim(),
  });
}
