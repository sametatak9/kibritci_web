import { SahaKolajFoto } from '../types/erp';

export const AY_ADLARI = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export function albumKeyFrom(yil: number, ay: number): string {
  return `${yil}-${String(ay).padStart(2, '0')}`;
}

export function parseAlbumKey(key: string): { yil: number; ay: number } {
  const [y, m] = key.split('-');
  return { yil: Number(y), ay: Number(m) };
}

export function albumBaslik(yil: number, ay: number): string {
  return `${AY_ADLARI[ay - 1] ?? ay}. Ay ${yil}`;
}

export interface KolajGrup {
  ad: string;
  fotolar: SahaKolajFoto[];
}

export function groupKolajFotolari(fotolar: SahaKolajFoto[]): KolajGrup[] {
  const map = new Map<string, SahaKolajFoto[]>();
  const sorted = [...fotolar].sort((a, b) => a.sira - b.sira || a.yuklemeTarihi.localeCompare(b.yuklemeTarihi));

  for (const f of sorted) {
    const key = (f.grupAdi || '').trim() || '__genel__';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }

  const groups: KolajGrup[] = [];
  const genel = map.get('__genel__');
  if (genel?.length) groups.push({ ad: 'Genel Saha Faaliyetleri', fotolar: genel });

  for (const [key, fotos] of map) {
    if (key === '__genel__') continue;
    groups.push({ ad: key, fotolar: fotos });
  }
  return groups;
}

export type MagazinePageType = 'cover' | 'toc' | 'section' | 'spread' | 'collage' | 'summary';

export interface MagazinePage {
  type: MagazinePageType;
  title?: string;
  subtitle?: string;
  photos?: SahaKolajFoto[];
  groups?: { ad: string; count: number }[];
  summaryData?: { parsel: string; count: number; bloks: string[] }[];
}

const SPREAD_SIZE = 4;

export function buildMagazinePages(fotolar: SahaKolajFoto[], yil: number, ay: number): MagazinePage[] {
  if (fotolar.length === 0) return [];

  const pages: MagazinePage[] = [];
  const groups = groupKolajFotolari(fotolar);

  pages.push({
    type: 'cover',
    title: albumBaslik(yil, ay),
    subtitle: 'Şantiye Saha Faaliyetleri Foto Dergisi',
  });

  pages.push({
    type: 'toc',
    title: 'İçindekiler',
    groups: groups.map((g) => ({ ad: g.ad, count: g.fotolar.length })),
  });

  for (const group of groups) {
    pages.push({ type: 'section', title: group.ad, subtitle: `${group.fotolar.length} fotoğraf` });
    for (let i = 0; i < group.fotolar.length; i += SPREAD_SIZE) {
      pages.push({
        type: 'spread',
        title: group.ad,
        photos: group.fotolar.slice(i, i + SPREAD_SIZE),
      });
    }
  }

  pages.push({ type: 'collage', title: 'Ay Özeti Kolaj', photos: fotolar });

  // Summary Page
  const parselMap = new Map<string, Set<string>>();
  for (const f of fotolar) {
    const p = f.parsel || 'Genel Saha';
    const b = f.blok || 'Belirtilmedi';
    if (!parselMap.has(p)) parselMap.set(p, new Set());
    parselMap.get(p)!.add(b);
  }

  const summaryData = Array.from(parselMap.entries()).map(([parsel, blocks]) => {
    const count = fotolar.filter((f) => (f.parsel || 'Genel Saha') === parsel).length;
    return {
      parsel,
      count,
      bloks: Array.from(blocks).sort(),
    };
  }).sort((a, b) => b.count - a.count);

  pages.push({
    type: 'summary',
    title: 'Parsel Bazlı Faaliyet Özeti',
    summaryData,
  });

  return pages;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
