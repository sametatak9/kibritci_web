import {
  buildSgkGirisWhatsAppText,
  buildSgkTalepPatchFromParse,
  shareableKimlikUrlsForWp,
} from '../src/lib/sgkGrupSablon.ts';
import { gorevOptionsFromPersoneller } from '../src/lib/catalogFieldUtils.ts';

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('ok:', msg);
  }
}

const httpsKimlik = 'https://firebasestorage.googleapis.com/v0/b/kibritci-erp.appspot.com/o/kimlik.jpg?alt=media&token=abc';
const dataKimlik = 'data:image/jpeg;base64,/9j/aaaa';

const withUrl = buildSgkGirisWhatsAppText({
  ad: 'AHMET',
  soyad: 'YILMAZ',
  tcNo: '12345678901',
  gorev: 'DÜZ İŞÇİ',
  nitelik: 'ALÇI SIVA USTASI',
  girisTarihi: '2026-09-01',
  gonderen: 'kampci@test.com',
  kimlikFotoUrl: httpsKimlik,
});

assert(withUrl.includes(httpsKimlik), 'HTTPS kimlik URL metinde');
assert(withUrl.includes('Kimlik görseli (tıklayınca açılır)'), 'kimlik başlığı');
assert(!withUrl.includes('bu mesajla birlikte gruba eklenir'), 'eski yalan dipnot yok');
assert(withUrl.includes('DÜZ İŞÇİ'), 'görev yoklama satırında');

const withoutUrl = buildSgkGirisWhatsAppText({
  ad: 'AYŞE',
  soyad: 'DEMİR',
  gorev: 'FORMEN',
  girisTarihi: '2026-09-01',
  kimlikFotoUrl: dataKimlik,
});
assert(!withoutUrl.includes('data:image'), 'data URL WhatsApp metnine konmaz');
assert(withoutUrl.includes('wa.me dosya ekleyemez'), 'data URL için açık uyarı');
assert(shareableKimlikUrlsForWp({ kimlikFotoUrl: dataKimlik, kimlikFotoUrls: [httpsKimlik] }).length === 1, 'yalnızca HTTPS toplanır');
assert(shareableKimlikUrlsForWp({ kimlikFotoUrl: httpsKimlik, kimlikFotoUrls: [httpsKimlik] }).length === 1, 'tekrar yok');

const gorevler = gorevOptionsFromPersoneller([
  { gorev: 'DÜZ İŞÇİ' },
  { gorev: 'FORMEN' },
  { gorev: ' DÜZ İŞÇİ ' },
  { gorev: '' },
]);
assert(gorevler.includes('DÜZ İŞÇİ') && gorevler.includes('FORMEN') && gorevler.length === 2, 'kadrodan görev');

const cikisPatch = buildSgkTalepPatchFromParse(
  { ad: 'ALI', soyad: 'KAYA', cikisTarihi: '2026-08-20', iseGirisTarihi: '2020-01-01' },
  'https://example.com/cikis.pdf',
  'cikis',
  { id: 'x', gorev: 'KALIPÇI' }
);
assert(cikisPatch.cikisTarihi === '2026-08-20', 'çıkış evrak tarihi cikisTarihi alanından');
assert(cikisPatch.gorev === 'KALIPÇI', 'yoklama görevi bildirimi korur');

if (failed) {
  console.error(`\n${failed} assertion failed`);
  process.exit(1);
}
console.log('\nSGK WP kimlik/görev checks passed.');
