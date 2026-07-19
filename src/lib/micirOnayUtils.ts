import { CariKart, CariKartIslem, Irsaliye, MicirStabilizeFis } from '../types/erp';
import { saveDocument } from './firebase';
import {
  ENTO_MADEN_UNVAN,
  findEntoMadenCari,
  formatMicirMiktarLabel,
  isEntoMadenFirma,
  kgToTon,
  malzemeTipiLabel,
  MicirMalzemeTipi,
  resolveMicirKiloKg,
  tonToKg,
} from './micirUtils';

export type MicirFisOnayDurum = 'YONETICI_ONAYINDA' | 'ONAYLANDI' | 'REDDEDILDI';

export type MicirFisCorrection = {
  tarih: string;
  irsaliyeNo: string;
  plaka: string;
  tonaj: number;
  kiloKg?: number;
  malzemeTipi: MicirMalzemeTipi;
  fisGorselUrl?: string;
  firmaUnvan: string;
  cariKartId?: string;
};

export function isMicirFisPending(f?: Pick<MicirStabilizeFis, 'durum'> | null): boolean {
  return !f?.durum || f.durum === 'YONETICI_ONAYINDA';
}

export function buildMicirKalemler(
  fisId: string,
  tonaj: number,
  malzemeTipi: MicirMalzemeTipi,
  kiloKg?: number
) {
  const kg = resolveMicirKiloKg({ tonaj, kiloKg });
  const ton = kg > 0 ? kgToTon(kg) : tonaj;
  return [
    {
      id: `k_${fisId}`,
      urunAdi: malzemeTipiLabel(malzemeTipi),
      miktar: ton,
      birim: 'TON' as const,
      kiloKg: kg || tonToKg(ton),
    },
  ];
}

