# ERP Önceliklendirilmiş Düzeltme Backlogu

Tarih: 2026-07-04

## P0 (hemen)

### P0-1 Formen yoklama statü ezilmesi
- Durum: **FIXED**
- Dosya: `src/components/FormenScreen.tsx`
- Risk: Orta (yoklama kaydetme davranışı değişti)
- Doğrulama:
  - `İzinli/Raporlu` kayıtlı personelde Formen kaydetme sonrası statü korunuyor mu?
  - Save sonrası raporlarda beklenen sayı korunuyor mu?

## P1 (aynı sürümde çöz)

### P1-1 Standalone Formen'de senkron kaydetme
- Durum: **FIXED**
- Dosya: `src/App.tsx`
- Doğrulama:
  - Mobil formen kaydında hata simülasyonu yapılıp kullanıcıya hata dönüyor mu?

### P1-2 Yoklama bireysel modal ay/yıl aktif gün hesabı
- Durum: **FIXED**
- Dosya: `src/components/YoklamaScreen.tsx`
- Doğrulama:
  - Ana grid ayı farklıyken modal ayında kapalı günler doğru kilitleniyor mu?

### P1-3 Kamp yerleşim firma tipi tutarlılığı
- Durum: **OPEN**
- Dosya: `src/components/KampciScreen.tsx`, `src/lib/kampPlacementUtils.ts`
- Risk: Yüksek (ANA_FIRMA/TASERON rapor sapması)
- Doğrulama:
  - DB'den seçilen taşeron personel kamp kaydında `firmaTipi=TASERON` kalıyor mu?

### P1-4 Satın alma stok miktar entegrasyonu
- Durum: **OPEN**
- Dosya: `src/components/SatinAlmaScreen.tsx`
- Risk: Yüksek (stok sayısı operasyonel yanlış olabilir)
- Doğrulama:
  - Satın alma onayı sonrası ilgili `stokKart.miktar` güncelleniyor mu?

## P2 (hemen sonra)

### P2-1 Idari içeri al -> mükerrer arşiv
- Durum: **FIXED**
- Dosya: `src/components/IdariScreen.tsx`
- Doğrulama:
  - Aynı tarih ikinci kez içeri alınamıyor mu?

### P2-2 Satın alma stok işlem geçmişi mükerrer kayıt
- Durum: **FIXED**
- Dosya: `src/components/SatinAlmaScreen.tsx`
- Doğrulama:
  - Aynı belge tekrar düzenlenip kaydedildiğinde tek işlem satırı kalıyor mu?

### P2-3 Kamp orphan referanslar
- Durum: **OPEN**
- Dosya/Veri: `kampKayitlari` (4 personel + 4 oda referansı kırık)
- Doğrulama:
  - Orphan temizliği sonrası kamp kartları uyarısız açılıyor mu?

### P2-4 Koleksiyon katalog drift
- Durum: **OPEN**
- Dosya: `scripts/firestore-collections.mjs`
- Doğrulama:
  - Runtime kullanılan tüm koleksiyonlar katalogda mevcut mu?

## P3 (bakım turu)

- Lint'teki tarihsel TS uyumsuzluklarının temizlenmesi
- Build chunk optimizasyonu (performans)
- Kullanılmayan koleksiyon isimlerinin katalogdan kaldırılması

## Uygulama sırası

1. P0/P1 fixlerin merge edilmesi
2. Kamp + stok kritik P1 açıklarının kapanması
3. DB orphan ve katalog drift temizliği
4. Lint/build/smoke tekrar turu
5. Release kararı
