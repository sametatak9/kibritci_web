# Veri Kalıcılığı ve Kaydetme Metodları Audit Raporu

Tarih: 2026-07-02  
Kapsam: `src/App.tsx` sekme router'ındaki tüm ekranların kaydetme/persist akışları, kritik veri kaybı regresyonları, 2-3 dk beklemeli DB dayanıklılık testleri.

## Yöntem (Debug Yaklaşımı)

- Sekme envanteri çıkarıldı (`activeTab` bazlı tüm ekranlar).
- Her ekran için App seviyesinde geçen setter'ın `WithSync` olup olmadığı doğrulandı.
- `syncArrayToFirestore`, `saveYoklamaDocument`, `saveDocument`, `setDoc`, `deleteDoc` çağrıları tarandı.
- Kritik akışlarda canlı DB smoke testleri çalıştırıldı:
  - Formen yoklama kaydı -> 180 sn bekleme -> DB'den tekrar okuma.
  - Kamp oda/yerleşke kayıtları için daha önce roundtrip + silme/güncelleme testi.

## Kritik Bulgular ve Uygulanan Düzeltmeler

- ✅ **Kamp tarafı kendi kendine silinme yolu kapatıldı**
  - Açılışta otomatik purge akışı kaldırıldı.
  - Oda var / yerleşke-kat eksik durumunda otomatik yapı onarımı eklendi.

- ✅ **Yoklama tarafı otomatik arka plan silme kaldırıldı**
  - Personel çıkışından sonrası için arka planda yoklama kayıtlarını silen effect devre dışı bırakıldı.
  - UI tarafı pasif gün mantığı korunuyor.

- ✅ **Yoklama ekranına manuel DB kaydetme eklendi**
  - Taslak düzenleme + `Günü Kaydet (DB)` + `Taslağı Geri Al`.
  - Son kaydetme zamanı etiketi eklendi.

- ✅ **Formen mobilde kaydetme güvene alındı**
  - `YOKLAMAYI İMZALA VE KAYDET` sadece taslak varken aktif.
  - Mesai +/- ve toplu sıfırlama dahil tüm değişiklikler taslak flag'i üretir.
  - Son kaydetme zamanı etiketi eklendi.

- ✅ **Mükerrer personel satırı azaltıldı**
  - Aylık personel listesi üretiminde (özellikle legacy/stub ID kaynaklı) isim/TC bazlı tekilleştirme eklendi.

- ✅ **Sekme geri dönüş deneyimi**
  - Sekme bazlı son konum (scrollTop) saklanıyor ve sekmeye dönünce restore ediliyor.

## Sekme Bazlı Kaydetme Test Sonucu (App Router)

- ✅ `admin`, `personel`, `yoklama`, `satin_alma`, `irsaliye_giris`, `fatura_giris`, `evrak_baglama`, `yz_karsilastir`, `taseron_kesinti`, `kasa`, `idari (arac/kamp/saha/tutanak/cari_stok/eposta)`, `onay_islemleri`, `formen_ekrani`, `kampci_ekrani`, `lojistik_ekrani`, `depocu_ekrani`, `evrak_aktarimi`, `profil`, `yetki_verme`, `operator`, `maas_odeme`
  - App tarafında `set*WithSync` veya ekran içi doğrudan Firestore yazımı var.
  - Realtime `onSnapshot` ile DB kaynaklı tek gerçek state'e geri dönülüyor.

- ℹ️ `kullanicilar`, `kampOdalari`, `kampKayitlari`
  - Bilinçli olarak toplu `syncArrayToFirestore` kullanılmıyor.
  - Bu koleksiyonlarda tekil `saveKullanici` / kamp util fonksiyonları üzerinden doğrudan Firestore yazımı tercih ediliyor (yarış koşulu riskini azaltmak için).

- ℹ️ Salt-okuma/raporlama sekmeleri (`ana_sayfa`, `maas`, `personel_kartlari`, `planli_organizasyon`, `saha_kolaj`, `sohbet`, `guvenlik_ekrani`, `kibar_hakedis`) doğrudan veri yazmıyor veya ikincil yazıyor.

## Canlı Testler

- ✅ **Formen persistence testi (180 sn beklemeli): PASS**
  - Yoklama+mesai DB'ye yazıldı.
  - 3 dakika sonra tekrar okuma yapıldı.
  - Kayıt korunmuş bulundu.

- ✅ **Build/Lint doğrulaması: PASS**
  - `npm run build` başarılı.
  - Düzenlenen dosyalarda linter hatası yok.

## Açık Riskler (Takip Edilecek)

- Kullanıcı kaynaklı manuel silme aksiyonları (onay dialog sonrası) hâlâ mevcut; bu tasarım kararıdır.
- Tüm modüllerde "Son kaydetme zamanı" görünürlüğü henüz yok; şu an Yoklama + Formen tarafında aktif.

## Önerilen Sonraki Adım (Opsiyonel Güvenlik Katmanı)

- "Maaş haftası güvenlik modu" eklenebilir:
  - Silme butonları geçici kilit.
  - Yalnızca yönetici + çift onay + doğrulama metni ile açılma.
  - Kritik koleksiyonlarda soft-delete + geri al.
