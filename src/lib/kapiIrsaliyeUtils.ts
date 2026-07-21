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

export type CariOneri = {
  id: string;
  unvan: string;
  reason: 'TAM' | 'ICERIR' | 'YAKIN';
};

export type StokOneri = {
  id: string;
  stokAdi: string;
  birim?: string;
  reason: 'TAM' | 'ICERIR' | 'YAKIN';
};

/** Kapı evrak girişinde firma yazılırken DB’deki cari kart önerileri (yeni kart açmaz). */
export function suggestCariFromDb(
  query: string,
  cariler: CariKart[],
  limit = 6
): CariOneri[] {
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const seen = new Set<string>();
  const out: CariOneri[] = [];

  const push = (c: CariKart | undefined, reason: CariOneri['reason']) => {
    if (!c?.id || seen.has(c.id)) return;
    seen.add(c.id);
    out.push({ id: c.id, unvan: c.unvan, reason });
  };

  const exact = resolveCariKartId(q, cariler);
  if (exact.matched) {
    const hit = cariler.find((c) => c.id === exact.cariKartId);
    push(hit, 'TAM');
  }

  const qNorm = q
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o');

  for (const c of cariler) {
    if (out.length >= limit) break;
    const cu = String(c.unvan || '')
      .toLocaleLowerCase('tr-TR')
      .replace(/[ıİ]/g, 'i')
      .replace(/[şŞ]/g, 's')
      .replace(/[çÇ]/g, 'c')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u')
      .replace(/[öÖ]/g, 'o');
    if (!cu) continue;
    if (cu.includes(qNorm) || qNorm.includes(cu)) push(c, 'ICERIR');
  }

  // Yakın unvanlar (yazım farkı)
  const scored = cariler
    .map((c) => {
      const cu = String(c.unvan || '').trim();
      if (!cu) return null;
      const a = qNorm;
      const b = cu
        .toLocaleLowerCase('tr-TR')
        .replace(/[ıİ]/g, 'i')
        .replace(/[şŞ]/g, 's')
        .replace(/[çÇ]/g, 'c')
        .replace(/[ğĞ]/g, 'g')
        .replace(/[üÜ]/g, 'u')
        .replace(/[öÖ]/g, 'o');
      let dist = 0;
      const max = Math.max(a.length, b.length);
      if (!max) return null;
      // basit fark oranı — çok uzun metinde erken kes
      if (Math.abs(a.length - b.length) > 4) return null;
      const n = Math.min(a.length, b.length);
      for (let i = 0; i < n; i++) if (a[i] !== b[i]) dist++;
      dist += Math.abs(a.length - b.length);
      return dist <= 3 ? { c, dist } : null;
    })
    .filter(Boolean) as Array<{ c: CariKart; dist: number }>;

  scored
    .sort((x, y) => x.dist - y.dist)
    .forEach((row) => {
      if (out.length < limit) push(row.c, 'YAKIN');
    });

  return out.slice(0, limit);
}

/** Kalem adı için stok kartı önerileri (yeni kart açmaz). */
export function suggestStokFromDb(
  urunAdi: string,
  stoklar: StokKart[],
  limit = 5
): StokOneri[] {
  const linked = linkIrsaliyeKalemler(
    [{ id: 'tmp', urunAdi: String(urunAdi || '').trim(), miktar: 0, birim: 'Adet' }],
    stoklar
  );
  const hitId = linked[0]?.stokKartId;
  if (hitId) {
    const s = stoklar.find((x) => x.id === hitId);
    if (s) return [{ id: s.id, stokAdi: s.stokAdi, birim: s.birim, reason: 'TAM' }];
  }

  const q = String(urunAdi || '').trim().toLocaleLowerCase('tr-TR');
  if (q.length < 2) return [];
  const out: StokOneri[] = [];
  for (const s of stoklar) {
    if (out.length >= limit) break;
    const sn = String(s.stokAdi || '').toLocaleLowerCase('tr-TR');
    if (sn.includes(q) || q.includes(sn)) {
      out.push({ id: s.id, stokAdi: s.stokAdi, birim: s.birim, reason: 'ICERIR' });
    }
  }
  return out;
}

export function cariOneriReasonLabel(reason: CariOneri['reason']): string {
  if (reason === 'TAM') return 'Tam eşleşme';
  if (reason === 'ICERIR') return 'İsim benzeri';
  return 'Yakın unvan';
}

