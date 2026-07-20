import { Personel } from '../types/erp';

/** Personelde eksik görülen temel alanlar — salt uyarı, kayıt engellemez. */
export type PersonelMissingField =
  | 'TC No'
  | 'İşe Giriş'
  | 'SGK'
  | 'Fotoğraf'
  | 'Sigorta Evrakı'
  | 'Telefon';

function hasPhoto(p: Personel): boolean {
  const anyP = p as Personel & { fotograf_url?: string };
  return Boolean(String(p.fotografUrl || anyP.fotograf_url || '').trim());
}

export function getPersonelMissingDocs(p: Personel): PersonelMissingField[] {
  const missing: PersonelMissingField[] = [];
  if (!String(p.tcNo || '').trim()) missing.push('TC No');
  if (!String(p.iseGirisTarihi || '').trim()) missing.push('İşe Giriş');
  if (!String(p.sgkDurumu || '').trim()) missing.push('SGK');
  if (!hasPhoto(p)) missing.push('Fotoğraf');
  // Sigorta evrakı yalnızca SGK'lı personelde zorunlu sayılır
  const sgk = String(p.sgkDurumu || '');
  if (sgk.includes('SGK') && !String(p.sigortaEvrakUrl || '').trim()) {
    missing.push('Sigorta Evrakı');
  }
  if (!String(p.telefonNo || '').trim()) missing.push('Telefon');
  return missing;
}

export function formatPersonelMissingDocs(p: Personel): string {
  return getPersonelMissingDocs(p).join(', ');
}

export function hasPersonelMissingDocs(p: Personel): boolean {
  return getPersonelMissingDocs(p).length > 0;
}
