import type { Dispatch, SetStateAction } from 'react';
import {
  CariKart,
  CariKartIslem,
  Irsaliye,
  IrsaliyeItem,
  StokKart,
  StokKartIslem,
} from '../types/erp';
import { saveDocument } from './firebase';
import {
  appendCariIslemOnce,
  applyStokGirisFromKalemler,
  buildCariEvrakHistory,
  countLinkedStok,
  linkIrsaliyeKalemler,
  resolveCariKartId,
} from './evrakCariStokSync';

export const KAPI_EVRAK_KAYNAK = 'KAPI_EVRAK';

export type KapiKalemInput = {
  urunAdi?: string;
  miktar?: number | string;
  birim?: string;
  stokKartId?: string;
  id?: string;
};

export type KapiMatchSummary = {
  cariMatched: boolean;
  cariKartId: string;
  cariUnvan: string;
  stokLinked: number;
  stokTotal: number;
  unmatchedKalemler: string[];
};

export function normalizeKapiKalemler(raw: KapiKalemInput[], prefix = 'kapi'): IrsaliyeItem[] {
  return (raw || [])
    .map((k, idx) => {
      const urunAdi = String(k.urunAdi || '').trim();
      if (!urunAdi) return null;
      const miktar = Number(k.miktar);
      return {
        id: k.id || `${prefix}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        urunAdi,
        miktar: Number.isFinite(miktar) ? miktar : 0,
        birim: String(k.birim || 'Adet').trim() || 'Adet',
        stokKartId: k.stokKartId || undefined,
      } as IrsaliyeItem;
    })
    .filter(Boolean) as IrsaliyeItem[];
}

/** Firma + kalem adlarını cari/stok kartlarıyla eşleştirir (yeni kart açmaz). */
export function matchKapiEvrakToDb(
  firma: string,
  kalemler: KapiKalemInput[],
  cariKartlar: CariKart[],
  stokKartlar: StokKart[]
): { summary: KapiMatchSummary; kalemler: IrsaliyeItem[] } {
  const cari = resolveCariKartId(firma, cariKartlar);
  const linked = linkIrsaliyeKalemler(normalizeKapiKalemler(kalemler), stokKartlar);
  const counts = countLinkedStok(linked);
  const unmatchedKalemler = linked
    .filter((k) => !k.stokKartId)
    .map((k) => k.urunAdi)
    .slice(0, 8);

  return {
    summary: {
      cariMatched: cari.matched,
      cariKartId: cari.cariKartId,
      cariUnvan: cari.cariUnvan || String(firma || '').trim(),
      stokLinked: counts.linked,
      stokTotal: counts.total,
      unmatchedKalemler,
    },
    kalemler: linked,
  };
}

/**
 * İki geçişli kontrol: 1) ham firma/kalem 2) eşleşen cari unvanı + normalize stok adlarıyla tekrar.
 * Yeni kart açmaz; mevcut cari/stoka bağlar.
 */
export function doubleCheckKapiMatch(
  firma: string,
  kalemler: KapiKalemInput[],
  cariKartlar: CariKart[],
  stokKartlar: StokKart[]
): { summary: KapiMatchSummary; kalemler: IrsaliyeItem[]; pass1: KapiMatchSummary; pass2: KapiMatchSummary } {
  const pass1 = matchKapiEvrakToDb(firma, kalemler, cariKartlar, stokKartlar);
  const pass2 = matchKapiEvrakToDb(
    pass1.summary.cariUnvan || firma,
    pass1.kalemler,
    cariKartlar,
    stokKartlar
  );
  return {
    summary: pass2.summary,
    kalemler: pass2.kalemler,
    pass1: pass1.summary,
    pass2: pass2.summary,
  };
}

export function buildKapiDraftIrsaliye(opts: {
  guvenlikEvrakId: string;
  irsaliyeNo: string;
  firma: string;
  tarih: string;
  fotoUrl?: string;
  kalemler: IrsaliyeItem[];
  cariKartId?: string;
  kaydeden?: string;
}): Irsaliye {
  const id = opts.guvenlikEvrakId;
  return {
    id,
    irsaliyeId: id,
    irsaliyeNo: String(opts.irsaliyeNo || id).trim() || id,
    firma: String(opts.firma || '').trim() || 'Bilinmeyen Firma',
    cariKartId: opts.cariKartId || undefined,
    saId: '',
    tarih: opts.tarih || new Date().toISOString().split('T')[0],
    onayDurumu: 'ONAY BEKLİYOR',
    fisEvrakUrl: opts.fotoUrl || '',
    kaynak: KAPI_EVRAK_KAYNAK,
    guvenlikEvrakId: opts.guvenlikEvrakId,
    kalemler: opts.kalemler,
    kaydeden: opts.kaydeden,
  } as Irsaliye & { kaydeden?: string };
}

/**
 * Kapı AI parse sonrası: eşleştirilmiş taslak irsaliye yazar.
 * Son onay yöneticide kalır (ONAY BEKLİYOR).
 */
export async function upsertKapiDraftIrsaliye(opts: {
  guvenlikEvrakId: string;
  firma: string;
  irsaliyeNo: string;
  tarih: string;
  fotoUrl?: string;
  kalemler: KapiKalemInput[];
  cariKartlar: CariKart[];
  stokKartlar: StokKart[];
  kaydeden?: string;
}): Promise<{ irsaliye: Irsaliye; summary: KapiMatchSummary }> {
  const { summary, kalemler } = doubleCheckKapiMatch(
    opts.firma,
    opts.kalemler,
    opts.cariKartlar,
    opts.stokKartlar
  );

  const irsaliye = buildKapiDraftIrsaliye({
    guvenlikEvrakId: opts.guvenlikEvrakId,
    irsaliyeNo: opts.irsaliyeNo || opts.guvenlikEvrakId,
    firma: summary.cariUnvan || opts.firma,
    tarih: opts.tarih,
    fotoUrl: opts.fotoUrl,
    kalemler,
    cariKartId: summary.cariKartId || undefined,
    kaydeden: opts.kaydeden,
  });

  await saveDocument('irsaliyeler', irsaliye);
  return { irsaliye, summary };
}

/**
 * Yönetici kapı evrak onayında irsaliyeyi finalize eder + cari/stok bağlar.
 * Stok miktarı yalnızca onayda artar.
 */
export async function finalizeKapiIrsaliyeApproval(opts: {
  guvenlikEvrakId: string;
  irsaliyeNo: string;
  firma: string;
  tarih: string;
  fotoUrl?: string;
  kalemler: KapiKalemInput[];
  onaylayan: string;
  cariKartlar: CariKart[];
  stokKartlar: StokKart[];
  setIrsaliyeler?: Dispatch<SetStateAction<Irsaliye[]>>;
  setCariIslemGecmisi?: Dispatch<SetStateAction<CariKartIslem[]>>;
  setStokKartlar?: Dispatch<SetStateAction<StokKart[]>>;
  setStokIslemGecmisi?: Dispatch<SetStateAction<StokKartIslem[]>>;
}): Promise<{ irsaliye: Irsaliye; summary: KapiMatchSummary }> {
  const now = new Date().toISOString();
  const { summary, kalemler } = doubleCheckKapiMatch(
    opts.firma,
    opts.kalemler,
    opts.cariKartlar,
    opts.stokKartlar
  );

  const firmaUnvan = summary.cariUnvan || String(opts.firma || '').trim();
  const irsaliye: Irsaliye = {
    id: opts.guvenlikEvrakId,
    irsaliyeId: opts.guvenlikEvrakId,
    irsaliyeNo: String(opts.irsaliyeNo || opts.guvenlikEvrakId).trim(),
    firma: firmaUnvan,
    cariKartId: summary.cariKartId || undefined,
    saId: '',
    tarih: opts.tarih,
    onayDurumu: 'ONAYLANDI',
    fisEvrakUrl: opts.fotoUrl || '',
    kaynak: KAPI_EVRAK_KAYNAK,
    guvenlikEvrakId: opts.guvenlikEvrakId,
    kalemler,
    onaylayanYonetici: opts.onaylayan,
    onayTarihi: now,
  };

  await saveDocument('irsaliyeler', irsaliye);

  opts.setIrsaliyeler?.((prev) => {
    const without = prev.filter(
      (x) => x.id !== irsaliye.id && x.irsaliyeId !== irsaliye.irsaliyeId
    );
    return [irsaliye, ...without];
  });

  if (summary.cariKartId) {
    const cariRow = buildCariEvrakHistory({
      cariKartId: summary.cariKartId,
      islemTipi: 'IRSALIYE',
      islemId: irsaliye.id,
      islemBaslik: `Kapı İrsaliyesi · ${firmaUnvan}`,
      islemDetay: `${irsaliye.irsaliyeNo} · ${kalemler.length} kalem · güvenlik kapısı`,
      tarih: opts.tarih,
      belgeNo: irsaliye.irsaliyeNo,
    });
    await saveDocument('cariIslemGecmisi', cariRow);
    appendCariIslemOnce(opts.setCariIslemGecmisi, cariRow);
  }

  applyStokGirisFromKalemler({
    kalemler,
    belgeNo: irsaliye.irsaliyeNo,
    tarih: opts.tarih,
    supplier: firmaUnvan,
    islemBaslik: 'Kapı İrsaliye Girişi',
    islemDetayPrefix: 'Güvenlik kapısı onaylı sevk ·',
    bumpMiktar: true,
    stokKartlar: opts.stokKartlar,
    setStokKartlar: opts.setStokKartlar,
    setStokIslemGecmisi: opts.setStokIslemGecmisi,
    aciklamaTag: 'Kapı İrsaliye',
  });

  return { irsaliye, summary };
}

export function formatKapiMatchLabel(summary?: Partial<KapiMatchSummary> | null): string {
  if (!summary) return '';
  const cari = summary.cariMatched ? 'Cari eşleşti' : 'Cari bulunamadı';
  const stok =
    typeof summary.stokTotal === 'number' && summary.stokTotal > 0
      ? `Stok ${summary.stokLinked || 0}/${summary.stokTotal}`
      : 'Kalem yok';
  return `${cari} · ${stok}`;
}
