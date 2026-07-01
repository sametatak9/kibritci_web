import { normalizeYetki } from './yetkiUtils';

export const MOBIL_ONAY_YETKILERI = new Set([
  'YÖNETİCİ',
  'İDARİ_İŞLER',
  'MUHASEBE',
  'ŞANTİYE_ŞEFİ',
  'PROJE_MÜDÜRÜ',
]);

export function isFounderEmail(email?: string | null): boolean {
  const e = email?.trim().toLowerCase();
  return e === 'sametatak9@gmail.com' || e === 'santiye@kibritci.com';
}

/** İdari, Muhasebe, Şantiye Şefi, Proje Müdürü veya Kurucu onaylayabilir */
export function canApproveMobilDocuments(
  yetki?: string | null,
  email?: string | null
): boolean {
  if (isFounderEmail(email)) return true;
  return MOBIL_ONAY_YETKILERI.has(normalizeYetki(yetki));
}

export function buildSingleApprovalUpdate(email: string, yetki: string) {
  const normalized = normalizeYetki(yetki);
  const approver = email || 'sistem@kibritci.com';
  return {
    onaylayan: approver,
    onaylayanYetki: normalized,
    onayTarihi: new Date().toISOString(),
    durum: 'ONAYLANDI',
    onaylayanIdariIsler: approver,
    onaylayanMuhasebe: approver,
  };
}

export function isMobilDocPending(doc: { durum?: string; onaylayan?: string | null }): boolean {
  if (doc.durum === 'REDDEDİLDİ' || doc.durum === 'ONAYLANDI') return false;
  if (doc.onaylayan) return false;
  return (
    doc.durum === 'ONAY BEKLİYOR' ||
    doc.durum === 'BEKLEMEDE' ||
    doc.durum === 'TAMAMLANDI' ||
    !doc.durum
  );
}

export function normalizeKampSayimForDisplay(doc: Record<string, unknown>) {
  const kalemler = (doc.kalemler as Array<{ urunAdi?: string; miktar?: number; birim?: string }>) || [];
  const sayimlar: Record<string, string> = {};

  if (doc.sayimlar && typeof doc.sayimlar === 'object') {
    Object.entries(doc.sayimlar as Record<string, unknown>).forEach(([k, v]) => {
      sayimlar[k] = String(v);
    });
  } else {
    kalemler.forEach((k) => {
      const ad = k.urunAdi || '?';
      sayimlar[ad] = `${k.miktar ?? 0} ${k.birim || 'Adet'}`;
    });
  }

  return {
    kampAdi: String(doc.kampAdi || doc.yerleskeAdi || 'Kamp'),
    sayanPersonel: String(doc.sayanPersonel || doc.sayimYapan || doc.kaydeden || '-'),
    sayimlar,
    kalemler,
    kaydeden: String(doc.kaydeden || doc.sayimYapan || '-'),
  };
}

export function normalizeKampFaaliyetForDisplay(doc: Record<string, unknown>) {
  return {
    kategori: String(doc.kategori || doc.faaliyetTipi || 'Genel'),
    aciklama: String(doc.aciklama || doc.faaliyetAciklama || ''),
    photo: (doc.photo || doc.fotoUrl || null) as string | null,
    yerleske: String(doc.yerleskeAdi || doc.faaliyetYerleske || ''),
    kaydeden: String(doc.kaydeden || doc.kaydedenEmail || doc.kaydeden || '-'),
  };
}

export function buildWhatsAppUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function isLegacySahaRecord(id?: string): boolean {
  if (!id) return false;
  return id.startsWith('SF-MAY26-') || id.startsWith('SF-NISAN') || id.startsWith('sf_demo');
}
