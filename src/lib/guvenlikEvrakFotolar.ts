/** Kapı evrakı: 3 yöntemli fotoğraf (görünmeme sorununu çözmek için). */

export type GuvenlikFotoMetod = 'KALEM' | 'FIRMA' | 'FATURA';

export type GuvenlikFotoSlot = {
  id: string;
  dataUrl: string;
  fileName: string;
  fileType: string;
  metod: GuvenlikFotoMetod;
};

export type GuvenlikFotoPaket = {
  kalemFotolar: GuvenlikFotoSlot[];
  firmaFotolar: GuvenlikFotoSlot[];
  faturaFotolar: GuvenlikFotoSlot[];
};

export const GUVENLIK_FOTO_METOD_LABEL: Record<GuvenlikFotoMetod, string> = {
  KALEM: '1. Kalem fotoğraf',
  FIRMA: '2. Firma adı fotoğraf',
  FATURA: '3. Fatura fotoğraf',
};

export const GUVENLIK_FOTO_METOD_HINT: Record<GuvenlikFotoMetod, string> = {
  KALEM: 'Malzeme kalemleri / miktarlar net görünsün',
  FIRMA: 'Firma unvanı / antet net görünsün',
  FATURA: 'Fatura / mali belge net görünsün',
};

export function emptyFotoPaket(): GuvenlikFotoPaket {
  return { kalemFotolar: [], firmaFotolar: [], faturaFotolar: [] };
}

export function flattenGuvenlikFotolar(paket: Partial<GuvenlikFotoPaket> | null | undefined): GuvenlikFotoSlot[] {
  if (!paket) return [];
  return [
    ...(paket.kalemFotolar || []),
    ...(paket.firmaFotolar || []),
    ...(paket.faturaFotolar || []),
  ];
}

/** Geriye uyumlu tek fotoUrl: önce kalem, sonra firma, sonra fatura. */
export function pickPrimaryFotoUrl(doc: {
  fotoUrl?: string;
  fotoUrls?: string[];
  kalemFotolar?: GuvenlikFotoSlot[];
  firmaFotolar?: GuvenlikFotoSlot[];
  faturaFotolar?: GuvenlikFotoSlot[];
}): string {
  const fromPaket =
    doc.kalemFotolar?.[0]?.dataUrl ||
    doc.firmaFotolar?.[0]?.dataUrl ||
    doc.faturaFotolar?.[0]?.dataUrl ||
    '';
  if (fromPaket) return fromPaket;
  if (doc.fotoUrl) return doc.fotoUrl;
  if (Array.isArray(doc.fotoUrls) && doc.fotoUrls[0]) return doc.fotoUrls[0];
  return '';
}

export function collectAllFotoUrls(doc: {
  fotoUrl?: string;
  fotoUrls?: string[];
  kalemFotolar?: GuvenlikFotoSlot[];
  firmaFotolar?: GuvenlikFotoSlot[];
  faturaFotolar?: GuvenlikFotoSlot[];
}): string[] {
  const urls = [
    ...(doc.kalemFotolar || []).map((f) => f.dataUrl),
    ...(doc.firmaFotolar || []).map((f) => f.dataUrl),
    ...(doc.faturaFotolar || []).map((f) => f.dataUrl),
  ].filter(Boolean);
  if (urls.length) return Array.from(new Set(urls));
  if (Array.isArray(doc.fotoUrls) && doc.fotoUrls.length) return doc.fotoUrls.filter(Boolean);
  if (doc.fotoUrl) return [doc.fotoUrl];
  return [];
}

export function countPaketFotolar(paket: GuvenlikFotoPaket): number {
  return flattenGuvenlikFotolar(paket).length;
}

export function createEmptyUploadPackage(): {
  id: string;
  evrakTuru: 'İRSALİYE' | 'FATURA' | 'MAKBUZ' | 'GENEL_EVRAK';
  aciklama: string;
  firma: string;
  cariKartId: string;
} & GuvenlikFotoPaket {
  return {
    id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    evrakTuru: 'İRSALİYE',
    aciklama: '',
    firma: '',
    cariKartId: '',
    ...emptyFotoPaket(),
  };
}
