import { CariKart, CariKartIslem, Irsaliye, MicirStabilizeFis } from '../types/erp';
import { saveDocument } from './firebase';
import {
  ENTO_MADEN_UNVAN,
  findEntoMadenCari,
  isEntoMadenFirma,
  malzemeTipiLabel,
  MicirMalzemeTipi,
} from './micirUtils';

export type MicirFisOnayDurum = 'YONETICI_ONAYINDA' | 'ONAYLANDI' | 'REDDEDILDI';

export type MicirFisCorrection = {
  tarih: string;
  irsaliyeNo: string;
  plaka: string;
  tonaj: number;
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
  malzemeTipi: MicirMalzemeTipi
) {
  return [
    {
      id: `k_${fisId}`,
      urunAdi: malzemeTipiLabel(malzemeTipi),
      miktar: tonaj,
      birim: 'TON' as const,
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

  const irsaliyeId = fis.irsaliyeId || `IR-MIC-${fis.id}`;
  const guvenlikEvrakId = fis.guvenlikEvrakId || `EVR-MIC-${fis.id}`;
  const kalemler = buildMicirKalemler(fis.id, correction.tonaj, correction.malzemeTipi);
  const malzemeAdi = malzemeTipiLabel(correction.malzemeTipi);

  const updatedFis: MicirStabilizeFis = {
    ...fis,
    tarih: correction.tarih,
    irsaliyeNo: correction.irsaliyeNo.trim().toUpperCase(),
    plaka: correction.plaka.trim().toUpperCase(),
    tonaj: correction.tonaj,
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
    islemBaslik: `${malzemeAdi} İrsaliyesi (Kapı)`,
    islemDetay: `${updatedFis.irsaliyeNo} · ${updatedFis.plaka} · ${updatedFis.tonaj} ton ${malzemeAdi}`,
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
    aciklama: `Kapı ${malzemeAdi} irsaliyesi onaylandı · Plaka ${updatedFis.plaka} · ${updatedFis.tonaj} ton`,
    kaynak: 'MICIR_STABILIZE_FIS',
    micirFisId: fis.id,
    irsaliyeId,
    cariKartId,
    plaka: updatedFis.plaka,
    tonaj: updatedFis.tonaj,
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
    durum: 'REDDEDİLDİ',
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
