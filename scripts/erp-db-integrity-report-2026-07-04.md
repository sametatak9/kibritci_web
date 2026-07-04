# ERP Firestore Bütünlük Raporu

Tarih: 2026-07-04

## Çalıştırılan kontroller

- `npm run migrate:firestore:audit`
- Runtime koleksiyon kullanımı vs `scripts/firestore-collections.mjs` karşılaştırması
- Yoklama anahtar format dağılımı (global yoklama map)
- Orphan referans taraması (kamp/personel/cari/stok)
- Taşeron sızma kontrolü (`personeller` vs `yoklamalar`)

## Sonuç özeti

### 1) Koleksiyon envanteri

- Boş olmayan toplam kayıt: **9305**
- Dikkat çeken yüksek hacim: `bildirimler` (6413), `stokIslemGecmisi` (922), `stokKartlar` (631), `sahaFaaliyetleri` (599)

### 2) Runtime kullanım vs katalog sapması

**Kodda kullanılıp katalogda olmayanlar**
- `programliFaaliyetler`
- `sahaGunRaporArsiv`

**Katalogda olup kodda aktif kullanılmayanlar**
- `cariIslemGecmisi`
- `demirbaslar`
- `epostaGonderimleri`
- `formenGunlukRaporlar`
- `hazirTutanaklar`
- `personelIslemGecmisi`
- `stokIslemGecmisi`
- `yetkiSablonlari`

Değerlendirme: Katalog/runtime drift mevcut; migration ve denetim scriptleri eksik/fazla koleksiyonla çalışıyor.

### 3) Yoklama anahtar formatı

- `employeeCount`: 414
- `YYYY-MM-DD` formatlı anahtar sayısı: 5731
- Legacy düz format (`1..31` gibi) üst anahtarlar: yoğun biçimde mevcut (örnek: `1`..`20` anahtarları 240 çalışan kaydında)

Değerlendirme: Aynı dokümanda iki farklı anahtar şeması birlikte yaşıyor. Normalize edilmezse rapor/filtre sapmaları riski devam eder.

### 4) Orphan referanslar

- `kampKayitlari` toplam: 104
- `kampKayitlariMissingPersonelId`: **4**
- `kampKayitlariMissingOdaId`: **4**
- `personelZimmetleriMissingPersonelId`: 0
- `personelZimmetleriMissingStokKartId`: 0
- `satinAlmaTalepleriMissingCariId`: 0

Değerlendirme: Kamp yerleşim tarafında referans kırıkları var; raporlama/yerleşim ekranında tutarsız kayıt gösterebilir.

### 5) Taşeron sızma kontrolü

- Toplam taşeron personel: 26
- Yoklama girdisi olan taşeron personel: **0**

Değerlendirme: Taşeronun yoklama zincirine sızması bu snapshot'ta tespit edilmedi.

## Aksiyon önerisi

1. Koleksiyon kataloğunu runtime ile hizala (`programliFaaliyetler`, `sahaGunRaporArsiv` ekle; pasif isimleri temizle veya gerekçelendir).
2. Yoklama anahtarlarını tek şemaya normalize et (`YYYY-MM-DD` veya year/month/day tek standard).
3. `kampKayitlari` orphan kayıtları için onarım scripti çalıştır.
