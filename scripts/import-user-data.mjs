import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountStr) {
  console.error("No service account key found in ENV");
  process.exit(1);
}

const serviceAccount = JSON.parse(serviceAccountStr);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// PURCHASING REQUESTS
const purchases = [
  {
    saId: "460",
    tarih: "2026-07-07",
    talepEden: "Gürsoy Mazlum",
    cariFirma: "",
    aciklama: "",
    onayDurumu: "ONAY BEKLİYOR",
    kalemler: [
      { id: "460-1", urunAdi: "NK22 REDHİT MARKA BETON ÇİVİSİ", miktar: 1000, birim: "ADET", marka: "REDHİT", kullanilacakYer: "SAHA ALANI", aciklama: "" }
    ]
  },
  {
    saId: "461",
    tarih: "2026-07-07",
    talepEden: "Gürsoy Mazlum",
    cariFirma: "",
    aciklama: "",
    onayDurumu: "ONAY BEKLİYOR",
    kalemler: [
      { id: "461-1", urunAdi: "MICIR", miktar: 20, birim: "ARABA", marka: "", kullanilacakYer: "ŞANTİYE", aciklama: "" }
    ]
  },
  {
    saId: "463",
    tarih: "2026-07-09",
    talepEden: "Gürsoy Mazlum",
    cariFirma: "",
    aciklama: "",
    onayDurumu: "ONAY BEKLİYOR",
    kalemler: [
      { id: "463-1", urunAdi: "İZALASYON FIRÇASI", miktar: 100, birim: "ADET", marka: "", kullanilacakYer: "DRENAJ İŞLERİ", aciklama: "" },
      { id: "463-2", urunAdi: "50*80 MOLOZ ÇUVALI", miktar: 2500, birim: "ADET", marka: "", kullanilacakYer: "DRENAJ İŞLERİ", aciklama: "" },
      { id: "463-3", urunAdi: "TYPAR SF 32 DRENAJ KEÇESİ", miktar: 5, birim: "TOP", marka: "TYPAR", kullanilacakYer: "DRENAJ İŞLERİ", aciklama: "" }
    ]
  },
  {
    saId: "462",
    tarih: "2026-07-09",
    talepEden: "Gürsoy Mazlum",
    cariFirma: "",
    aciklama: "",
    onayDurumu: "ONAY BEKLİYOR",
    kalemler: [
      { id: "462-1", urunAdi: "RULO KAĞIT HAVLU (SOLO MARKA)", miktar: 25, birim: "PAKET", marka: "SOLO", kullanilacakYer: "OFİS", aciklama: "" },
      { id: "462-2", urunAdi: "TUVALET KAĞIDI 32'Lİ (SOLO MARKA)", miktar: 50, birim: "TANE", marka: "SOLO", kullanilacakYer: "OFİS", aciklama: "" },
      { id: "462-3", urunAdi: "ISLAK MENDİL", miktar: 5, birim: "KUTU", marka: "", kullanilacakYer: "OFİS", aciklama: "" },
      { id: "462-4", urunAdi: "YÜZEY TEMİZLEYİCİ MENDİL", miktar: 5, birim: "KUTU", marka: "", kullanilacakYer: "OFİS", aciklama: "" },
      { id: "462-5", urunAdi: "TEMİZLİK BEZİ (HAVLU)", miktar: 15, birim: "TANE", marka: "", kullanilacakYer: "OFİS", aciklama: "" },
      { id: "462-6", urunAdi: "EYÜP SABRİ TUNCER OKYANUS ODA PARFÜMÜ", miktar: 2, birim: "KOLİ", marka: "EYÜP SABRİ TUNCER", kullanilacakYer: "OFİS", aciklama: "" },
      { id: "462-7", urunAdi: "ASPEROX SPARX BULAŞIK MAKİNASI TABLETİ", miktar: 8, birim: "PAKET", marka: "ASPEROX", kullanilacakYer: "OFİS", aciklama: "" },
      { id: "462-8", urunAdi: "TÜRK KAHVESİ MEHMET EFENDİ 25'LİK", miktar: 6, birim: "KUTU", marka: "MEHMET EFENDİ", kullanilacakYer: "OFİS", aciklama: "" },
      { id: "462-9", urunAdi: "NESCAFE CLASİC 900 GRAM", miktar: 1, birim: "TENEKE", marka: "NESCAFE", kullanilacakYer: "OFİS", aciklama: "" },
      { id: "462-10", urunAdi: "ÇAY ŞEKERİ SARGILI", miktar: 25, birim: "KG", marka: "", kullanilacakYer: "OFİS", aciklama: "" },
      { id: "462-11", urunAdi: "PET BARDAK", miktar: 3000, birim: "TANE", marka: "", kullanilacakYer: "OFİS", aciklama: "" },
      { id: "462-12", urunAdi: "ÇAY KARIŞTIRICI (AHŞAP)", miktar: 15, birim: "PAKET", marka: "", kullanilacakYer: "OFİS", aciklama: "" },
      { id: "462-13", urunAdi: "SARI GÜÇ", miktar: 25, birim: "TANE", marka: "", kullanilacakYer: "OFİS", aciklama: "" },
      { id: "462-14", urunAdi: "BULAŞIK SÜNGERİ SKOÇBRAYT", miktar: 30, birim: "TANE", marka: "SKOÇBRAYT", kullanilacakYer: "OFİS", aciklama: "" },
      { id: "462-15", urunAdi: "NESCAFE FİNCAN 6'LI TAKIM(BEYAZ)", miktar: 2, birim: "TANE", marka: "NESCAFE", kullanilacakYer: "OFİS", aciklama: "" },
      { id: "462-16", urunAdi: "2 Sİ 1 ARADA NESCAFE", miktar: 2, birim: "KOLİ", marka: "NESCAFE", kullanilacakYer: "OFİS", aciklama: "" },
      { id: "462-17", urunAdi: "KAHVE BEYAZLATICI(SÜT TOZU)", miktar: 6, birim: "TANE", marka: "", kullanilacakYer: "OFİS", aciklama: "" },
      { id: "462-18", urunAdi: "JAKOBS 3 Ü 1 ARADA YOĞUN 40'LI", miktar: 6, birim: "PAKET", marka: "JACOBS", kullanilacakYer: "OFİS", aciklama: "" }
    ]
  }
];

