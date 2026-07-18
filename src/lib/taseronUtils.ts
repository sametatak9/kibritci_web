import { CariKart, KampKaydi, KampOdasi, OperatorFaaliyet, Personel, TaseronEnerjiKaydi, TaseronSayacOlcum, TaseronYemekKaydi } from '../types/erp';

export function getTaseronCariKartlar(cariKartlar: CariKart[]): CariKart[] {
  return cariKartlar.filter((c) => c.kartTipi === 'TASERON' && c.durum !== 'PASIF');
}

/** Boşlukları sadeleştir + tr-TR küçük harf (YURT MEKANİK ↔ Yurt Mekanik) */
export function normFirma(s: string): string {
  return String(s || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

/** Türkçe karakterleri katla — Ltd/Şti farklarını da ayıklar */
export function foldFirma(s: string): string {
  return normFirma(s)
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripFirmaSuffix(s: string): string {
  return foldFirma(s)
    .replace(
      /\b(ltd|sti|as|a s|san|tic|insaat|ins|ticaret|limited|sirketi|sirket)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function firmaEslesir(a: string, b: string): boolean {
  const left = String(a || '').trim();
  const right = String(b || '').trim();
  if (!left || !right) return false;
  if (normFirma(left) === normFirma(right)) return true;
  if (foldFirma(left) === foldFirma(right)) return true;
  const sa = stripFirmaSuffix(left);
  const sb = stripFirmaSuffix(right);
  if (sa.length < 4 || sb.length < 4) return false;
  if (sa === sb) return true;
  // "Demirkaan" ↔ "Demirkaan İnşaat Ltd. Şti." gibi kısmi eşleşme
  return sa.includes(sb) || sb.includes(sa);
}

export function faaliyetlerForTaseron(
  faaliyetler: OperatorFaaliyet[],
  taseron: CariKart,
  ay?: number,
  yil?: number
): OperatorFaaliyet[] {
  return faaliyetler.filter((f) => {
    const firmaOk =
      (f.firmaId && f.firmaId === taseron.id) ||
      firmaEslesir(f.firmaAdi, taseron.unvan);
    if (!firmaOk) return false;
    if (ay != null && yil != null) {
      const d = new Date(f.tarih);
      return d.getMonth() + 1 === ay && d.getFullYear() === yil;
    }
    return true;
  });
}

export function sayacFarki(o: TaseronSayacOlcum): number {
  return Math.max(0, (o.sonOkuma || 0) - (o.ilkOkuma || 0));
}

export function sayacTutari(o: TaseronSayacOlcum): number {
  return Math.round(sayacFarki(o) * (o.birimFiyat || 0) * 100) / 100;
}

export function enerjiToplamTutar(kayit: Pick<TaseronEnerjiKaydi, 'elektrik' | 'su' | 'dogalgaz'>): number {
  return sayacTutari(kayit.elektrik) + sayacTutari(kayit.su) + sayacTutari(kayit.dogalgaz);
}

export function oncekiDonem(ay: number, yil: number): { ay: number; yil: number } {
  if (ay <= 1) return { ay: 12, yil: yil - 1 };
  return { ay: ay - 1, yil };
}

export function donemKey(ay: number, yil: number): string {
  return `${String(ay).padStart(2, '0')}-${yil}`;
}

export function ayAdi(ay: number): string {
  const names = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
  ];
  return names[ay - 1] || String(ay);
}

/** Önceki ayın son okuması → bu ayın ilk okuması */
export function ilkOkumaFromOncekiAy(
  kayitlar: TaseronEnerjiKaydi[],
  taseronId: string,
  ay: number,
  yil: number
): { elektrik: number; su: number; dogalgaz: number } {
  const prev = oncekiDonem(ay, yil);
  const onceki = kayitlar.find(
    (k) =>
      k.taseronCariId === taseronId &&
      k.donemAy === String(prev.ay).padStart(2, '0') &&
      k.donemYil === String(prev.yil)
  );
  if (!onceki) {
    return { elektrik: 0, su: 0, dogalgaz: 0 };
  }
  return {
    elektrik: onceki.elektrik.sonOkuma,
    su: onceki.su.sonOkuma,
    dogalgaz: onceki.dogalgaz.sonOkuma,
  };
}

export function yemekAylikOzet(
  kayitlar: TaseronYemekKaydi[],
  taseronId: string,
  ay: number,
  yil: number
): { sabah: number; ogle: number; aksam: number; gunSayisi: number } {
  const filtered = kayitlar.filter((k) => {
    if (k.taseronCariId !== taseronId) return false;
    const d = new Date(k.tarih);
    return d.getMonth() + 1 === ay && d.getFullYear() === yil;
  });
  return {
    sabah: filtered.reduce((s, k) => s + k.sabah, 0),
    ogle: filtered.reduce((s, k) => s + k.ogle, 0),
    aksam: filtered.reduce((s, k) => s + k.aksam, 0),
    gunSayisi: filtered.length,
  };
}

export function makineEtiketi(f: OperatorFaaliyet): string {
  if (f.makineKaynak === 'MANUEL' && f.makineManuelAd) return f.makineManuelAd;
  if (f.makineKaynak === 'KIRALIK' || f.operatorTipi === 'KİRALIK') return `Kiralık · ${f.aracPlaka || '—'}`;
  return f.aracPlaka || f.aracId || 'Demirbaş Makine';
}

export function hesaplaKesintiTutari(toplamSaat: number, saatlikUcret: number): number {
  return Math.round(toplamSaat * saatlikUcret * 100) / 100;
}

function normalizePersonelName(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
}

export function personelForTaseron(personeller: Personel[], taseron: CariKart): Personel[] {
  const unvan = taseron?.unvan || '';
  return personeller
    .filter((p) => {
      const firmaAdi = String(p.firmaAdi || '').trim();
      if (!firmaAdi || !unvan) return false;
      // Firma adı cari unvan ile eşleşiyorsa göster (firmaTipi yanlış olsa bile)
      return firmaEslesir(firmaAdi, unvan);
    })
    .sort((a, b) =>
      `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, 'tr', { sensitivity: 'base' })
    );
}

/** Herhangi bir cari kart için bağlı personeller (taşeron / tedarikçi adı eşleşmesi) */
export function personelForCariKart(personeller: Personel[], cari: CariKart): Personel[] {
  return personelForTaseron(personeller, cari);
}

export function formatPersonelKampYerlesim(
  personel: Personel,
  kampKayitlari: KampKaydi[],
  kampOdalari: KampOdasi[]
): string {
  const fullName = `${personel.ad} ${personel.soyad}`.trim();
  const activeStay = kampKayitlari.find(
    (k) =>
      k.durum === 'AKTIF' &&
      ((personel.id && k.personelId === personel.id) ||
        normalizePersonelName(k.personelIsim || '') === normalizePersonelName(fullName))
  );
  if (!activeStay) return '— Kamp ataması yok';

  const room = kampOdalari.find(
    (r) => r.id === activeStay.odaId || r.id === activeStay.roomId
  );
  const yerleske = room?.yerleskeAdi || activeStay.yerleskeAdi || 'Yerleşke';
  const kat = room?.kogusNo || activeStay.katAdi || 'Kat';
  const oda = room?.odaNo || activeStay.odaNo || '?';
  return `${yerleske} · ${kat} · Oda ${oda}`;
}
