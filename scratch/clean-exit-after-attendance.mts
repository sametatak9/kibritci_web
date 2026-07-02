import { fetchCollection, fetchYoklamaDocument, saveYoklamaDocument } from '../src/lib/firebase';
import { isDayActiveForPersonel } from '../src/lib/yoklamaUtils';

type Personel = {
  id: string;
  ad?: string;
  soyad?: string;
};

type DayData = {
  durum?: string;
  mesaiSaati?: number;
  gonderen?: string;
};

function isDateKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const personeller = await fetchCollection<Personel>('personeller');
  const personelById = new Map(personeller.map((p) => [p.id, p]));
  const raw = await fetchYoklamaDocument() as Record<string, Record<string, DayData>>;
  const next: Record<string, Record<string, DayData>> = JSON.parse(JSON.stringify(raw || {}));

  let changeCount = 0;
  const touchedPeople = new Set<string>();
  const samples: Array<{ id: string; adSoyad: string; date: string; oldDurum?: string; oldMesai?: number }> = [];

  for (const [personelId, dayMap] of Object.entries(next)) {
    const p = personelById.get(personelId);
    if (!p || !dayMap || typeof dayMap !== 'object') continue;
    for (const [date, d] of Object.entries(dayMap)) {
      if (!isDateKey(date)) continue;
      const year = Number(date.slice(0, 4));
      const month = Number(date.slice(5, 7));
      const day = Number(date.slice(8, 10));
      const active = isDayActiveForPersonel(p as any, year, month, day, dayMap as any);
      if (active) continue;
      const oldDurum = d?.durum;
      const oldMesai = Number(d?.mesaiSaati || 0);
      if (oldDurum === 'Geldi' || oldMesai > 0) {
        changeCount++;
        touchedPeople.add(personelId);
        if (samples.length < 80) {
          samples.push({
            id: personelId,
            adSoyad: `${p.ad || ''} ${p.soyad || ''}`.trim(),
            date,
            oldDurum,
            oldMesai,
          });
        }
        dayMap[date] = {
          ...d,
          durum: 'Girilmedi',
          mesaiSaati: 0,
        };
      }
    }
  }

  console.log('mode:', apply ? 'APPLY' : 'DRY_RUN');
  console.log('records_to_fix:', changeCount);
  console.log('person_count_touched:', touchedPeople.size);
  console.log('sample:', samples);

  if (apply && changeCount > 0) {
    await saveYoklamaDocument(next);
    console.log('apply_result: saved');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

