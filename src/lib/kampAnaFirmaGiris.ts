/** Kampçı / WhatsApp işçi girişi — Ana Firma kartı yazılmaz; SGK grup kuyruğu. */

import {
  buildSgkGirisWhatsAppText,
  findSgkGrupBildirimi,
  type BildirimAday,
  type SgkGirisBildirimi,
} from './sgkGrupSablon';

export const KAMP_ANA_FIRMA_KAYNAK = 'SGK_GRUP' as const;

export type KampAnaFirmaGirisAlanlari = SgkGirisBildirimi & {
  telefonNo?: string;
  kimlikFotoUrl: string;
  kimlikFotoUrls?: string[];
  gonderenKampci?: string;
  kaynakPanel?: string;
};

export function kampAnaFirmaSgkWhatsAppText(b: SgkGirisBildirimi): string {
  return buildSgkGirisWhatsAppText(b);
}

export function findOpenAnaFirmaGirisTalebi<T extends BildirimAday>(
  kuyruk: T[],
  opts: { ad?: string; soyad?: string; tcNo?: string }
): T | undefined {
  return findSgkGrupBildirimi(kuyruk, opts);
}

/** Firestore `personelGirisTalepleri` — Grup Köprüsü ile aynı kuyruk alanları. */
export function buildKampAnaFirmaGirisTalepDoc(
  id: string,
  alan: KampAnaFirmaGirisAlanlari
): Record<string, unknown> {
  const ad = alan.ad.trim().toLocaleUpperCase('tr-TR');
  const soyad = alan.soyad.trim().toLocaleUpperCase('tr-TR');
  const gorev = alan.gorev.trim().toLocaleUpperCase('tr-TR');
  const nitelik = String(alan.nitelik || '').trim().toLocaleUpperCase('tr-TR');
  const tcNo = String(alan.tcNo || '').replace(/\D/g, '');
  const kimlikler = (alan.kimlikFotoUrls || []).filter(Boolean);
  if (alan.kimlikFotoUrl && !kimlikler.includes(alan.kimlikFotoUrl)) {
    kimlikler.unshift(alan.kimlikFotoUrl);
  }
  const gonderen = alan.gonderen || alan.gonderenKampci || '';

  const doc: Record<string, unknown> = {
    id,
    ad,
    soyad,
    gorev,
    iseGirisTarihi: alan.girisTarihi,
    tarih: new Date().toISOString(),
    kimlikFotoUrl: alan.kimlikFotoUrl,
    kimlikFotoUrls: kimlikler,
    durum: 'WP_GÖNDERİLDİ',
    kaynak: KAMP_ANA_FIRMA_KAYNAK,
    firmaTipi: 'ANA_FIRMA',
    grupBildirildi: true,
    gonderenFormen: gonderen,
    kaynakPanel: alan.kaynakPanel || 'KAMPÇI',
  };
  if (nitelik) doc.nitelik = nitelik;
  if (tcNo) doc.tcNo = tcNo;
  if (alan.telefonNo?.trim()) doc.telefonNo = alan.telefonNo.trim();
  if (alan.gonderenKampci) doc.gonderenKampci = alan.gonderenKampci;
  return doc;
}