const personelDataRaw = `1 ABDULLAH AKAR 22240740270 29.06.2026
2 ABDULMELİK BAŞER 13980024232 29.06.2026
3 ADEM KALKAN 54247706836 20.05.2026
4 AHMET TİMUR 54298705178 20.05.2026
5 AHMET HASAN BAYTAK 51595773046 20.05.2026
6 AYHAN BOLAT 73171010314 09.06.2026
7 AYHAN KAYA 40105936200 20.05.2026
8 BERAT ÇAĞDAŞ 40180142268 20.05.2026
9 CEBRAİL EKİN 12026084452 29.06.2026
10 CENGİZ YÜREK 39767128092 20.05.2026
11 DİLOVAN TUTUK 10544471174 20.05.2026
12 ENES KOŞMAZ 41389482100 20.05.2026
13 ENES FURKAN DİRLİK 40537342198 20.05.2026
14 EREN ERYILMAZ 23890431976 09.06.2026
15 FURKAN AYHAN 12010926034 20.05.2026
16 FURKAN KARA 62365453082 20.05.2026
17 HALİL ERGİN 17048848594 01.07.2026
18 HALİL İBRAHİM KARAÇAYIR 30040646968 20.05.2026
19 HASAN HÜSEYİN DAMAR 17561836894 03.07.2026
20 KADİR KAYA 19973238204 22.06.2026
21 KADİR TOSUN 51253552020 20.05.2026
22 MAHMUT ŞAHİN 22202026916 20.05.2026
23 MEHMET BEKSARI 12945083710 01.07.2026
24 MEHMET ÖZYAMAN 28181190358 20.05.2026
25 MEHMET NURİ ÇAĞDAŞ 30761526426 20.05.2026
26 METİN SERDAR GÖKÇE 25694676140 14.05.2026
27 MİKAİL ASLAN 48724577958 20.05.2026
28 MUHAMMED YILDIZ 40426168786 08.06.2026
29 MUHAMMED ENES ÇAGBARUL 14689444864 20.05.2026
30 MUHAMMET BUĞDAYCI 28780611520 20.05.2026
31 MURAT ÖZDEN 52744731788 06.07.2026
32 MUSTAFA UYAR 27826752548 20.05.2026
33 NURİ LEYLEK 26636318128 20.05.2026
34 OZAN DAKNİ 11736102326 29.06.2026
35 ÖZCAN TİMUR 13782055854 01.07.2026
36 ÖZGÜR ÇAĞDAŞ 40174142496 20.05.2026
37 SERKAN DEMİRCİ 72715091406 01.07.2026
38 YASİN KÖSE 68545247786 20.05.2026
39 YUSUF KESKİN 18845062688 20.05.2026`;

const convertDate = (dStr) => {
  const [d, m, y] = dStr.split('.');
  return `${y}-${m}-${d}`;
};

const personnel = personelDataRaw.split('\n').map(line => {
  const parts = line.split(' ');
  const dateStr = parts.pop();
  const tc = parts.pop();
  const nameParts = parts.slice(1);
  const soyad = nameParts.pop();
  const ad = nameParts.join(' ');
  return {
    tcNo: tc,
    ad: ad,
    soyad: soyad,
    babaAdi: "",
    dogumTarihi: "1990-01-01",
    telefonNo: "",
    eposta: "",
    adres: "",
    il: "",
    ilce: "",
    departman: "Taşeron",
    gorev: "Taşeron Personeli",
    iseGirisTarihi: convertDate(dateStr),
    cinsiyet: "ERKEK",
    maas: 0,
    ucretTipi: "Aylık",
    sgkDurumu: "SGK'lı",
    bankaAdi: "",
    subeAdi: "",
    ibanNo: "",
    durum: true,
    firmaTipi: "TASERON",
    firmaAdi: "YURT MEKANİK"
  };
});

async function run() {
  const batch = db.batch();
  
  // SATIN ALMA TALEPLERI
  console.log("Adding purchasing requests...");
  for (const sa of purchases) {
    const docRef = db.collection('satinAlmaTalepleri').doc();
    batch.set(docRef, { ...sa, id: docRef.id });
  }

  // PERSONNEL
  console.log("Adding personnel...");
  for (const p of personnel) {
    const docRef = db.collection('personeller').doc();
    batch.set(docRef, { ...p, id: docRef.id });
  }

  await batch.commit();
  console.log("Data successfully added to Firebase!");
}

run().catch(console.error);