/** Onayda cari kart yoksa Ento Maden kartını oluşturur */
export async function ensureEntoMadenCari(
  cariKartlar: CariKart[],
  setCariKartlar?: (updater: CariKart[] | ((prev: CariKart[]) => CariKart[])) => void
): Promise<CariKart> {
  const existing = findEntoMadenCari(cariKartlar);
  if (existing) return existing;

  const created: CariKart = {
    id: `cari_ento_maden_${Date.now()}`,
    kartTipi: 'TEDARIKCI',
    kod: `CAR-ENTO-${Date.now().toString().slice(-6)}`,
    unvan: ENTO_MADEN_UNVAN,
    yetkili: '',
    telefon: '',
    eposta: '',
    vergiNo: '',
    vergiDairesi: '',
    adres: 'Mıcır & stabilize kapı irsaliyelerinden otomatik oluşturuldu.',
    iban: '',
    durum: 'AKTIF',
    notlar: 'Sistem tarafından mıcır/stabilize onayında oluşturuldu.',
  };
  await saveDocument('cariKartlar', created);
  setCariKartlar?.((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
  return created;
}

/**
 * Yönetici onayında:
 * 1) micirStabilizeFisleri güncellenir (ONAYLANDI)
 * 2) irsaliyeler sekmesine irsaliye yazılır
 * 3) cariIslemGecmisi ile Ento Maden cari kart altına bağlanır
 * 4) guvenlikGelenEvraklar ONAYLANDI yapılır
 */
export async function approveMicirFis(options: {
  fis: MicirStabilizeFis;
  correction: MicirFisCorrection;
  onaylayan: string;
  cariKartlar: CariKart[];
  setCariKartlar?: (updater: CariKart[] | ((prev: CariKart[]) => CariKart[])) => void;
  setIrsaliyeler?: (updater: Irsaliye[] | ((prev: Irsaliye[]) => Irsaliye[])) => void;
  setCariIslemGecmisi?: (
    updater: CariKartIslem[] | ((prev: CariKartIslem[]) => CariKartIslem[])
  ) => void;
}): Promise<{ irsaliye: Irsaliye; fis: MicirStabilizeFis; cariIslem: CariKartIslem }> {
  const { fis, correction, onaylayan } = options;
  const now = new Date().toISOString();

  let cariKartId = correction.cariKartId;
  let firmaUnvan = correction.firmaUnvan || ENTO_MADEN_UNVAN;

  if (!cariKartId || isEntoMadenFirma(firmaUnvan)) {
    const cari = await ensureEntoMadenCari(options.cariKartlar, options.setCariKartlar);
    cariKartId = cari.id;
    firmaUnvan = cari.unvan || ENTO_MADEN_UNVAN;
  }

  const kiloKg = resolveMicirKiloKg({
    tonaj: correction.tonaj,
    kiloKg: correction.kiloKg,
  });
  const tonaj = kiloKg > 0 ? kgToTon(kiloKg) : correction.tonaj;

  if (!correction.tarih?.trim()) {
    throw new Error('İrsaliye tarihi zorunludur.');
  }
  if (!correction.irsaliyeNo?.trim()) {
    throw new Error('İrsaliye no zorunludur.');
  }
  if (!kiloKg || kiloKg <= 0 || !tonaj || tonaj <= 0) {
    throw new Error('Kilo / tonaj zorunludur.');
  }

  const irsaliyeId = fis.irsaliyeId || `IR-MIC-${fis.id}`;
  const guvenlikEvrakId = fis.guvenlikEvrakId || `EVR-MIC-${fis.id}`;
  const kalemler = buildMicirKalemler(fis.id, tonaj, correction.malzemeTipi, kiloKg);
  const malzemeAdi = malzemeTipiLabel(correction.malzemeTipi);
  const miktarLabel = formatMicirMiktarLabel(tonaj, kiloKg);

  const updatedFis: MicirStabilizeFis = {
    ...fis,
    tarih: correction.tarih,
    irsaliyeNo: correction.irsaliyeNo.trim().toUpperCase(),
    plaka: correction.plaka.trim().toUpperCase(),
    tonaj,
    kiloKg,
    malzemeTipi: correction.malzemeTipi,
    fisGorselUrl: correction.fisGorselUrl || fis.fisGorselUrl || '',
    firmaUnvan,
    cariKartId,
    irsaliyeId,
    guvenlikEvrakId,
    durum: 'ONAYLANDI',
    onaylayanYonetici: onaylayan,
    onayTarihi: now,
    guncellenme: now,
  };

  const irsaliye: Irsaliye = {
    id: irsaliyeId,
    irsaliyeId,
    irsaliyeNo: updatedFis.irsaliyeNo,
    firma: firmaUnvan,
    cariKartId,
    tarih: updatedFis.tarih,
    onayDurumu: 'ONAYLANDI' as Irsaliye['onayDurumu'],
    fisEvrakUrl: updatedFis.fisGorselUrl || '',
    kaynak: 'MICIR_STABILIZE_FIS',
    plaka: updatedFis.plaka,
    fisNo: updatedFis.irsaliyeNo,
    micirFisId: fis.id,
    tonaj: updatedFis.tonaj,
    kiloKg: updatedFis.kiloKg,
    malzemeTipi: updatedFis.malzemeTipi,
    guvenlikEvrakId,
    kalemler,
    onaylayanYonetici: onaylayan,
    onayTarihi: now,
  };

  const cariIslem: CariKartIslem = {
    id: `cari_islem_mic_${fis.id}`,
    cariKartId: cariKartId!,
    islemTipi: 'IRSALIYE',
    islemId: irsaliyeId,
    islemBaslik: `${malzemeAdi} İrsaliyesi · ${firmaUnvan}`,
    islemDetay: `${updatedFis.irsaliyeNo} · ${updatedFis.plaka} · ${miktarLabel} · ${malzemeAdi}`,
    tarih: updatedFis.tarih,
    belgeNo: updatedFis.irsaliyeNo,
  };

  await saveDocument('micirStabilizeFisleri', updatedFis);
  await saveDocument('irsaliyeler', irsaliye);
  await saveDocument('cariIslemGecmisi', cariIslem);
  await saveDocument('guvenlikGelenEvraklar', {
    id: guvenlikEvrakId,
    evrakNo: updatedFis.irsaliyeNo,
    evrakTuru: 'İRSALİYE',
    firma: firmaUnvan,
    tarih: updatedFis.tarih,
    fotoUrl: updatedFis.fisGorselUrl || '',
    fileName: `micir_${updatedFis.irsaliyeNo}.jpg`,
    fileType: 'image/jpeg',
    durum: 'ONAYLANDI',
    aciklama: `Kapı ${malzemeAdi} irsaliyesi onaylandı · Plaka ${updatedFis.plaka} · ${miktarLabel}`,
    kaynak: 'MICIR_STABILIZE_FIS',
    micirFisId: fis.id,
    irsaliyeId,
    cariKartId,
    plaka: updatedFis.plaka,
    tonaj: updatedFis.tonaj,
    kiloKg: updatedFis.kiloKg,
    malzemeTipi: updatedFis.malzemeTipi,
    kalemler,
    onaylayanYonetici: onaylayan,
    onayTarihi: now,
    islenenEvrakTuru: 'İRSALİYE',
    aiStatus: 'SKIPPED',
  });

  if (fis.kapıLogId) {
    await saveDocument('guvenlikTankerLoglari', {
      id: fis.kapıLogId,
      onayDurumu: 'ONAYLANDI',
      irsaliyeId,
      micirFisId: fis.id,
      guncellenme: now,
    });
  }

  options.setIrsaliyeler?.((prev) => {
    const others = prev.filter((x) => x.id !== irsaliyeId && x.irsaliyeId !== irsaliyeId);
    return [irsaliye, ...others];
  });
  options.setCariIslemGecmisi?.((prev) => {
    const others = prev.filter((x) => x.id !== cariIslem.id);
    return [cariIslem, ...others];
  });

  return { irsaliye, fis: updatedFis, cariIslem };
}

export async function rejectMicirFis(options: {
  fis: MicirStabilizeFis;
  onaylayan: string;
  redNedeni?: string;
}): Promise<MicirStabilizeFis> {
  const now = new Date().toISOString();
  const guvenlikEvrakId = options.fis.guvenlikEvrakId || `EVR-MIC-${options.fis.id}`;
  const updated: MicirStabilizeFis = {
    ...options.fis,
    durum: 'REDDEDILDI',
    onaylayanYonetici: options.onaylayan,
    onayTarihi: now,
    redNedeni: options.redNedeni || '',
    guncellenme: now,
  };
  await saveDocument('micirStabilizeFisleri', updated);
  await saveDocument('guvenlikGelenEvraklar', {
    id: guvenlikEvrakId,
    durum: 'REDDEDILDI',
    onaylayanYonetici: options.onaylayan,
    onayTarihi: now,
    redNedeni: options.redNedeni || '',
    kaynak: 'MICIR_STABILIZE_FIS',
    micirFisId: options.fis.id,
  });
  if (options.fis.kapıLogId) {
    await saveDocument('guvenlikTankerLoglari', {
      id: options.fis.kapıLogId,
      onayDurumu: 'REDDEDILDI',
      micirFisId: options.fis.id,
      guncellenme: now,
    });
  }
  return updated;
}
