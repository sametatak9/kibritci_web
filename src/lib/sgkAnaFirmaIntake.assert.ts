/**
 * Ana Firma SGK WhatsApp hattı — yoklama kilidi iddiaları.
 * Çalıştır: npx tsx src/lib/sgkAnaFirmaIntake.assert.ts
 */
import {
  anaFirmaWpCikisKuyrukHazir,
  anaFirmaWpGirisKuyrukHazir,
  attachAnaFirmaSgkEvrakPreservingYoklama,
  buildAnaFirmaWpCikisTalepDoc,
  buildAnaFirmaWpGirisTalepDoc,
  findAnaFirmaPersonelByTc,
  isKibritciSgkIsveren,
} from './sgkAnaFirmaIntake';
import { buildAnaFirmaPersonelFromSgkTalep } from './sgkGrupSablon';
import { CANONICAL_ANA_FIRMA_ADI, isGorevsizPersonel } from './yoklamaUtils';
import type { Personel } from '../types/erp';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isKibritciSgkIsveren('KİBRİTÇİ İNŞAAT TAAHHÜT') === true, 'Kibritçi işveren');
assert(isKibritciSgkIsveren('Kibritci Insaat') === true, 'ascii Kibritçi');
assert(isKibritciSgkIsveren('') === false, 'boş ünvan Ana Firma değil');
assert(isKibritciSgkIsveren('YURT MEKANİK') === false, 'taşeron işveren değil');
assert(isKibritciSgkIsveren('KUTER ELEKTRİK') === false, 'Kuter Ana Firma değil');

const parsedGiris = {
  yon: 'giris' as const,
  ad: 'MEHMET',
  soyad: 'YILMAZ',
  tcNo: '12345678901',
  firmaAdi: 'KİBRİTÇİ İNŞAAT',
  isGorev: 'İNŞAAT İŞÇİSİ',
  tarih: '2026-09-01',
};
assert(anaFirmaWpGirisKuyrukHazir(parsedGiris), 'giriş kuyruk hazır');
assert(!anaFirmaWpGirisKuyrukHazir({ ...parsedGiris, firmaAdi: 'YURT MEKANİK' }), 'taşeron giriş bu kanal değil');

const girisDoc = buildAnaFirmaWpGirisTalepDoc({
  id: 'GIRIS-SGK-WP-1',
  parsed: parsedGiris,
  evrakUrl: 'data:application/pdf;base64,AAA',
  gonderen: 'wa:90555',
});
assert(girisDoc.kaynak === 'SGK_GRUP', 'kaynak SGK_GRUP');
assert(girisDoc.firmaTipi === 'ANA_FIRMA', 'firmaTipi');
assert(girisDoc.firmaAdi === CANONICAL_ANA_FIRMA_ADI, 'kanonik ad');
assert(girisDoc.gorev === undefined, 'PDF meslek yoklama görevi olmaz');
assert(girisDoc.nitelik === 'İNŞAAT İŞÇİSİ', `nitelik meslek: ${girisDoc.nitelik}`);
assert(girisDoc.gorevBosArafta === true, 'arafta');
assert(girisDoc.durum === 'BEKLEMEDE', 'kadro yazılmaz');

const withGorev = buildAnaFirmaWpGirisTalepDoc({
  id: 'GIRIS-SGK-WP-2',
  parsed: parsedGiris,
  gonderen: 'kampci',
  bildirimGorev: 'FORMEN',
});
assert(withGorev.gorev === 'FORMEN', 'mevcut bildirim görevi korunur');
assert(withGorev.gorevBosArafta === false, 'bildirimli arafta değil');

