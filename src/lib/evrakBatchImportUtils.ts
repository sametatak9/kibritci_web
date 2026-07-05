import { PDFDocument } from 'pdf-lib';
import { CariKart, StokKart } from '../types/erp';

export const normalizeMatchText = (raw: string) =>
  String(raw || '')
    .toLowerCase()
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/\s+/g, ' ')
    .trim();

export async function splitPdfFileToPageBase64(file: File): Promise<string[]> {
  const buf = await file.arrayBuffer();
  const src = await PDFDocument.load(buf, { ignoreEncryption: true });
  const pages: string[] = [];
  for (let i = 0; i < src.getPageCount(); i++) {
    const one = await PDFDocument.create();
    const [copied] = await one.copyPages(src, [i]);
    one.addPage(copied);
    const bytes = await one.save();
    const binary = new Uint8Array(bytes);
    let bin = '';
    for (let j = 0; j < binary.length; j++) bin += String.fromCharCode(binary[j]);
    pages.push(btoa(bin));
  }
  return pages;
}

export function findCariMatch(unvan: string, cariler: CariKart[]): CariKart | undefined {
  const norm = normalizeMatchText(unvan);
  if (!norm) return undefined;
  return cariler.find((c) => {
    const cu = normalizeMatchText(c.unvan);
    return cu === norm || cu.includes(norm) || norm.includes(cu);
  });
}

export function findStokMatch(urunAdi: string, stoklar: StokKart[]): StokKart | undefined {
  const norm = normalizeMatchText(urunAdi);
  if (!norm) return undefined;
  return stoklar.find((s) => normalizeMatchText(s.stokAdi) === norm);
}

export function autoEnsureCari(
  supplierName: string,
  cariler: CariKart[],
  sourceNote: string
): { cariler: CariKart[]; cari: CariKart | null } {
  const name = supplierName.trim();
  if (!name) return { cariler, cari: null };
  const existing = findCariMatch(name, cariler);
  if (existing) return { cariler, cari: existing };
  const cari: CariKart = {
    id: `ck_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    kartTipi: 'TEDARIKCI',
    kod: `CAR-${Math.floor(100 + Math.random() * 900)}`,
    unvan: name,
    yetkili: 'Toplu Evrak Aktarım',
    telefon: '',
    eposta: '',
    vergiNo: '',
    vergiDairesi: '',
    adres: 'Toplu PDF evrak aktarımından otomatik oluşturuldu.',
    iban: '',
    durum: 'AKTIF',
    notlar: sourceNote,
  };
  return { cariler: [cari, ...cariler], cari };
}

export function autoEnsureStok(
  urunAdi: string,
  birim: string,
  stoklar: StokKart[],
  sourceNote: string
): { stoklar: StokKart[]; stok: StokKart | null } {
  const name = urunAdi.trim();
  if (!name) return { stoklar, stok: null };
  const existing = findStokMatch(name, stoklar);
  if (existing) return { stoklar, stok: existing };
  const stok: StokKart = {
    id: `sk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    stokKodu: `STK-${Math.floor(1000 + Math.random() * 9000)}`,
    stokAdi: name,
    kategori: '157-46 Dograma / İnşaat Malzemesi',
    birim: birim || 'ADET',
    kritikSeviye: 5,
    durum: 'AKTIF',
    aciklama: sourceNote,
  };
  return { stoklar: [stok, ...stoklar], stok };
}

export type BatchImportRow = {
  pageNo: number;
  status: 'pending' | 'parsing' | 'ok' | 'error' | 'skipped';
  detectedType?: string;
  evrakNo?: string;
  firma?: string;
  message?: string;
};
