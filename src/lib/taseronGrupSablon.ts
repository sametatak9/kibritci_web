/** Taşeron WhatsApp grubu — program grubu dinlemez; sabit metin + evrak köprüsü. */

import type { CariKart, Personel } from '../types/erp';
import {
  digitsTc,
  isPendingPersonelOnayDurum,
  namesMatchExact,
  normalizePersonName,
} from './sgkGrupSablon';
import {
  firmaEslesir,
  getTaseronCariKartlar,
  TASERON_PERSONEL_GOREV,
  withTaseronPersonelGorev,
} from './taseronUtils';

export const TASERON_GRUP_ADI = 'Taşeron Giriş / Çıkış';
export const TASERON_GRUP_KAYNAK = 'TASERON_GRUP' as const;

export type TaseronGrupYon = 'giris' | 'cikis';

export type TaseronGrupParse = {
  yon: TaseronGrupYon;
  firmaAdi: string;
  isGorev: string;
  ad: string;
  soyad: string;
  tcNo?: string;
  tarih: string;
};

export type TaseronGrupTalepKayit = {
  id?: string;
  ad?: string;
  soyad?: string;
  personelIsim?: string;
  tcNo?: string;
  firmaAdi?: string;
  firmaTipi?: string;
  gorev?: string;
  nitelik?: string;
  taseronIsGorev?: string;
  isGorev?: string;
  iseGirisTarihi?: string;
  cikisTarihi?: string;
  personelId?: string;
  durum?: string;
  kaynak?: string;
  girisEvrakPdfUrl?: string;
  cikisEvrakPdfUrl?: string;
  taseronGrupEvrakUrl?: string;
  grupBildirildi?: boolean;
};

function trDate(iso: string): string {
  const raw = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw || '—';
  const [y, m, d] = raw.split('-');
  return `${d}.${m}.${y}`;
}

function line(label: string, value?: string) {
  const v = String(value || '').trim();
  return v ? `*${label}:* ${v}` : '';
}

export function isTaseronGrupTalep(item?: { kaynak?: string } | null): boolean {
  return String(item?.kaynak || '') === TASERON_GRUP_KAYNAK;
}

