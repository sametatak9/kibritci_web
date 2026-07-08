# ERP Smoke Test Raporu

Tarih: 2026-07-04

## Çalıştırılan kontroller

- `npm run lint` -> FAIL
- `npm run build` -> PASS
- `npm run test:gemini` -> FAIL (kredi/bakiye)
- `npm run migrate:firestore:audit` -> PASS

## P0/P1 bulgular (smoke turu)

1. **P1 - Mobil Formen kaydetme geri bildirimi**
   - Standalone formen akışında senkron kaydetme fonksiyonu gönderilmiyordu.
   - Sonuç: kaydet başarısı UI'da erken görünebilirdi.
   - Durum: Düzeltildi (`App.tsx` üzerinden `saveYoklamalarNow` geçirildi).

2. **P1 - TS lint kapısı kırık**
   - Projede mevcut birden fazla TypeScript uyumsuzluğu var.
   - Sonuç: `lint` kalite kapısı geçilemiyor.
   - Durum: Kısmi düzeltme yapıldı (`FormenScreen` import hatası), kalanlar backlog'a alındı.

3. **P1 - Gemini servis sağlık kontrolü**
   - `test:gemini` prepayment credits depleted hatası veriyor.
   - Sonuç: AI bağımlı akışlarda servis kesintisi riski.
   - Durum: Kod düzeyi değil, faturalandırma aksiyonu gerekli.

## Notlar

- Build çıktısı başarılı; chunk boyutu uyarıları bilgi amaçlı.
- Firestore audit komutu canlı koleksiyon envanterini başarıyla döndü.
