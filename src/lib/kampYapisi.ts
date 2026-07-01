import { KampKat, KampOdasi, KampYerleske } from '../types/erp';
import { db, fetchCollection, removeDocument, saveDocument } from './firebase';

export async function createKampYerleske(ad: string, olusturan?: string): Promise<KampYerleske> {
  const trimmed = ad.trim();
  if (!trimmed) throw new Error('Yerleşke adı boş olamaz');
  const item: KampYerleske = {
    id: `ky_${Date.now()}`,
    ad: trimmed,
    olusturmaTarihi: new Date().toISOString(),
    olusturan,
  };
  await saveDocument('kampYerleskeleri', item);
  return item;
}

export async function createKampKat(
  yerleske: KampYerleske,
  ad: string,
  sira = 1
): Promise<KampKat> {
  const trimmed = ad.trim();
  if (!trimmed) throw new Error('Kat adı boş olamaz');
  const item: KampKat = {
    id: `kk_${Date.now()}`,
    yerleskeId: yerleske.id,
    yerleskeAdi: yerleske.ad,
    ad: trimmed,
    sira,
    olusturmaTarihi: new Date().toISOString(),
  };
  await saveDocument('kampKatlari', item);
  return item;
}

export function katsForYerleske(katlar: KampKat[], yerleskeId: string): KampKat[] {
  return katlar
    .filter((k) => k.yerleskeId === yerleskeId)
    .sort((a, b) => a.sira - b.sira || a.ad.localeCompare(b.ad, 'tr'));
}

export async function findYerleskeByAd(ad: string): Promise<KampYerleske | null> {
  const list = await fetchCollection<KampYerleske>('kampYerleskeleri');
  return list.find((y) => y.ad === ad.trim()) ?? null;
}

export async function findOrCreateYerleske(ad: string, olusturan?: string): Promise<KampYerleske> {
  const existing = await findYerleskeByAd(ad);
  if (existing) return existing;
  return createKampYerleske(ad, olusturan);
}

export async function findKatByYerleskeAndAd(
  yerleskeId: string,
  ad: string
): Promise<KampKat | null> {
  const list = await fetchCollection<KampKat>('kampKatlari');
  return list.find((k) => k.yerleskeId === yerleskeId && k.ad === ad.trim()) ?? null;
}

export async function findOrCreateKat(
  yerleske: KampYerleske,
  ad: string,
  sira?: number
): Promise<KampKat> {
  const existing = await findKatByYerleskeAndAd(yerleske.id, ad);
  if (existing) return existing;
  const katlar = await fetchCollection<KampKat>('kampKatlari');
  const count = katlar.filter((k) => k.yerleskeId === yerleske.id).length;
  return createKampKat(yerleske, ad, sira ?? count + 1);
}

export interface CreateKampOdasiInput {
  yerleskeAdi: string;
  kogusNo: string;
  odaNo: string;
  kapasite: number;
  firmaTipi: 'ANA_FIRMA' | 'TASERON';
  yerleskeId?: string;
  katId?: string;
  olusturan?: string;
}

/** Yerleşke + kat yapısını garanti ederek oda oluşturur (Kamp Yönetimi ↔ Kampçı Mobil ortak) */
export async function createKampOdasi(input: CreateKampOdasiInput): Promise<KampOdasi> {
  const yerleske = input.yerleskeId
    ? (await fetchCollection<KampYerleske>('kampYerleskeleri')).find((y) => y.id === input.yerleskeId)
        ?? (await findOrCreateYerleske(input.yerleskeAdi, input.olusturan))
    : await findOrCreateYerleske(input.yerleskeAdi, input.olusturan);

  const kat = input.katId
    ? (await fetchCollection<KampKat>('kampKatlari')).find((k) => k.id === input.katId)
        ?? (await findOrCreateKat(yerleske, input.kogusNo))
    : await findOrCreateKat(yerleske, input.kogusNo);

  const room: KampOdasi = {
    id: `room_${Date.now()}`,
    yerleskeAdi: yerleske.ad,
    kogusNo: kat.ad,
    yerleskeId: yerleske.id,
    katId: kat.id,
    odaNo: input.odaNo.trim(),
    kapasite: Number(input.kapasite),
    firmaTipi: input.firmaTipi,
    durum: 'BOŞ',
  };

  await saveDocument('kampOdalari', room);
  return room;
}

