# ERP Release Readiness

Tarih: 2026-07-04

## Gate sonuçları

- `npm run build` -> **PASS**
- `npm run lint` -> **FAIL** (proje genelinde mevcut TS tip hataları)
- `npm run test:gemini` -> **FAIL** (Google AI Studio kredi/bakiye)
- Firestore denetim -> **PASS** (rapor üretildi, fakat schema drift/orphan bulguları var)

## Bu turda kapanan kritikler

- Formen kaydetmede statü ezilmesi (P0) kapatıldı
- Mobil formen kaydetme await/senkronizasyon açığı kapatıldı
- Yoklama bireysel modal ay/yıl aktiflik sapması kapatıldı
- Idari mükerrer arşivleme engeli eklendi
- Satın alma stok işlem geçmişi dedupe eklendi

## Açık riskler

- Lint kapısı kırık (çoklu TS uyumsuzluğu)
- Gemini bağımlı özellikler dış servis kotasına bağlı ve şu an kesintili
- Kamp referans orphans (8 kayıt)
- Koleksiyon katalog/runtime drift (`programliFaaliyetler`, `sahaGunRaporArsiv`)
- Satın alma stok miktar entegrasyonu eksikliği

## Yayın kararı

**NO-GO (tam yeşil release için uygun değil).**

### Koşullu GO (acil yayın gerekirse)

- AI bağımlı özelliklerin geçici devre dışı bırakılması veya kullanıcıya açık "servis geçici kapalı" uyarısı
- Kamp orphan ve koleksiyon drift için hızlı düzeltme patch'i
- Lint kırıkları için ayrı stabilization sprint'i
