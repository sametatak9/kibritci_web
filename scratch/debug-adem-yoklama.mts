import { fetchCollection, fetchYoklamaDocument } from '../src/lib/firebase';
import { isDayActiveForPersonel, normalizeTurkishName } from '../src/lib/yoklamaUtils';

type AnyPersonel = {
  id: string;
  ad?: string;
  soyad?: string;
  tcNo?: string;
  iseGirisTarihi?: string;
  istenCikisTarihi?: string;
  durum?: unknown;
};

async function main() {
  const personeller = await fetchCollection<AnyPersonel>('personeller');
  const yoklama = await fetchYoklamaDocument();

  const matches = personeller.filter((p) => normalizeTurkishName(`${p.ad || ''} ${p.soyad || ''}`) === 'ADEMCAGLAR');
  console.log('ADEM personel matches:', matches.length);
  matches.forEach((p, i) => {
    console.log(`\n[${i + 1}] id=${p.id} tc=${p.tcNo || ''} durum=${String(p.durum)} giris=${p.iseGirisTarihi || ''} cikis=${p.istenCikisTarihi || ''}`);
    const map = (yoklama[p.id] || {}) as Record<string, { durum?: string; mesaiSaati?: number }>;
    const keys = Object.keys(map).sort();
    const haziranKeys = keys.filter((k) => /^2026-06-\d{2}$/.test(k));
    const haziranGeldi = haziranKeys.filter((k) => map[k]?.durum === 'Geldi').length;
    const haziranMesai = haziranKeys.reduce((s, k) => s + Number(map[k]?.mesaiSaati || 0), 0);
    const haziranGeldiDates = haziranKeys.filter((k) => map[k]?.durum === 'Geldi');
    const haziranMesaiDates = haziranKeys.filter((k) => Number(map[k]?.mesaiSaati || 0) > 0);
    const nonDateKeys = keys.filter((k) => !/^\d{4}-\d{2}-\d{2}$/.test(k));
    console.log(`keys=${keys.length} haziranKeys=${haziranKeys.length} haziranGeldi=${haziranGeldi} haziranMesai=${haziranMesai} nonDateKeys=${nonDateKeys.length}`);
    console.log('haziran geldi dates:', haziranGeldiDates);
    console.log('haziran mesai dates:', haziranMesaiDates);
    const activeHaziran = haziranKeys.filter((k) => {
      const d = Number(k.slice(-2));
      return isDayActiveForPersonel(p as any, 2026, 6, d, map as any);
    });
    const activeHaziranGeldi = activeHaziran.filter((k) => map[k]?.durum === 'Geldi').length;
    const activeHaziranMesai = activeHaziran.reduce((s, k) => s + Number(map[k]?.mesaiSaati || 0), 0);
    console.log(`activeHaziranDays=${activeHaziran.length} activeHaziranGeldi=${activeHaziranGeldi} activeHaziranMesai=${activeHaziranMesai}`);
    if (haziranKeys.length > 0) {
      console.log('haziran sample keys:', haziranKeys.slice(0, 31));
    }
    if (nonDateKeys.length > 0) {
      console.log('non-date keys sample:', nonDateKeys.slice(0, 20));
    }
  });

  const groupedByName = new Map<string, AnyPersonel[]>();
  personeller.forEach((p) => {
    const n = normalizeTurkishName(`${p.ad || ''} ${p.soyad || ''}`);
    if (!n) return;
    if (!groupedByName.has(n)) groupedByName.set(n, []);
    groupedByName.get(n)!.push(p);
  });
  const dupNames = Array.from(groupedByName.entries()).filter(([, arr]) => arr.length > 1);
  console.log('\nDuplicate name groups count:', dupNames.length);
  const ademGroup = dupNames.find(([name]) => name === 'ADEMCAGLAR');
  if (ademGroup) {
    console.log('ADEM duplicate ids:', ademGroup[1].map((p) => p.id));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

