import { AylikYoklamaMap, Personel, SahaFaaliyeti, YoklamaDurum } from '../types/erp';
import { normalizeDateKey } from './dateKeyUtils';
import { findPersonelByName, getYoklamaDay, normalizeTurkishName } from './yoklamaUtils';

export function personMatchesFaaliyet(p: Personel, f: SahaFaaliyeti): boolean {
  const list = f.aktifPersonelListesi || [];
  if (list.some((entry) => String(entry).trim() === p.id)) return true;
  const fullName = normalizeTurkishName(`${p.ad} ${p.soyad}`);
  if (list.some((entry) => normalizeTurkishName(String(entry).trim()) === fullName)) return true;
  return f.personelId === p.id;
}

export function isFaaliyetInPeriod(f: SahaFaaliyeti, year: number, month: number): boolean {
  const dk = normalizeDateKey(f.tarih);
  if (!dk) return false;
  const [y, m] = dk.split('-').map(Number);
  return y === year && m === month;
}

export function filterFaaliyetlerByPeriod(
  faaliyetler: SahaFaaliyeti[],
  year: number,
  month: number
): SahaFaaliyeti[] {
  return (faaliyetler || []).filter((f) => isFaaliyetInPeriod(f, year, month));
}

function personScore(p: Personel): number {
  let s = 0;
  if ((p.tcNo || '').trim()) s += 100;
  if (!p.id.startsWith('PRS-LEGACY')) s += 50;
  if (p.durum === true || String(p.durum).toLowerCase() === 'true') s += 10;
  return s;
}

/** Seçili ayda en az bir saha faaliyetine bağlı personeller (Yoklama ile aynı mantık) */
export function buildFaaliyetPersoneller(
  sahaFaaliyetleri: SahaFaaliyeti[],
  personeller: Personel[],
  year: number,
  month: number
): Personel[] {
  const period = filterFaaliyetlerByPeriod(sahaFaaliyetleri, year, month);
  const matched = new Map<string, Personel>();
  const addPerson = (p: Personel | undefined | null) => {
    if (p?.id) matched.set(p.id, p);
  };

  for (const f of period) {
    for (const entry of f.aktifPersonelListesi || []) {
      const raw = String(entry).trim();
      if (!raw) continue;
      const byId = personeller.find((p) => p.id === raw);
      if (byId) {
        addPerson(byId);
        continue;
      }
      addPerson(findPersonelByName(personeller, raw));
    }
    addPerson(personeller.find((p) => p.id === f.personelId));
  }

  const byName = new Map<string, Personel>();
  for (const p of matched.values()) {
    const key = normalizeTurkishName(`${p.ad} ${p.soyad}`);
    const prev = byName.get(key);
    if (!prev || personScore(p) > personScore(prev)) byName.set(key, p);
  }
  return Array.from(byName.values()).sort((a, b) =>
    `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, 'tr')
  );
}

export function getPersonFaaliyetleriInPeriod(
  person: Personel,
  sahaFaaliyetleri: SahaFaaliyeti[],
  year: number,
  month: number
): SahaFaaliyeti[] {
  return filterFaaliyetlerByPeriod(sahaFaaliyetleri, year, month)
    .filter((f) => personMatchesFaaliyet(person, f))
    .sort((a, b) => String(b.tarih || '').localeCompare(String(a.tarih || ''), 'tr'));
}

export interface PersonelAyOzeti {
  geldiGun: number;
  yokGun: number;
  izinliGun: number;
  raporluGun: number;
  pazarGun: number;
  toplamMesai: number;
  gunDetay: Array<{
    day: number;
    durum: YoklamaDurum | 'Girilmedi';
    mesaiSaati: number;
  }>;
}

/** Salt okunur yoklama / mesai özeti (düzenlenemez) */
export function buildPersonelAyOzeti(
  person: Personel,
  yoklamalar: AylikYoklamaMap,
  year: number,
  month: number
): PersonelAyOzeti {
  const daysInMonth = new Date(year, month, 0).getDate();
  let geldiGun = 0;
  let yokGun = 0;
  let izinliGun = 0;
  let raporluGun = 0;
  let pazarGun = 0;
  let toplamMesai = 0;
  const gunDetay: PersonelAyOzeti['gunDetay'] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = getYoklamaDay(yoklamalar[person.id], year, month, day);
    const durum = (cell?.durum || 'Girilmedi') as YoklamaDurum | 'Girilmedi';
    const mesaiSaati = Number(cell?.mesaiSaati || 0);
    if (durum === 'Geldi') geldiGun += 1;
    else if (durum === 'Yok') yokGun += 1;
    else if (durum === 'İzinli') izinliGun += 1;
    else if (durum === 'Raporlu') raporluGun += 1;
    else if (durum === 'Pazar') pazarGun += 1;
    toplamMesai += mesaiSaati;
    gunDetay.push({ day, durum, mesaiSaati });
  }

  return {
    geldiGun,
    yokGun,
    izinliGun,
    raporluGun,
    pazarGun,
    toplamMesai: Math.round(toplamMesai * 2) / 2,
    gunDetay,
  };
}

export function formatFaaliyetTarihLabel(tarih?: string): string {
  const dk = normalizeDateKey(tarih || '');
  if (!dk) return tarih || '—';
  const [y, m, d] = dk.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'short',
  });
}
