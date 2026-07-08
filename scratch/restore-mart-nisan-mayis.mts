import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, fetchCollection, parseYoklamaSnapshotData } from '../src/lib/firebase';
import { LEGACY_EXCEL_MONTHS } from '../src/data/legacyExcelYoklama';
import { importAllLegacyExcelMonths } from '../src/lib/legacyYoklamaImport';
import type { AylikYoklamaMap, Personel } from '../src/types/erp';

async function main() {
  const dryRun = !process.argv.includes('--apply');
  const personeller = await fetchCollection<Personel>('personeller');
  const yoklamaDoc = await getDoc(doc(db, 'yoklamalar', 'global_yoklama_map'));
  const current = yoklamaDoc.exists()
    ? (parseYoklamaSnapshotData(yoklamaDoc.data() as Record<string, unknown>) as AylikYoklamaMap)
    : ({} as AylikYoklamaMap);

  const restoreMonths = LEGACY_EXCEL_MONTHS.filter((m) => m.year === 2026 && [3, 4, 5].includes(m.month));
  const result = importAllLegacyExcelMonths(restoreMonths, personeller, current, {
    allowCreatePersonel: false,
    replaceMonthData: true,
  });

  const summary = {
    dryRun,
    personelCount: personeller.length,
    importedDays: result.importedDays,
    matchedPersonel: result.matchedPersonel.length,
    createdPersonel: result.createdPersonel.length,
    skippedDuplicates: result.skippedDuplicates,
    warnings: result.warnings.slice(0, 25),
  };

  console.log('RESTORE SUMMARY =>', JSON.stringify(summary, null, 2));

  if (dryRun) {
    console.log('Dry-run tamamlandı. Uygulamak için: npx vite-node scratch/restore-mart-nisan-mayis.mts --apply');
    return;
  }

  await setDoc(doc(db, 'yoklamalar', 'global_yoklama_map'), {
    dataJson: JSON.stringify(result.yoklamalar),
  });
  console.log('Mart-Nisan-Mayıs yoklamaları uygulandı. Haziran verisi korunmuştur.');
}

main().catch((err) => {
  console.error('Restore başarısız:', err);
  process.exit(1);
});

