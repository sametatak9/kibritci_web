/**
 * WhatsApp kayıt bildirimi — metin ve alıcı ayrıştırma.
 * Çalıştır: npx tsx src/lib/whatsappKayitBildirim.assert.ts
 */
import {
  buildPersonelKayitAcildiText,
  uniqueWhatsAppNotifyTargets,
  waSenderToE164,
} from './whatsappKayitBildirim';
import { taseronGrupWpHatE164 } from './taseronGrupSablon';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(waSenderToE164('wa:905551112233') === '905551112233', 'wa: E.164');
assert(waSenderToE164('wa:+90 555 111 22 33') === '905551112233', 'wa: boşluklu');
assert(waSenderToE164('0501 683 3400') === '905016833400', 'TR 0xxx');
assert(waSenderToE164('kampci@test.com') === null, 'e-posta alıcı değil');
assert(waSenderToE164('whatsapp-otomasyon') === null, 'etiket alıcı değil');

assert(
  buildPersonelKayitAcildiText({
    ad: 'Ali',
    soyad: 'Yılmaz',
    firmaAdi: 'Kuter İnşaat',
    yon: 'giris',
  }) === 'ALİ YILMAZ personeli KUTER İNŞAAT firmasında kaydı açıldı.',
  'giriş metin'
);
assert(
  buildPersonelKayitAcildiText({
    personelIsim: 'Ali Yılmaz',
    firmaAdi: 'Kibritçi İnşaat',
    yon: 'cikis',
  }).includes('kaydı kapatıldı'),
  'çıkış metin'
);

const hat = taseronGrupWpHatE164();
assert(hat === '905016833400', 'hat E.164');
assert(
  uniqueWhatsAppNotifyTargets({
    gonderen: 'wa:905016833400',
    ownHatE164: hat,
  }).length === 0,
  'kendi hatta gönderme'
);
assert(
  uniqueWhatsAppNotifyTargets({
    gonderen: 'wa:905551112233',
    extraTo: '905559998877',
    ownHatE164: hat,
  }).join(',') === '905551112233,905559998877',
  'gönderen + extra'
);

console.log('whatsappKayitBildirim.assert: ok');
