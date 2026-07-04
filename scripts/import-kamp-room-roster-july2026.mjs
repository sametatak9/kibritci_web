#!/usr/bin/env node
/**
 * Kamp oda dağılımını tek seferde Firestore'a uygular.
 * Kural:
 * - İsim DB'de varsa mevcut personel kullanılır (ANA_FIRMA).
 * - İsim DB'de yoksa taşeron personel açılır (TASERON) ve firmaya bağlanır.
 * - Taşeron firma adları cari kartlarda TASERON olarak açılır.
 * - Konaklama kayıtları aktif olarak kampKayitlari'na yazılır.
 *
 * Çalıştırma:
 *   node scripts/import-kamp-room-roster-july2026.mjs --dry-run
 *   node scripts/import-kamp-room-roster-july2026.mjs --execute
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, setDoc, writeBatch } from 'firebase/firestore';

const args = new Set(process.argv.slice(2));
const EXECUTE = args.has('--execute');
const DRY_RUN = !EXECUTE || args.has('--dry-run');

const configPath = resolve('firebase-target.config.json');
if (!existsSync(configPath)) {
  console.error(`firebase-target.config.json bulunamadı: ${configPath}`);
  process.exit(1);
}

const ROSTER_TEXT = `
A blok oda 1 Murat "Soyisim Belli Değil" Firma : (PTM YEMEK)
A blok oda.2 faruk çoban kantin
A blok oda 3 Yusuf Orhan Firma :(Kibritçi İnşaat) Eren Yılmaz Firma :(Yurt Mekanik)
A blok oda 4 Tahsin Orhan Firma :(Kibritçi)
A blok oda 5 Nuri Leylek Firma :(Yurt mekanik
A blok oda 6 boş
A blok oda 7 Yusuf "Soyisim Belli Değil"  Firma :(Yurt mekanik
A blok oda 8 Ayhan Kaya Firma : (Yurt Mekanik)
A blok kat 2 oda 1(izgi karot)
A blok kat 2 oda 2 Ali "Soyadı Belli Değil"  Firma : ( Yurt Mekanik)
A blok kat 2 oda 3 Sezai Orhan Firma :(PTM YEMEK)
A blok kat 2 oda 4 Şahin Şahinoğlu Firma : (Kibritçi İnşaat) , Enes Bulut  Firma : (Kibritçi İnşaat)
A blok kat 2 oda 5 İbrahim amir  Firma :(AAkvizyon)
A blok kat 2 oda 6 boş
A blok kat 2 oda 7 boş
A blok kat 2 oda 8 boş
B blok kat 1 oda 1 Ahmet Yıldırım Firma : (Kibritçi İnşaat)
B blok kat 1 oda 2 Onur Tomur Firma :(Ünsallar Parke) Recai Süslü Firma :(Ünsallar Parke) Ali "Soyadı Belli Değil" Firma :(Ünsallar Parke)
B blok kat 1 oda 3 boş
B blok kat 1 oda 4.Azad Kapıcı - Fatih Kapıcı -Berat Kapıcı - Kerem Kapıcı - Diyar Kapıcı Firma : (AD Yapı) (Hepsi)
B blok kat 1 oda 5 boş
B blok kat 1 oda 6 boş
B blok kat 1 oda 7 boş
B blok kat 1 oda 8 Tuncay Akerik - İlhan Yakul - Recep Yakup Firma : (Yeditepe) ;(HEPSİ)
B blok kat 1 oda 9 Ahmet Duman - Abdulkadir Kaya Firma : (Kibritçi İnşaat)
B blok kat 1 oda 10 Hamdullah Yiğit - Olcay Yiğit Firma : (Yeditepe)
B blok kat 1 oda 11 boş
B blok kat 1 oda 12 boş
B blok kat 1 oda 13 boş
B blok kat 1 oda 14 boş
B blok kat 2 oda 1 Azmi Vural - Hasan Vural - Şükrü Yedikılıç Firma :(Ünsallar Parke) (HEPSİ)
B blok kat 2 oda 2 İsmail Yıldız - Hikmet Birinci Firma :(AD Yapı)
B blok kat 2 oda 3 boş
B blok kat 2 oda 4 boş
B blok kat 2 oda 5 boş
B blok kat 2 oda 6 boş
B blok kat 2 oda 7 boş
B blok kat 2 oda 8 boş
B blok kat 2 oda 8 boş
B blok kat 2 oda 9 boş
B blok kat 2 oda 10 boş
`.trim();

const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
const app = initializeApp(
  {
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId,
  },
  `KAMP_ROSTER_IMPORT_${Date.now()}`
);
const db = getFirestore(app);

const today = new Date().toISOString().slice(0, 10);

const normalize = (raw) =>
  String(raw || '')
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/["']/g, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isKibritci = (firma) => normalize(firma).includes('KIBRITCI');

const sanitizeName = (raw) =>
  String(raw || '')
    .replace(/"[^"]*"/g, ' ')
    .replace(/\bsoyadı?\s+belli\s+değil\b/gi, ' ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const splitNames = (raw) =>
  String(raw || '')
    .replace(/\(hepsi\)/gi, ' ')
    .replace(/\s+ve\s+/gi, ' - ')
    .split(/[-,;/]+/g)
    .map((x) => sanitizeName(x))
    .filter((x) => {
      if (!x) return false;
      const n = normalize(x);
      if (!n) return false;
      if (n.includes('FIRMA')) return false;
      if (n === 'BOS' || n === 'BOŞ') return false;
      return true;
    });

const parseRoomLine = (line) => {
  const roomMatch = line.match(/([ab])\s*blok(?:\s*kat\s*(\d+))?\s*oda\.?\s*(\d+)/i);
  if (!roomMatch) return null;
  const blok = roomMatch[1].toUpperCase();
  const kat = Number(roomMatch[2] || 1);
  const oda = Number(roomMatch[3]);
  const rest = line.slice(roomMatch.index + roomMatch[0].length).trim();
  const restNorm = normalize(rest);
  if (restNorm === 'BOS' || restNorm === 'BOŞ' || /^\s*boş\b/i.test(rest)) return { blok, kat, oda, occupants: [] };

  const explicitPairs = [...rest.matchAll(/(.*?)\s*Firma\s*:\s*\(?\s*([^)]+?)\s*\)?/gi)];
  const occupants = [];

  if (explicitPairs.length > 0) {
    explicitPairs.forEach((m) => {
      const names = splitNames(m[1]);
      const firma = String(m[2] || '').trim();
      names.forEach((name) => occupants.push({ name, firma }));
    });
  } else {
    const inferredFirma = /\bkantin\b/i.test(rest) ? 'KANTİN' : 'BELİRTİLMEDİ';
    const fallbackNames = splitNames(rest.replace(/\bkantin\b/gi, ' '));
    fallbackNames.forEach((name) => occupants.push({ name, firma: inferredFirma }));
  }

  return { blok, kat, oda, occupants };
};

const personByName = (personeller, rawName) => {
  const target = normalize(sanitizeName(rawName));
  if (!target) return undefined;
  const tokens = target.split(' ').filter(Boolean);
  const exact = personeller.find((p) => normalize(`${p.ad} ${p.soyad}`) === target);
  if (exact) return exact;
  if (tokens.length === 1) {
    const byFirst = personeller.filter((p) => normalize(p.ad) === tokens[0]);
    return byFirst.length === 1 ? byFirst[0] : undefined;
  }
  return personeller.find((p) => {
    const full = normalize(`${p.ad} ${p.soyad}`);
    return full.includes(target) || target.includes(full);
  });
};

const makeTaseronPersonel = (rawName, firma) => {
  const cleaned = sanitizeName(rawName);
  const parts = cleaned.split(' ').filter(Boolean);
  const ad = (parts[0] || 'ADI').toLocaleUpperCase('tr-TR');
  const soyad = (parts.slice(1).join(' ') || 'BİLİNMİYOR').toLocaleUpperCase('tr-TR');
  return {
    id: `prs_taseron_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tcNo: '',
    ad,
    soyad,
    babaAdi: '',
    dogumTarihi: '1990-01-01',
    telefonNo: '',
    eposta: '',
    adres: 'Kamp Yerleşimi',
    il: '',
    ilce: '',
    departman: 'TAŞERON',
    gorev: 'TAŞERON PERSONEL',
    iseGirisTarihi: today,
    cinsiyet: 'Belirtilmedi',
    maas: 0,
    ucretTipi: 'Günlük',
    sgkDurumu: 'Sigortasız',
    bankaAdi: '',
    subeAdi: '',
    ibanNo: '',
    durum: true,
    firmaTipi: 'TASERON',
    firmaAdi: firma || 'TAŞERON',
  };
};

const makeTaseronCari = (firma) => ({
  id: `ck_taseron_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  kartTipi: 'TASERON',
  kod: `TSR-${Math.floor(100 + Math.random() * 900)}`,
  unvan: firma,
  yetkili: '',
  telefon: '',
  eposta: '',
  vergiNo: '',
  vergiDairesi: '',
  adres: 'Kamp oda yerleşim entegrasyonu ile oluşturuldu.',
  iban: '',
  durum: 'AKTIF',
  notlar: 'Oda yerleşim toplu aktarımından otomatik oluşturuldu.',
});

async function main() {
  const [roomsSnap, staysSnap, personSnap, cariSnap] = await Promise.all([
    getDocs(collection(db, 'kampOdalari')),
    getDocs(collection(db, 'kampKayitlari')),
    getDocs(collection(db, 'personeller')),
    getDocs(collection(db, 'cariKartlar')),
  ]);

  const rooms = roomsSnap.docs.map((d) => d.data());
  const stays = staysSnap.docs.map((d) => d.data());
  const personeller = personSnap.docs.map((d) => d.data());
  const cariKartlar = cariSnap.docs.map((d) => d.data());

  const parsedLines = ROSTER_TEXT.split('\n').map((x) => x.trim()).filter(Boolean);
  const roster = parsedLines.map(parseRoomLine).filter(Boolean);
  const roomIndex = new Map(
    rooms.map((r) => [`${normalize(r.yerleskeAdi)}|${normalize(r.kogusNo)}|${normalize(r.odaNo)}`, r])
  );

  const toCreatePersonel = [];
  const toCreateCari = [];
  const toCreateStay = [];
  const toDeactivate = stays.filter((k) => k.durum === 'AKTIF');
  const occupancy = new Map();
  const createdNameCache = new Map();

  for (const row of roster) {
    const key = `${normalize(`${row.blok} BLOK`)}|${normalize(`KAT ${row.kat}`)}|${normalize(`ODA ${row.oda}`)}`;
    const room = roomIndex.get(key);
    if (!room) {
      console.log(`⚠️ Oda bulunamadı: ${row.blok} BLOK KAT ${row.kat} ODA ${row.oda}`);
      continue;
    }
    for (const occ of row.occupants) {
      if (!occ.name) continue;
      const cleanedFirma = String(occ.firma || '').trim() || 'BELİRTİLMEDİ';
      let personel = personByName(personeller, occ.name);
      const nameKey = normalize(occ.name);
      if (!personel && createdNameCache.has(nameKey)) {
        personel = createdNameCache.get(nameKey);
      }
      let firmaTipi = 'ANA_FIRMA';
      let calistigiFirma = personel?.firmaAdi || (isKibritci(cleanedFirma) ? 'Kibritçi İnşaat' : cleanedFirma);
      if (!personel) {
        const created = makeTaseronPersonel(occ.name, cleanedFirma);
        personel = created;
        createdNameCache.set(nameKey, created);
        toCreatePersonel.push(created);
        firmaTipi = 'TASERON';
      } else {
        firmaTipi = personel.firmaTipi === 'TASERON' ? 'TASERON' : 'ANA_FIRMA';
      }

      if (!isKibritci(cleanedFirma)) {
        const existsCari =
          cariKartlar.some((c) => c.kartTipi === 'TASERON' && normalize(c.unvan) === normalize(cleanedFirma)) ||
          toCreateCari.some((c) => normalize(c.unvan) === normalize(cleanedFirma));
        if (!existsCari) toCreateCari.push(makeTaseronCari(cleanedFirma));
      }

      toCreateStay.push({
        id: `reg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        personelIsim: `${personel.ad} ${personel.soyad}`.trim(),
        personelId: personel.id,
        odaId: room.id,
        roomId: room.id,
        yerleskeAdi: room.yerleskeAdi,
        katAdi: room.kogusNo,
        odaNo: room.odaNo,
        girisTarihi: today,
        durum: 'AKTIF',
        calistigiFirma,
        firmaTipi,
      });
      occupancy.set(room.id, (occupancy.get(room.id) || 0) + 1);
    }
  }

  const toUpdateRooms = rooms.map((r) => {
    const activeCount = occupancy.get(r.id) || 0;
    let durum = 'BOŞ';
    if (activeCount >= r.kapasite) durum = 'DOLU';
    else if (activeCount > 0) durum = 'KISMEN DOLU';
    return { ...r, durum };
  });

  console.log(`Mod: ${DRY_RUN ? 'DRY-RUN' : 'EXECUTE'}`);
  console.log(`Toplam satır: ${parsedLines.length}`);
  console.log(`Pasife çekilecek aktif konaklama: ${toDeactivate.length}`);
  console.log(`Yeni taşeron personel: ${toCreatePersonel.length}`);
  console.log(`Yeni taşeron cari kart: ${toCreateCari.length}`);
  console.log(`Yeni aktif kamp kaydı: ${toCreateStay.length}`);

  if (DRY_RUN) return;

  for (let i = 0; i < toDeactivate.length; i += 350) {
    const batch = writeBatch(db);
    for (const k of toDeactivate.slice(i, i + 350)) {
      batch.set(
        doc(db, 'kampKayitlari', k.id),
        { ...k, durum: 'PASIF', cikisTarihi: today },
        { merge: true }
      );
    }
    await batch.commit();
  }

  for (let i = 0; i < toCreatePersonel.length; i += 350) {
    const batch = writeBatch(db);
    for (const p of toCreatePersonel.slice(i, i + 350)) {
      batch.set(doc(db, 'personeller', p.id), p, { merge: true });
    }
    await batch.commit();
  }

  for (let i = 0; i < toCreateCari.length; i += 350) {
    const batch = writeBatch(db);
    for (const c of toCreateCari.slice(i, i + 350)) {
      batch.set(doc(db, 'cariKartlar', c.id), c, { merge: true });
    }
    await batch.commit();
  }

  for (let i = 0; i < toCreateStay.length; i += 350) {
    const batch = writeBatch(db);
    for (const s of toCreateStay.slice(i, i + 350)) {
      batch.set(doc(db, 'kampKayitlari', s.id), s, { merge: true });
    }
    await batch.commit();
  }

  for (let i = 0; i < toUpdateRooms.length; i += 350) {
    const batch = writeBatch(db);
    for (const r of toUpdateRooms.slice(i, i + 350)) {
      batch.set(doc(db, 'kampOdalari', r.id), r, { merge: true });
    }
    await batch.commit();
  }

  console.log('✅ Kamp oda yerleşim aktarımı tamamlandı.');
}

main().catch((err) => {
  console.error('Import hatası:', err);
  process.exit(1);
});

