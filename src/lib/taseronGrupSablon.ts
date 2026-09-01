/** Taşeron WhatsApp grubu — sabit bildirim metinleri ve mesaj başına kuyruk. */

import type { Personel } from '../types/erp';
import { TASERON_PERSONEL_GOREV, withTaseronPersonelGorev } from './taseronUtils';

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

export function digitsTc(raw?: string): string {
  return String(raw || '').replace(/\D/g, '');
}

export function isTaseronGrupTalep(item?: { kaynak?: string } | null): boolean {
  return String(item?.kaynak || '') === TASERON_GRUP_KAYNAK;
}

/** Dosya adı / evrak başlığından giriş-çıkış yönü. */
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
  if (/isten\s*cikis|isten\s*ayril|cikis\s*bildir|isten\s*cikarma|isten\s*cikaril|isden\s*cikis|\bcikis\b/.test(t) && !/ise\s*giris|giris\s*bildir/.test(t)) {
    return 'cikis';
  }
  if (/ise\s*giris|ise\s*baslama|giris\s*bildir|sigortali\s*ise\s*giris|\bgiris\b/.test(t)) {
    return 'giris';
  }
  if (/cikis/.test(t)) return 'cikis';
  return null;
}

export function normalizeTaseronGrupParse(
  parsed: Partial<TaseronGrupParse> | null | undefined,
  opts?: { fileName?: string; fallbackYon?: TaseronGrupYon }
): TaseronGrupParse {
  const ad = String(parsed?.ad || '').trim().toLocaleUpperCase('tr-TR');
  const soyad = String(parsed?.soyad || '').trim().toLocaleUpperCase('tr-TR');
  const firmaAdi = String(parsed?.firmaAdi || '').trim().toLocaleUpperCase('tr-TR');
  const isGorev = String(parsed?.isGorev || '').trim().toLocaleUpperCase('tr-TR');
  const tcNo = digitsTc(parsed?.tcNo);
  const tarihRaw = String(parsed?.tarih || '').slice(0, 10);
  const tarih = /^\d{4}-\d{2}-\d{2}$/.test(tarihRaw)
    ? tarihRaw
    : new Date().toISOString().slice(0, 10);
  const yonRaw = String(parsed?.yon || '').toLocaleLowerCase('tr-TR');
  const yonFromParse: TaseronGrupYon | null = yonRaw === 'cikis' || yonRaw === 'çıkış' ? 'cikis' : yonRaw === 'giris' || yonRaw === 'giriş' ? 'giris' : null;
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
    `_Program WhatsApp grubunu dinleyemez. Gruptaki standart PDF Grup Köprüsü → Taşeron grup’a bırakılır; kadro ancak Onay havuzunda yazılır._`,
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

export function isTaseronGrupOnayHazir(item?: TaseronGrupTalepKayit | null): boolean {
  if (!isTaseronGrupTalep(item)) return false;
  const d = String(item?.durum || '');
  const pending = d === 'BEKLEMEDE' || d === 'WP_GÖNDERİLDİ' || d === 'GRUP_BILDIRILDI';
  return pending && Boolean(taseronEvrakUrlOf(item));
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
  const parts = String(personelIsim || '')
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

export function buildTaseronGirisTalepDoc(opts: {
  id: string;
  parsed: TaseronGrupParse;
  evrakUrl: string;
  gonderen: string;
}): Record<string, unknown> {
  const ad = opts.parsed.ad.trim().toLocaleUpperCase('tr-TR');
  const soyad = opts.parsed.soyad.trim().toLocaleUpperCase('tr-TR');
  const isGorev = opts.parsed.isGorev.trim().toLocaleUpperCase('tr-TR');
  const firmaAdi = opts.parsed.firmaAdi.trim().toLocaleUpperCase('tr-TR');
  const tcNo = digitsTc(opts.parsed.tcNo);
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
    grupBildirildi: false,
    girisEvrakPdfUrl: opts.evrakUrl,
    taseronGrupEvrakUrl: opts.evrakUrl,
    gonderenFormen: opts.gonderen,
  };
}

export function buildTaseronCikisTalepDoc(opts: {
  id: string;
  parsed: TaseronGrupParse;
  evrakUrl: string;
  gonderen: string;
  personelId?: string;
}): Record<string, unknown> {
  const ad = opts.parsed.ad.trim().toLocaleUpperCase('tr-TR');
  const soyad = opts.parsed.soyad.trim().toLocaleUpperCase('tr-TR');
  const isGorev = opts.parsed.isGorev.trim().toLocaleUpperCase('tr-TR');
  const firmaAdi = opts.parsed.firmaAdi.trim().toLocaleUpperCase('tr-TR');
  const tcNo = digitsTc(opts.parsed.tcNo);
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
    cikisNedeni: 'Taşeron grup evrakı — işten çıkış',
    hedefYoneticiRole: 'YÖNETİCİ',
    tarih: new Date().toISOString(),
    durum: 'BEKLEMEDE',
    kaynak: TASERON_GRUP_KAYNAK,
    grupBildirildi: false,
    cikisEvrakPdfUrl: opts.evrakUrl,
    taseronGrupEvrakUrl: opts.evrakUrl,
    gonderenFormen: opts.gonderen,
  };
}

/**
 * Onay’da taşeron kartı. Yoklama görevi TAŞERON PERSONEL (mevcut görev ezilmez).
 * PDF’deki iş = nitelik. Aktif kadronun gorev/firmaTipi/firmaAdi/durum/personelGrubu korunur.
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
    firmaAdi: existing?.firmaAdi || parsedFirma,
    personelGrubu: existing?.personelGrubu,
    fotografUrl: existing?.fotografUrl,
    sigortaEvrakUrl: taseronEvrakUrlOf(item) || existing?.sigortaEvrakUrl,
    kaynak: TASERON_GRUP_KAYNAK,
    onayDurumu: 'ONAYLANDI',
  });
}

export function findOpenTaseronGrupTalep<T extends TaseronGrupTalepKayit>(
  kuyruk: T[],
  opts: { ad?: string; soyad?: string; tcNo?: string; personelIsim?: string }
): T | undefined {
  const pending = kuyruk.filter((x) => {
    if (!isTaseronGrupTalep(x)) return false;
    const d = String(x.durum || '');
    return d === 'BEKLEMEDE' || d === 'WP_GÖNDERİLDİ' || d === 'GRUP_BILDIRILDI';
  });
  const tc = digitsTc(opts.tcNo);
  if (tc.length === 11) {
    const byTc = pending.find((x) => digitsTc(x.tcNo) === tc);
    if (byTc) return byTc;
  }
  const needle = `${opts.ad || ''} ${opts.soyad || ''}`.trim() || String(opts.personelIsim || '').trim();
  const norm = needle
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/\s+/g, ' ')
    .trim();
  if (!norm || norm.split(' ').filter(Boolean).length < 2) return undefined;
  return pending.find((x) => {
    const hay = `${x.ad || ''} ${x.soyad || ''}`.trim() || String(x.personelIsim || '');
    const n = hay
      .toLocaleLowerCase('tr-TR')
      .replace(/[ıİ]/g, 'i')
      .replace(/[şŞ]/g, 's')
      .replace(/[çÇ]/g, 'c')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u')
      .replace(/[öÖ]/g, 'o')
      .replace(/\s+/g, ' ')
      .trim();
    return n === norm;
  });
}
