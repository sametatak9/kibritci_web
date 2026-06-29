import { KampYerleske, KampKat } from '../types/erp';
import { saveDocument } from './firebase';

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
    .filter(k => k.yerleskeId === yerleskeId)
    .sort((a, b) => a.sira - b.sira || a.ad.localeCompare(b.ad, 'tr'));
}