export async function deleteKampOdasi(roomId: string): Promise<void> {
  await removeDocument('kampOdalari', roomId);
}

export async function deleteKampKat(katId: string): Promise<void> {
  await removeDocument('kampKatlari', katId);
}

export async function deleteKampYerleske(yerleskeId: string): Promise<void> {
  await removeDocument('kampYerleskeleri', yerleskeId);
}

/** Mevcut odalardan eksik yerleşke/kat kayıtlarını Firestore'a yazar */
export async function ensureYapıFromOdalari(
  kampOdalari: KampOdasi[],
  olusturan?: string
): Promise<void> {
  const pairs = new Set<string>();
  for (const room of kampOdalari) {
    if (!room.yerleskeAdi?.trim() || !room.kogusNo?.trim()) continue;
    pairs.add(`${room.yerleskeAdi.trim()}::${room.kogusNo.trim()}`);
  }
  for (const key of pairs) {
    const [yerleskeAdi, kogusNo] = key.split('::');
    const y = await findOrCreateYerleske(yerleskeAdi, olusturan);
    await findOrCreateKat(y, kogusNo);
  }
}

export function deriveCampusNames(yerleskeler: KampYerleske[]): string[] {
  return yerleskeler.map((y) => y.ad).sort((a, b) => a.localeCompare(b, 'tr'));
}

export function deriveCampusFloors(
  campusNames: string[],
  katlar: KampKat[]
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  campusNames.forEach((camp) => {
    result[camp] = katlar
      .filter((k) => k.yerleskeAdi === camp)
      .sort((a, b) => a.sira - b.sira || a.ad.localeCompare(b.ad, 'tr'))
      .map((k) => k.ad);
  });
  return result;
}

export async function deleteYerleskeCascade(
  campName: string,
  yerleskeler: KampYerleske[],
  katlar: KampKat[],
  kampOdalari: KampOdasi[]
): Promise<string[]> {
  let yerleske = yerleskeler.find((y) => y.ad === campName) ?? (await findYerleskeByAd(campName));
  const roomIds = kampOdalari.filter((r) => r.yerleskeAdi === campName).map((r) => r.id);
  await Promise.all(roomIds.map((id) => deleteKampOdasi(id)));

  const katIds = katlar.filter((k) => k.yerleskeAdi === campName).map((k) => k.id);
  await Promise.all(katIds.map((id) => deleteKampKat(id)));

  if (yerleske) await deleteKampYerleske(yerleske.id);
  return roomIds;
}

export async function deleteKatCascade(
  campName: string,
  floorName: string,
  katlar: KampKat[],
  kampOdalari: KampOdasi[]
): Promise<string[]> {
  const kat = katlar.find((k) => k.yerleskeAdi === campName && k.ad === floorName);
  const roomIds = kampOdalari
    .filter((r) => r.yerleskeAdi === campName && r.kogusNo === floorName)
    .map((r) => r.id);
  await Promise.all(roomIds.map((id) => deleteKampOdasi(id)));
  if (kat) await deleteKampKat(kat.id);
  return roomIds;
}

const LEGACY_SEED_YERLESKELER = new Set([
  'A Yerleşkesi', 'B Yerleşkesi', 'C Yerleşkesi', 'D Yerleşkesi',
  'A BLOK', 'B BLOK', 'C BLOK', 'D BLOK',
]);

export function isLegacyKampRoom(room: KampOdasi): boolean {
  return LEGACY_SEED_YERLESKELER.has(room.yerleskeAdi) || room.id.startsWith('ko_room_');
}

export function isLegacyKampYerleske(ad: string): boolean {
  return LEGACY_SEED_YERLESKELER.has(ad);
}

/** Demo/seed ile gelen örnek odalar */
export function hasLegacySeedRooms(rooms: KampOdasi[]): boolean {
  return rooms.some(isLegacyKampRoom);
}

export async function clearLegacySeedRooms(rooms: KampOdasi[]): Promise<string[]> {
  const toDelete = rooms.filter(isLegacyKampRoom);
  await Promise.all(toDelete.map((r) => deleteKampOdasi(r.id)));
  return toDelete.map((r) => r.id);
}

