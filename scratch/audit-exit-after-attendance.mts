import { fetchCollection, fetchYoklamaDocument } from '../src/lib/firebase';
import { isDayActiveForPersonel } from '../src/lib/yoklamaUtils';

type Personel = {
  id: string;
  ad?: string;
  soyad?: string;
  tcNo?: string;
  iseGirisTarihi?: string;
  istenCikisTarihi?: string;
  durum?: unknown;
};

function isDateKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key);
}

async function main() {
  const personeller = await fetchCollection<Personel>('personeller');
  const yoklama = await fetchYoklamaDocument() as Record<string, Record<string, { durum?: string; mesaiSaati?: number }>>;

  const anomalies: Array<{
    personelId: string;
    adSoyad: string;
    cikis?: string;
    date: string;
    durum?: string;
    mesai?: number;
  }> = [];

  for (const p of personeller) {
    const map = yoklama[p.id];
    if (!map) continue;
    for (const [date, d] of Object.entries(map)) {
      if (!isDateKey(date)) continue;
      const year = Number(date.slice(0, 4));
      const month = Number(date.slice(5, 7));
      const day = Number(date.slice(8, 10));
      const active = isDayActiveForPersonel(p as any, year, month, day, map as any);
      if (active) continue;
      const hasValue = d?.durum === 'Geldi' || Number(d?.mesaiSaati || 0) > 0;
      if (!hasValue) continue;
      anomalies.push({
        personelId: p.id,
        adSoyad: `${p.ad || ''} ${p.soyad || ''}`.trim(),
        cikis: p.istenCikisTarihi,
        date,
        durum: d?.durum,
        mesai: Number(d?.mesaiSaati || 0),
      });
    }
  }

  anomalies.sort((a, b) => a.date.localeCompare(b.date));
  console.log('exit-after-attendance anomalies:', anomalies.length);
  console.log('sample:', anomalies.slice(0, 60));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

