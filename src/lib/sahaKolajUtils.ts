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
    const p = f.parsel || 'Genel Saha';
    const b = f.blok || 'Belirtilmedi';
    const key = `${p} / ${b}`;
    
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }

  const groups: KolajGrup[] = [];
  for (const [key, fotos] of map) {
    groups.push({ ad: key, fotolar: fotos });
  }
  
  return groups.sort((a, b) => a.ad.localeCompare(b.ad));
}

type SahaFaaliyetFotoKaynak = {
  id?: string;
  tarih?: string;
  fotoUrl?: string;
  fotoUrls?: string[];
  isinAdi?: string;
  isNiteligi?: string;
  aciklama?: string;
  parsel?: string;
  blok?: string;
  kaydeden?: string;
};

type ProgramliFaaliyetFotoKaynak = {
  id?: string;
  tarih?: string;
  isinAdi?: string;
  parsel?: string;
  bloklar?: string;
  olusturan?: string;
  asamalar?: Array<{
    adim?: string;
    tamamlandi?: boolean;
    fotoUrl?: string;
    aciklama?: string;
    tamamlanmaTarihi?: string;
  }>;
};

/**
 * Kolaj ekranı ile aynı birleşik liste:
 * sahaKolajFotolari + dönemdeki saha faaliyet fotoğrafları + programlı faaliyet aşama fotoğrafları.
 */
export function mergeAlbumFotolari(input: {
  albumKey: string;
  yil: number;
  ay: number;
  kolajFotolari: SahaKolajFoto[];
  sahaFaaliyetleri?: SahaFaaliyetFotoKaynak[];
  programliFaaliyetler?: ProgramliFaaliyetFotoKaynak[];
}): SahaKolajFoto[] {
  const { albumKey, yil, ay } = input;
  const list: SahaKolajFoto[] = [...(input.kolajFotolari || [])];
  let siraOffset = list.length > 0 ? Math.max(...list.map((f) => f.sira || 0)) + 1 : 1;

  (input.sahaFaaliyetleri || []).forEach((sf) => {
    if (!sf.tarih || !String(sf.tarih).startsWith(albumKey)) return;
    const urls = sf.fotoUrls || (sf.fotoUrl ? [sf.fotoUrl] : []);
    urls.forEach((url, i) => {
      if (!url) return;
      const id = `sf_${sf.id}_${i}`;
      if (list.some((x) => x.id === id)) return;
      list.push({
        id,
        albumKey,
        yil,
        ay,
        imageUrl: url,
        baslik: sf.isinAdi || sf.isNiteligi || 'Günlük Faaliyet',
        aciklama: sf.aciklama,
        grupAdi: `Parsel: ${sf.parsel || '—'} - Blok: ${sf.blok || '—'}`,
        sira: siraOffset++,
        yuklemeTarihi: sf.tarih,
        yukleyen: sf.kaydeden || 'Formen',
        parsel: sf.parsel,
        blok: sf.blok,
      });
    });
  });

  (input.programliFaaliyetler || []).forEach((pf) => {
    if (!pf.tarih || !String(pf.tarih).startsWith(albumKey)) return;
    (pf.asamalar || []).forEach((asama) => {
      if (!asama.tamamlandi || !asama.fotoUrl) return;
      const id = `pf_${pf.id}_${asama.adim}`;
      if (list.some((x) => x.id === id)) return;
      list.push({
        id,
        albumKey,
        yil,
        ay,
        imageUrl: asama.fotoUrl,
        baslik: `${pf.isinAdi || 'Programlı'} (${asama.adim || ''})`,
        aciklama: asama.aciklama,
        grupAdi: `Parsel: ${pf.parsel || '—'} - Blok: ${pf.bloklar || '—'}`,
        sira: siraOffset++,
        yuklemeTarihi: asama.tamamlanmaTarihi || pf.tarih,
        yukleyen: pf.olusturan || 'Formen',
        parsel: pf.parsel,
        blok: pf.bloklar,
      });
    });
  });

  return list.sort((a, b) => a.sira - b.sira || a.yuklemeTarihi.localeCompare(b.yuklemeTarihi));
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