/** Dosya adı / evrak / grup metninden giriş-çıkış yönü. */
export function inferTaseronYonFromText(raw?: string): TaseronGrupYon | null {
  const t = String(raw || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
  if (!t.trim()) return null;
  const cikisHit =
    /isten\s*cikis|isten\s*ayril|cikis\s*bildir|isten\s*cikarma|isten\s*cikaril|isden\s*cikis|isten\s*cikis/.test(t) ||
    (/\bcikis\b/.test(t) && !/ise\s*giris|giris\s*bildir/.test(t));
  const girisHit = /ise\s*giris|ise\s*baslama|giris\s*bildir|sigortali\s*ise\s*giris|\bgiris\b/.test(t);
  if (cikisHit && !girisHit) return 'cikis';
  if (girisHit && !cikisHit) return 'giris';
  if (cikisHit) return 'cikis';
  if (girisHit) return 'giris';
  return null;
}

export function parseIsoOrTrDate(raw?: string): string {
  const s = String(raw || '').trim();
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const tr = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (tr) return `${tr[3]}-${tr[2].padStart(2, '0')}-${tr[1].padStart(2, '0')}`;
  return '';
}

function labeledValue(text: string, labels: string[]): string {
  const lines = String(text || '').split(/\r?\n/);
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${escaped}\\s*:\\s*(.+)$`, 'i');
    for (const ln of lines) {
      const clean = ln.replace(/\*/g, '').trim();
      const m = clean.match(re);
      if (m?.[1]) return m[1].replace(/^[_ ]+|[_ ]+$/g, '').trim();
    }
  }
  return '';
}

function splitAdSoyad(full: string): { ad: string; soyad: string } {
  const parts = String(full || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { ad: '', soyad: '' };
  if (parts.length === 1) return { ad: parts[0].toLocaleUpperCase('tr-TR'), soyad: '' };
  return {
    ad: parts[0].toLocaleUpperCase('tr-TR'),
    soyad: parts.slice(1).join(' ').toLocaleUpperCase('tr-TR'),
  };
}

/**
 * Gruptan kopyalanan sabit metni veya etiketli satırları okur.
 * Haftalık isim listesi beklenmez — tek kişi.
 */
export function parseTaseronGrupWhatsAppText(raw: string): Partial<TaseronGrupParse> {
  const text = String(raw || '').trim();
  if (!text) return {};
  const yon = inferTaseronYonFromText(text) || undefined;
  const adSoyad = labeledValue(text, ['Ad Soyad', 'Adı Soyadı', 'Personel', 'Isim', 'İsim']);
  const split = splitAdSoyad(adSoyad);
  const ad = labeledValue(text, ['Ad', 'Adı']) || split.ad;
  const soyad = labeledValue(text, ['Soyad', 'Soyadı']) || split.soyad;
  const firmaAdi = labeledValue(text, ['Firma', 'Taşeron', 'Taseron', 'İşveren', 'Unvan', 'Ünvan', 'Şirket']);
  const isGorev = labeledValue(text, ['Yapılan iş', 'Yapilan is', 'İş', 'Is', 'Nitelik', 'Meslek', 'Görev tanımı']);
  const tcNo = digitsTc(labeledValue(text, ['TC Kimlik', 'TC', 'T.C.', 'Kimlik No']) || text.match(/\b\d{11}\b/)?.[0]);
  const tarih =
    parseIsoOrTrDate(labeledValue(text, ['Giriş tarihi', 'Giris tarihi', 'Çıkış tarihi', 'Cikis tarihi', 'Tarih'])) ||
    parseIsoOrTrDate(text);
  return {
    yon,
    ad: ad ? ad.toLocaleUpperCase('tr-TR') : undefined,
    soyad: soyad ? soyad.toLocaleUpperCase('tr-TR') : undefined,
    firmaAdi: firmaAdi ? firmaAdi.toLocaleUpperCase('tr-TR') : undefined,
    isGorev: isGorev ? isGorev.toLocaleUpperCase('tr-TR') : undefined,
    tcNo: tcNo || undefined,
    tarih: tarih || undefined,
  };
}

export function normalizeTaseronGrupParse(
  parsed: Partial<TaseronGrupParse> | null | undefined,
  opts?: { fileName?: string; fallbackYon?: TaseronGrupYon }
): TaseronGrupParse {
  const ad = String(parsed?.ad || '')
    .trim()
    .toLocaleUpperCase('tr-TR');
  const soyad = String(parsed?.soyad || '')
    .trim()
    .toLocaleUpperCase('tr-TR');
  const firmaAdi = String(parsed?.firmaAdi || '')
    .trim()
    .toLocaleUpperCase('tr-TR');
  const isGorev = String(parsed?.isGorev || '')
    .trim()
    .toLocaleUpperCase('tr-TR');
  const tcNo = digitsTc(parsed?.tcNo);
  const tarih = parseIsoOrTrDate(parsed?.tarih) || new Date().toISOString().slice(0, 10);
  const yonRaw = String(parsed?.yon || '').toLocaleLowerCase('tr-TR');
  const yonFromParse: TaseronGrupYon | null =
    yonRaw === 'cikis' || yonRaw === 'çıkış' ? 'cikis' : yonRaw === 'giris' || yonRaw === 'giriş' ? 'giris' : null;
  const yon =
    yonFromParse ||
    inferTaseronYonFromText(`${parsed?.isGorev || ''} ${opts?.fileName || ''}`) ||
    opts?.fallbackYon ||
    'giris';
  return {
    yon,
    firmaAdi,
    isGorev,
    ad,
    soyad,
    tcNo: tcNo || undefined,
    tarih,
  };
}

/** Gruptaki ünvanı mevcut taşeron cari kartıyla hizalar; yoksa metni büyük harf bırakır. */
export function resolveTaseronGrupFirmaAdi(raw: string, cariKartlar: CariKart[] = []): string {
  const name = String(raw || '')
    .trim()
    .toLocaleUpperCase('tr-TR');
  if (!name) return '';
  const hit = getTaseronCariKartlar(cariKartlar).find((c) => firmaEslesir(c.unvan, name));
  return (hit?.unvan || name).trim();
}

export function buildTaseronGirisWhatsAppText(b: {
  ad: string;
  soyad: string;
  tcNo?: string;
  firmaAdi: string;
  isGorev?: string;
  girisTarihi: string;
  gonderen?: string;
}): string {
  return [
    `*KİBRİTÇİ — ${TASERON_GRUP_ADI}*`,
    `*İŞE GİRİŞ (TAŞERON GRUP)*`,
    `----------------------------------------`,
    line('Ad Soyad', `${b.ad} ${b.soyad}`.trim()),
    line('TC Kimlik', b.tcNo),
    line('Firma', b.firmaAdi),
    line('Yapılan iş', b.isGorev),
    line('Yoklama görevi', TASERON_PERSONEL_GOREV),
    line('Giriş tarihi', trDate(b.girisTarihi)),
    line('Gönderen', b.gonderen),
    `----------------------------------------`,
    `_Program WhatsApp grubunu dinleyemez. Gruptaki mesaj / standart PDF Grup Köprüsü → Taşeron grup’a bırakılır; kadro ancak Onay havuzunda yazılır._`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildTaseronCikisWhatsAppText(b: {
  ad: string;
  soyad: string;
  tcNo?: string;
  firmaAdi?: string;
  isGorev?: string;
  cikisTarihi: string;
  gonderen?: string;
}): string {
  return [
    `*KİBRİTÇİ — ${TASERON_GRUP_ADI}*`,
    `*İŞTEN ÇIKIŞ (TAŞERON GRUP)*`,
    `----------------------------------------`,
    line('Ad Soyad', `${b.ad} ${b.soyad}`.trim()),
    line('TC Kimlik', b.tcNo),
    line('Firma', b.firmaAdi),
    line('Yapılan iş', b.isGorev),
    line('Çıkış tarihi', trDate(b.cikisTarihi)),
    line('Gönderen', b.gonderen),
    `----------------------------------------`,
    `_Çıkış kartı burada pasife alınmaz. Onay → Personel giriş-çıkış’ta resmileşir._`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function taseronIsGorevOf(item?: TaseronGrupTalepKayit | null): string {
  if (!item) return '';
  return String(item.nitelik || item.taseronIsGorev || item.isGorev || '').trim();
}

export function taseronEvrakUrlOf(item?: TaseronGrupTalepKayit | null): string {
  if (!item) return '';
  return String(item.taseronGrupEvrakUrl || item.girisEvrakPdfUrl || item.cikisEvrakPdfUrl || '');
}

/** Onay hazır: bekleyen kuyruk + (evrak veya gruptan transkripsiyon). */
export function isTaseronGrupOnayHazir(item?: TaseronGrupTalepKayit | null): boolean {
  if (!isTaseronGrupTalep(item)) return false;
  if (!isPendingPersonelOnayDurum(item?.durum)) return false;
  const adSoyad = normalizePersonName(item?.ad, item?.soyad) || normalizePersonName(item?.personelIsim || '');
  if (!adSoyad || adSoyad.split(' ').filter(Boolean).length < 2) return false;
  if (!String(item?.firmaAdi || '').trim()) return false;
  return Boolean(taseronEvrakUrlOf(item)) || item?.grupBildirildi === true;
}

export function taseronGrupDurumEtiketi(durum?: string | null, kind?: TaseronGrupYon): string {
  const d = String(durum || '');
  const cikis = kind === 'cikis';
  if (d === 'ONAYLANDI' || d === 'KAYIT_TAMAMLANDI') {
    return cikis ? 'KAYIT TAMAMLANDI (TAŞERON ÇIKIŞ)' : 'KAYIT TAMAMLANDI (TAŞERON GİRİŞ)';
  }
  if (d === 'REDDEDİLDİ') return 'REDDEDİLDİ';
  if (d === 'BEKLEMEDE' || d === 'WP_GÖNDERİLDİ' || d === 'GRUP_BILDIRILDI') {
    return cikis ? 'TAŞERON GRUP — ÇIKIŞ ONAY BEKLİYOR' : 'TAŞERON GRUP — GİRİŞ ONAY BEKLİYOR';
  }
  return d || '—';
}

function splitName(ad?: string, soyad?: string, personelIsim?: string): { ad: string; soyad: string } {
  const a = String(ad || '').trim();
  const s = String(soyad || '').trim();
  if (a || s) {
    return {
      ad: a.toLocaleUpperCase('tr-TR'),
      soyad: s.toLocaleUpperCase('tr-TR'),
    };
  }
  return splitAdSoyad(personelIsim || '');
}

export function buildTaseronGirisTalepDoc(opts: {
  id: string;
  parsed: TaseronGrupParse;
  evrakUrl?: string;
  gonderen: string;
}): Record<string, unknown> {
  const ad = opts.parsed.ad.trim().toLocaleUpperCase('tr-TR');
  const soyad = opts.parsed.soyad.trim().toLocaleUpperCase('tr-TR');
  const isGorev = opts.parsed.isGorev.trim().toLocaleUpperCase('tr-TR');
  const firmaAdi = opts.parsed.firmaAdi.trim().toLocaleUpperCase('tr-TR');
  const tcNo = digitsTc(opts.parsed.tcNo);
  const evrak = opts.evrakUrl || '';
  return {
    id: opts.id,
    ad,
    soyad,
    personelIsim: `${ad} ${soyad}`.trim(),
    tcNo: tcNo || '',
    firmaAdi,
    firmaTipi: 'TASERON',
    gorev: TASERON_PERSONEL_GOREV,
    nitelik: isGorev || undefined,
    taseronIsGorev: isGorev || undefined,
    iseGirisTarihi: opts.parsed.tarih,
    tarih: new Date().toISOString(),
    durum: 'BEKLEMEDE',
    kaynak: TASERON_GRUP_KAYNAK,
    grupBildirildi: true,
    girisEvrakPdfUrl: evrak || undefined,
    taseronGrupEvrakUrl: evrak || undefined,
    gonderenFormen: opts.gonderen,
  };
}

export function buildTaseronCikisTalepDoc(opts: {
  id: string;
  parsed: TaseronGrupParse;
  evrakUrl?: string;
  gonderen: string;
  personelId?: string;
}): Record<string, unknown> {
  const ad = opts.parsed.ad.trim().toLocaleUpperCase('tr-TR');
  const soyad = opts.parsed.soyad.trim().toLocaleUpperCase('tr-TR');
  const isGorev = opts.parsed.isGorev.trim().toLocaleUpperCase('tr-TR');
  const firmaAdi = opts.parsed.firmaAdi.trim().toLocaleUpperCase('tr-TR');
  const tcNo = digitsTc(opts.parsed.tcNo);
  const evrak = opts.evrakUrl || '';
  return {
    id: opts.id,
    ad,
    soyad,
    personelIsim: `${ad} ${soyad}`.trim(),
    personelId: opts.personelId || '',
    personelGorev: TASERON_PERSONEL_GOREV,
    personelMaas: 0,
    tcNo: tcNo || '',
    firmaAdi,
    firmaTipi: 'TASERON',
    nitelik: isGorev || undefined,
    taseronIsGorev: isGorev || undefined,
    cikisTarihi: opts.parsed.tarih,
    cikisNedeni: 'Taşeron grup — işten çıkış',
    hedefYoneticiRole: 'YÖNETİCİ',
    tarih: new Date().toISOString(),
    durum: 'BEKLEMEDE',
    kaynak: TASERON_GRUP_KAYNAK,
    grupBildirildi: true,
    cikisEvrakPdfUrl: evrak || undefined,
    taseronGrupEvrakUrl: evrak || undefined,
    gonderenFormen: opts.gonderen,
  };
}

/**
 * Onay’da taşeron kartı. Yoklama görevi TAŞERON PERSONEL (mevcut özel görev ezilmez).
 * PDF/grup metnindeki iş = nitelik. Aktif kadronun gorev/firmaTipi/firmaAdi/durum/personelGrubu korunur.
 */
export function buildTaseronGrupPersonelCandidate(
  item: TaseronGrupTalepKayit,
  existing?: Personel | null
): Personel {
  const { ad, soyad } = splitName(item.ad, item.soyad, item.personelIsim);
  const isGorev = taseronIsGorevOf(item).toLocaleUpperCase('tr-TR');
  const tcNo = digitsTc(item.tcNo) || existing?.tcNo || '';
  const parsedFirma = String(item.firmaAdi || '').trim();
  const iseGirisTarihi = String(item.iseGirisTarihi || new Date().toISOString()).slice(0, 10);

  if (existing && existing.durum !== false) {
    return withTaseronPersonelGorev({
      ...existing,
      tcNo: existing.tcNo || tcNo,
      ad: existing.ad || ad,
      soyad: existing.soyad || soyad,
      nitelik: isGorev || existing.nitelik,
      kaynak: TASERON_GRUP_KAYNAK,
    });
  }

  const rehire = Boolean(existing && existing.durum === false);
  return withTaseronPersonelGorev({
    id: existing?.id || item.personelId || `p_${Date.now()}`,
    tcNo,
    ad: ad || existing?.ad || '',
    soyad: soyad || existing?.soyad || '',
    babaAdi: existing?.babaAdi || '',
    dogumTarihi: existing?.dogumTarihi || '',
    telefonNo: existing?.telefonNo || '',
    eposta: existing?.eposta || '',
    adres: existing?.adres || '',
    il: existing?.il || '',
    ilce: existing?.ilce || '',
    departman: existing?.departman || 'ŞANTİYE',
    gorev: existing?.gorev || TASERON_PERSONEL_GOREV,
    nitelik: isGorev || existing?.nitelik,
    iseGirisTarihi: rehire ? iseGirisTarihi : existing?.iseGirisTarihi || iseGirisTarihi,
    cinsiyet: existing?.cinsiyet || 'Belirtilmedi',
    maas: existing?.maas ?? 0,
    ucretTipi: existing?.ucretTipi || 'Aylık',
    sgkDurumu: existing?.sgkDurumu || "SGK'lı",
    bankaAdi: existing?.bankaAdi || '',
    subeAdi: existing?.subeAdi || '',
    ibanNo: existing?.ibanNo || '',
    durum: true,
    firmaTipi: 'TASERON',
    firmaAdi: parsedFirma || existing?.firmaAdi,
    personelGrubu: existing?.personelGrubu,
    fotografUrl: existing?.fotografUrl,
    sigortaEvrakUrl: taseronEvrakUrlOf(item) || existing?.sigortaEvrakUrl,
    kaynak: TASERON_GRUP_KAYNAK,
    onayDurumu: 'ONAYLANDI',
    istenCikisTarihi: rehire ? '' : existing?.istenCikisTarihi,
  });
}

export function findOpenTaseronGrupTalep<T extends TaseronGrupTalepKayit>(
  kuyruk: T[],
  opts: { ad?: string; soyad?: string; tcNo?: string; personelIsim?: string }
): T | undefined {
  const pending = kuyruk.filter((x) => isTaseronGrupTalep(x) && isPendingPersonelOnayDurum(x.durum));
  const tc = digitsTc(opts.tcNo);
  if (tc.length === 11) {
    const byTc = pending.find((x) => digitsTc(x.tcNo) === tc);
    if (byTc) return byTc;
  }
  return pending.find((x) => namesMatchExact(x, opts));
}

export function taseronGrupNamesMatch(
  a: { ad?: string; soyad?: string; personelIsim?: string },
  b: { ad?: string; soyad?: string; personelIsim?: string }
): boolean {
  return namesMatchExact(a, b);
}

export { digitsTc, namesMatchExact };
