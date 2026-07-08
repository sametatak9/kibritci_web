/** Görev adlarını rapor/yoklama için standartlaştırır */
export function normalizeGorev(gorev?: string): string {
  if (!gorev?.trim()) return 'DÜZ İŞÇİ';
  const g = gorev.trim().toUpperCase();
  if (g === 'D.İŞÇİ' || g === 'D.IŞÇI' || g === 'DÜZİŞÇİ' || g === 'İŞÇİ' || g === 'ISCI') return 'DÜZ İŞÇİ';
  return gorev.trim();
}
