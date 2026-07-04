# ERP Denetim Çerçevesi

Tarih: 2026-07-04  
Kapsam: Formen, Yoklama/Puantaj, Idari, Kamp, Satın Alma, Cari/Stok, Personel

## 1) Hata Öncelik Sınıfları

- P0: Veri kaybı, yanlış finans/yoklama sonucu, üretim kullanımını durduran hata
- P1: Temel akışı bozan hata, kritik workaround var ama riskli
- P2: İşlev var ama eksik/yanlış UX, operasyonu tamamen durdurmaz
- P3: Görsel/label/ufak tutarsızlık

## 2) Bug Kayıt Formatı

Her bulgu aşağıdaki formatta kaydedilir:

- ID
- Modül/Sekme
- Rol
- Adımlar
- Beklenen
- Gerçekleşen
- Etki (DB/UI/hesap)
- Öncelik (P0-P3)
- Önerilen düzeltme
- Durum (new/in_progress/fixed/verified)

## 3) Hızlı Smoke Checklist (Yayın Öncesi)

- Giriş + rol bazlı sekme görünürlüğü
- Formen yoklama kaydet -> refresh sonrası persist
- Formen saha faaliyet kaydet -> Idari saha listesinde görünürlük
- Kamp yerleşim temel işlemleri
- Satın alma temel kayıt + listeleme
- Cari/stok arama ve CRUD
- `npm run lint`
- `npm run build`

## 4) Derin Regresyon Checklist (Detaylı Tur)

- Formen: tüm sekmeler, tarih filtreleri, foto yükleme, önizleme/PDF
- Yoklama: gün/ay bazlı anahtar doğruluğu, taşeron filtrelenmesi
- Idari: alt-sekme işlevleri, boş/işlevsiz buton tespiti
- Kamp: oda/personel/firma akışı, taşeron veri ayrımı
- Satın Alma -> İrsaliye -> Fatura -> Evrak bağlama zinciri
- Personel giriş/çıkış/güncelleme taleplerinin onay akışı
- Onay havuzu veri senkronu

## 5) Çıkış Koşulları

- P0 bulgu kalmaması
- P1 bulgular için fix veya net workaround + takip maddesi
- Build/lint temiz
- DB bütünlük raporunun tamamlanması