/** Eski demo yerleşke, kat ve odalarını Firestore'dan temizler */
export async function purgeLegacyKampData(): Promise<{ roomIds: string[]; yerleskeIds: string[]; katIds: string[] }> {
  const rooms = await fetchCollection<KampOdasi & { id: string }>('kampOdalari');
  const legacyRooms = rooms.filter((r) => isLegacyKampRoom(r));
  await Promise.all(legacyRooms.map((r) => deleteKampOdasi(r.id)));

  const yerleskeler = await fetchCollection<KampYerleske & { id: string }>('kampYerleskeleri');
  const legacyYerleskeler = yerleskeler.filter((y) => isLegacyKampYerleske(y.ad));
  await Promise.all(legacyYerleskeler.map((y) => deleteKampYerleske(y.id)));

  const katlar = await fetchCollection<KampKat & { id: string }>('kampKatlari');
  const legacyKatlar = katlar.filter((k) => isLegacyKampYerleske(k.yerleskeAdi));
  await Promise.all(legacyKatlar.map((k) => deleteKampKat(k.id)));

  return {
    roomIds: legacyRooms.map((r) => r.id),
    yerleskeIds: legacyYerleskeler.map((y) => y.id),
    katIds: legacyKatlar.map((k) => k.id),
  };
}

/** Realtime dinleyiciler için yardımcı */
export { collection, onSnapshot } from 'firebase/firestore';
export { db };

/** Tüm kamp verisini kalıcı olarak siler (boş başlangıç) */
export async function purgeAllKampData(): Promise<{
  odalar: number;
  kayitlar: number;
  yerleskeler: number;
  katlar: number;
}> {
  const counts = { odalar: 0, kayitlar: 0, yerleskeler: 0, katlar: 0 };
  const specs: Array<[string, keyof typeof counts]> = [
    ['kampOdalari', 'odalar'],
    ['kampKayitlari', 'kayitlar'],
    ['kampYerleskeleri', 'yerleskeler'],
    ['kampKatlari', 'katlar'],
  ];
  for (const [col, key] of specs) {
    const items = await fetchCollection<{ id: string }>(col);
    counts[key] = items.length;
    await Promise.all(items.map((i) => removeDocument(col, i.id)));
  }
  return counts;
}

export async function updateKampYerleskeAdi(yerleske: KampYerleske, yeniAd: string): Promise<void> {
  const trimmed = yeniAd.trim();
  if (!trimmed) throw new Error('Yerleşke adı boş olamaz');
  await saveDocument('kampYerleskeleri', { ...yerleske, ad: trimmed });
  const eskiAd = yerleske.ad;
  const [rooms, kats] = await Promise.all([
    fetchCollection<KampOdasi & { id: string }>('kampOdalari'),
    fetchCollection<KampKat & { id: string }>('kampKatlari'),
  ]);
  await Promise.all([
    ...rooms
      .filter((r) => r.yerleskeId === yerleske.id || r.yerleskeAdi === eskiAd)
      .map((r) => saveDocument('kampOdalari', { ...r, yerleskeAdi: trimmed, yerleskeId: yerleske.id })),
    ...kats
      .filter((k) => k.yerleskeId === yerleske.id)
      .map((k) => saveDocument('kampKatlari', { ...k, yerleskeAdi: trimmed })),
  ]);
}

export async function updateKampKatAdi(kat: KampKat, yeniAd: string, yeniSira?: number): Promise<void> {
  const trimmed = yeniAd.trim();
  if (!trimmed) throw new Error('Kat adı boş olamaz');
  await saveDocument('kampKatlari', {
    ...kat,
    ad: trimmed,
    sira: yeniSira ?? kat.sira,
  });
  const eskiAd = kat.ad;
  const rooms = await fetchCollection<KampOdasi & { id: string }>('kampOdalari');
  await Promise.all(
    rooms
      .filter((r) => r.katId === kat.id || (r.yerleskeAdi === kat.yerleskeAdi && r.kogusNo === eskiAd))
      .map((r) => saveDocument('kampOdalari', { ...r, kogusNo: trimmed, katId: kat.id }))
  );
}
