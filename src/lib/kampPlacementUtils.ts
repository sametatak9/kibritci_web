import { KampKaydi, KampOdasi } from '../types/erp';
import { saveDocument } from './firebase';

export interface AssignKampResidentInput {
  roomId: string;
  personelIsim: string;
  personelId?: string;
  calistigiFirma?: string;
  firmaTipi?: 'ANA_FIRMA' | 'TASERON';
  kampOdalari: KampOdasi[];
  kampKayitlari: KampKaydi[];
}

export async function assignKampResident(
  input: AssignKampResidentInput
): Promise<{ reg: KampKaydi; room: KampOdasi }> {
  const targetRoom = input.kampOdalari.find((r) => r.id === input.roomId);
  if (!targetRoom) throw new Error('Oda bulunamadı');

  const currentOccupants = input.kampKayitlari.filter(
    (k) =>
      (k.odaId === input.roomId || k.roomId === input.roomId) && k.durum === 'AKTIF'
  );

  if (currentOccupants.length >= targetRoom.kapasite) {
    throw new Error(`Oda dolu (kapasite: ${targetRoom.kapasite})`);
  }

  const already = input.kampKayitlari.find(
    (k) =>
      k.durum === 'AKTIF' &&
      ((input.personelId && k.personelId === input.personelId) ||
        k.personelIsim.toLowerCase() === input.personelIsim.toLowerCase())
  );
  if (already) throw new Error(`${input.personelIsim} zaten başka bir odada aktif`);

  const reg: KampKaydi = {
    id: `reg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    personelIsim: input.personelIsim.trim(),
    personelId: input.personelId,
    odaId: input.roomId,
    roomId: input.roomId,
    yerleskeAdi: targetRoom.yerleskeAdi,
    katAdi: targetRoom.kogusNo,
    odaNo: targetRoom.odaNo,
    girisTarihi: new Date().toISOString().slice(0, 10),
    durum: 'AKTIF',
    calistigiFirma: input.calistigiFirma,
    firmaTipi: input.firmaTipi,
  };

  const newCount = currentOccupants.length + 1;
  let durum: KampOdasi['durum'] = 'KISMEN DOLU';
  if (newCount >= targetRoom.kapasite) durum = 'DOLU';

  const room: KampOdasi = { ...targetRoom, durum };

  await saveDocument('kampKayitlari', reg);
  await saveDocument('kampOdalari', room);

  return { reg, room };
}

export async function evictKampResident(
  reg: KampKaydi,
  kampOdalari: KampOdasi[],
  kampKayitlari: KampKaydi[]
): Promise<void> {
  const roomId = reg.odaId || reg.roomId;
  const targetRoom = kampOdalari.find((r) => r.id === roomId);

  const updatedReg: KampKaydi = {
    ...reg,
    durum: 'PASIF',
    cikisTarihi: new Date().toISOString().slice(0, 10),
  };
  await saveDocument('kampKayitlari', updatedReg);

  if (!targetRoom) return;

  const remaining = kampKayitlari.filter(
    (k) =>
      (k.odaId === roomId || k.roomId === roomId) &&
      k.durum === 'AKTIF' &&
      k.id !== reg.id
  );

  let durum: KampOdasi['durum'] = remaining.length === 0 ? 'BOŞ' : 'KISMEN DOLU';
  if (remaining.length >= targetRoom.kapasite) durum = 'DOLU';

  await saveDocument('kampOdalari', { ...targetRoom, durum });
}

/** Elle girilen taşeron / misafir için personel kartı oluşturma önerisi */
export function suggestPersonelKaydi(
  isim: string,
  firma: string,
  onCreatePersonel?: () => void
): void {
  if (!isim.trim()) return;
  const msg =
    `"${isim}"${firma ? ` (${firma})` : ''} veritabanında kayıtlı değil.\n\n` +
    'Bu kişiyi Personel listesine kalıcı kayıt olarak eklemek ister misiniz?';
  if (window.confirm(msg) && onCreatePersonel) {
    onCreatePersonel();
  }
}
