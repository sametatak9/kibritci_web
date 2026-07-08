# ERP Derin Regresyon Raporu

Tarih: 2026-07-04  
Kapsam: Formen, Yoklama, Idari, Kamp, Satın Alma

## İncelenen kritik akışlar

- Formen yoklama/saha faaliyet kaydetme
- Yoklama bireysel modal ve gün aktiflik hesapları
- Idari formen içeri alma/arşiv
- Kamp yerleşim veri yazımı
- Satın alma stok entegrasyonu

## Bulgu özeti

- P0: 1
- P1: 4
- P2: 5
- P3: 3

## Bu turda uygulanan düzeltmeler

1. **P0 - Formen kaydetmede statü ezilmesi**
   - Problem: İşaretlenmeyen personel otomatik `Girilmedi` yazılarak mevcut özel statüler (`İzinli`, `Raporlu`, vb.) ezilebiliyordu.
   - Düzeltme: Sadece o gün için hiç kayıt yoksa varsayılan kayıt oluşturuluyor; mevcut gün verisi korunuyor.
   - Dosya: `src/components/FormenScreen.tsx`

2. **P1 - Standalone Formen kaydetmenin await edilmemesi**
   - Problem: Mobil formen ekranında `saveYoklamalarNow` prop'u verilmediği için kaydetme fire-and-forget kalıyordu.
   - Düzeltme: Mobil formen path'ine `saveYoklamalarNow` geçirildi.
   - Dosya: `src/App.tsx`

3. **P1 - Yoklama bireysel modal yanlış ay/yıl aktiflik hesabı**
   - Problem: Modal kendi ay/yıl seçicisini kullansa da gün aktifliği ana ekran ay/yılıyla hesaplanıyordu.
   - Düzeltme: Periyot parametreli helper eklendi ve modal bu helper'ı kullanacak şekilde güncellendi.
   - Dosya: `src/components/YoklamaScreen.tsx`

4. **P2 - Idari içeri alma mükerrer arşiv üretimi**
   - Problem: Aynı tarih için tekrar "içeri al" işlemi mükerrer arşiv kaydı oluşturabiliyordu.
   - Düzeltme: Tarih bazlı arşiv varlık kontrolü eklenip işlem engellendi.
   - Dosya: `src/components/IdariScreen.tsx`

5. **P2 - Satın alma düzenleme sonrası stok işlem mükerrerliği**
   - Problem: Aynı belge için `stokIslemGecmisi` tekrar tekrar eklenebiliyordu.
   - Düzeltme: `stokKartId|belgeNo|islemTipi` anahtarına göre dedupe eklendi.
   - Dosya: `src/components/SatinAlmaScreen.tsx`

## Açık kalan bulgular (backlog)

- **P1** Kampçı manuel yerleşimde `ANA_FIRMA`/`TASERON` veri tutarlılığı
- **P1** Satın alma -> stok `miktar` alanının artırılmaması
- **P1** Silinen satın alma belgelerinde stok yan etkilerinin geri alınmaması
- **P2** Kamp oda toplu tahliye akışında atomiklik
- **P2** Formen "geri al" akışında Firestore geri yazım eksikliği

## Doğrulama yaklaşımı

- Kod bazlı regresyon taraması + hedefli düzeltme
- Ardından lint/build + DB audit tekrar turu