const existing: Personel = {
  id: 'p_formen',
  tcNo: '12345678901',
  ad: 'MEHMET',
  soyad: 'YILMAZ',
  gorev: 'FORMEN',
  firmaTipi: 'ANA_FIRMA',
  firmaAdi: CANONICAL_ANA_FIRMA_ADI,
  personelGrubu: 'SAHA',
  durum: true,
  istenCikisTarihi: '',
  departman: 'ŞANTİYE',
  maas: 1,
  ucretTipi: 'Aylık',
  sgkDurumu: "SGK'lı",
  babaAdi: '',
  dogumTarihi: '',
  telefonNo: '',
  eposta: '',
  adres: '',
  il: '',
  ilce: '',
  cinsiyet: 'Belirtilmedi',
  bankaAdi: '',
  subeAdi: '',
  ibanNo: '',
  iseGirisTarihi: '2024-01-01',
};
const merged = attachAnaFirmaSgkEvrakPreservingYoklama(existing, {
  evrakUrl: 'data:application/pdf;base64,BBB',
  nitelik: 'İNŞAAT İŞÇİSİ',
  ad: 'XX',
  soyad: 'YY',
  iseGirisTarihi: '2026-09-01',
});
assert(merged.gorev === 'FORMEN', 'mevcut görev ezilmez');
assert(merged.durum === true, 'durum ezilmez');
assert(merged.firmaTipi === 'ANA_FIRMA', 'firmaTipi ezilmez');
assert(merged.firmaAdi === CANONICAL_ANA_FIRMA_ADI, 'firmaAdi ezilmez');
assert(merged.personelGrubu === 'SAHA', 'personelGrubu ezilmez');
assert(merged.ad === 'MEHMET', 'ad ezilmez');
assert(merged.iseGirisTarihi === '2024-01-01', 'işe giriş ezilmez');
assert(merged.sigortaEvrakUrl === 'data:application/pdf;base64,BBB', 'evrak bağlanır');
assert(merged.nitelik === 'İNŞAAT İŞÇİSİ', 'boş nitelik dolar');

assert(findAnaFirmaPersonelByTc([existing], '12345678901')?.id === 'p_formen', 'TC Ana Firma');
const taseronLike: Personel = { ...existing, id: 'p_t', firmaTipi: 'TASERON', firmaAdi: 'YURT MEKANİK' };
assert(!findAnaFirmaPersonelByTc([taseronLike], '12345678901'), 'taşeron TC Ana Firma değil');

const parsedCikis = {
  yon: 'cikis' as const,
  ad: 'MEHMET',
  soyad: 'YILMAZ',
  tcNo: '12345678901',
  firmaAdi: 'KİBRİTÇİ İNŞAAT',
  isGorev: '',
  tarih: '2026-09-10',
};
assert(anaFirmaWpCikisKuyrukHazir(parsedCikis), 'çıkış TC+Kibritçi');
assert(!anaFirmaWpCikisKuyrukHazir({ ...parsedCikis, tcNo: '' }), 'çıkış TC yoksa kuyruk yok');

const cikisDoc = buildAnaFirmaWpCikisTalepDoc({
  id: 'CIKIS-SGK-WP-1',
  parsed: parsedCikis,
  gonderen: 'wa:1',
  mevcut: existing,
});
assert(cikisDoc.personelId === 'p_formen', 'çıkış mevcut karta bağlanır');
assert(cikisDoc.personelGorev === 'FORMEN', 'çıkış görev sadece bilgi');
assert(cikisDoc.kaynak === 'SGK_GRUP', 'çıkış kaynak');

const araftaKart = buildAnaFirmaPersonelFromSgkTalep({
  id: 'GIRIS-SGK-ARAFTA',
  ad: 'ALI',
  soyad: 'DEMIR',
  tcNo: '10987654321',
  iseGirisTarihi: '2026-09-01',
  kaynak: 'SGK_GRUP',
  grupBildirildi: true,
  nitelik: 'KALIPÇI',
});
assert(!String(araftaKart.gorev || '').trim(), 'yeni kart görev boş arafta');
assert(isGorevsizPersonel(araftaKart), 'arafta yoklamaya girmez');
assert(araftaKart.nitelik === 'KALIPÇI', 'nitelik meslek');
assert(araftaKart.firmaTipi === 'ANA_FIRMA', 'yeni kart Ana Firma');

console.log('sgkAnaFirmaIntake.assert: ok');
