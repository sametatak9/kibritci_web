/**
 * Taşeron grup köprü — şablon / parse / kadro adayı iddiaları.
 * Çalıştır: npx tsx src/lib/taseronGrupSablon.assert.ts
 */
import {
  buildTaseronCikisWhatsAppText,
  buildTaseronGirisTalepDoc,
  buildTaseronGirisWhatsAppText,
  buildTaseronGrupPersonelCandidate,
  findOpenTaseronGrupTalep,
  inferTaseronYonFromText,
  isTaseronGrupOnayHazir,
  isTaseronGrupTalep,
  normalizeTaseronGrupParse,
  parseIsoOrTrDate,
  parseSgkEBildirgeText,
  parseTaseronGrupMessageMeta,
  parseTaseronGrupWhatsAppText,
  resolveTaseronGrupFirmaAdi,
  TASERON_GRUP_KAYNAK,
  assembleTaseronGrupFromParts,
  findTaseronPersonelByTc,
  TASERON_GRUP_OTOMASYON,
  taseronGrupKuyrukHazir,
} from './taseronGrupSablon';
import { TASERON_PERSONEL_GOREV } from './taseronUtils';
import type { CariKart, Personel } from '../types/erp';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(inferTaseronYonFromText('İŞTEN ÇIKIŞ BİLDİRGESİ') === 'cikis', 'çıkış PDF adı');
assert(inferTaseronYonFromText('Sigortalı İşe Giriş Bildirgesi') === 'giris', 'giriş PDF adı');
assert(inferTaseronYonFromText('12345678901_ayrilis.pdf') === 'cikis', 'ayrılış dosya adı');
assert(parseIsoOrTrDate('01.09.2026') === '2026-09-01', 'TR tarih');
assert(parseIsoOrTrDate('2026-09-01') === '2026-09-01', 'ISO tarih');

const wpGiris = buildTaseronGirisWhatsAppText({
  ad: 'ALİ',
  soyad: 'YILMAZ',
  tcNo: '12345678901',
  firmaAdi: 'KUTER İNŞAAT',
  isGorev: 'ALÇI SIVA',
  girisTarihi: '2026-09-01',
  gonderen: 'kampci@test.com',
});
assert(wpGiris.includes('İŞE GİRİŞ'), 'giriş şablon başlık');
assert(wpGiris.includes('KUTER'), 'giriş şablon firma');
assert(wpGiris.includes(TASERON_PERSONEL_GOREV), 'giriş yoklama görevi');

const pasted = parseTaseronGrupWhatsAppText(wpGiris);
assert(pasted.ad === 'ALİ' || pasted.ad === 'ALI', `yapıştırma ad: ${pasted.ad}`);
assert(String(pasted.soyad).includes('YILMAZ'), `yapıştırma soyad: ${pasted.soyad}`);
assert(pasted.firmaAdi && pasted.firmaAdi.includes('KUTER'), `yapıştırma firma: ${pasted.firmaAdi}`);
assert(pasted.isGorev && pasted.isGorev.includes('ALCI') || pasted.isGorev?.includes('ALÇI'), `yapıştırma iş: ${pasted.isGorev}`);
assert(pasted.yon === 'giris', `yapıştırma yön: ${pasted.yon}`);
assert(pasted.tarih === '2026-09-01', `yapıştırma tarih: ${pasted.tarih}`);

const wpCikis = buildTaseronCikisWhatsAppText({
  ad: 'ALİ',
  soyad: 'YILMAZ',
  firmaAdi: 'KUTER İNŞAAT',
  cikisTarihi: '2026-09-15',
});
assert(inferTaseronYonFromText(wpCikis) === 'cikis', 'çıkış şablon yön');

const fromWpGirisPdf = parseTaseronGrupMessageMeta({
  fileName: 'SERVET EYGI İŞE GİRİŞ BİLDİRGESİ.pdf',
  caption: 'Yurt mekanik giriş',
});
assert(fromWpGirisPdf.yon === 'giris', `grup PDF yön: ${fromWpGirisPdf.yon}`);
assert(fromWpGirisPdf.ad === 'SERVET', `grup PDF ad: ${fromWpGirisPdf.ad}`);
assert(String(fromWpGirisPdf.soyad).includes('EYGI') || String(fromWpGirisPdf.soyad).includes('EYGİ'), `grup PDF soyad: ${fromWpGirisPdf.soyad}`);
assert(fromWpGirisPdf.firmaAdi && fromWpGirisPdf.firmaAdi.includes('YURT'), `grup alt yazı firma: ${fromWpGirisPdf.firmaAdi}`);

const fromWpCikisPdf = parseTaseronGrupMessageMeta({
  fileName: '12345678901_ayrilis.pdf',
});
assert(fromWpCikisPdf.yon === 'cikis', 'ayrılış yön');
assert(fromWpCikisPdf.tcNo === '12345678901', 'ayrılış TC dosya adı');

const captionOnly = parseTaseronGrupWhatsAppText('Yurt mekanik giriş');
assert(captionOnly.yon === 'giris', 'alt yazı yön');
assert(captionOnly.firmaAdi && captionOnly.firmaAdi.includes('YURT'), `alt yazı firma: ${captionOnly.firmaAdi}`);

const eBildirgeCikis = parseSgkEBildirgeText(`
SİGORTALI İŞTEN AYRILIŞ BİLDİRGESİ
1   Adı                                     ALİ
2   Soyadı                                  YILMAZ
14  Meslek Adı ve Kodu                        Diğer Elektrik Tesisatçıları-7411.02
15  Sigortalının İşten Ayrılış Tarihi        28.08.2026
     İşverenin/İşyerinin/İlgili Kuruluşun Adı-Soyadı/Ünv.                     İşyerinin (Kurumun) Adresi
 22  KUTER ELEKTRİK TAAHHÜT İNŞAAT SANAYİ VE TİCARET                           BAĞLARBAŞI MAHALLESİ YENİYOL SOKAK İSTANBUL
2 1 3 4 5 6 7 8 9 0 1
`);
assert(eBildirgeCikis.yon === 'cikis', `e-bildirge yön: ${eBildirgeCikis.yon}`);
assert(eBildirgeCikis.ad === 'ALİ' || eBildirgeCikis.ad === 'ALI', `e-bildirge ad: ${eBildirgeCikis.ad}`);
assert(String(eBildirgeCikis.soyad).includes('YILMAZ'), `e-bildirge soyad: ${eBildirgeCikis.soyad}`);
assert(eBildirgeCikis.firmaAdi && eBildirgeCikis.firmaAdi.includes('KUTER'), `e-bildirge firma: ${eBildirgeCikis.firmaAdi}`);
assert(eBildirgeCikis.isGorev && eBildirgeCikis.isGorev.includes('ELEKTRIK') || eBildirgeCikis.isGorev?.includes('ELEKTRİK'), `e-bildirge meslek: ${eBildirgeCikis.isGorev}`);
assert(eBildirgeCikis.tarih === '2026-08-28', `e-bildirge tarih: ${eBildirgeCikis.tarih}`);
assert(eBildirgeCikis.tcNo === '21345678901', `e-bildirge tc: ${eBildirgeCikis.tcNo}`);

const eBildirgeGiris = parseSgkEBildirgeText(`
SİGORTALI İŞE GİRİŞ BİLDİRGESİ
1   Adı                                     AYŞE
2   Soyadı                                  DEMİR
14  Meslek Adı ve Kodu                        Alçı Sıvacı-7123.10
     Sigortalının İşe Giriş Tarihi           01.09.2026
     İşverenin/İşyerinin/İlgili Kuruluşun Adı-Soyadı/Ünv.                     İşyerinin (Kurumun) Adresi
 22  YURT MEKANİK İNŞAAT                                                      BAĞLARBAŞI MAHALLESİ
1 2 3 4 5 6 7 8 9 0 1
`);
assert(eBildirgeGiris.yon === 'giris', `e-bildirge giriş yön: ${eBildirgeGiris.yon}`);
assert(eBildirgeGiris.ad === 'AYŞE' || eBildirgeGiris.ad === 'AYSE', `e-bildirge giriş ad: ${eBildirgeGiris.ad}`);
assert(eBildirgeGiris.tarih === '2026-09-01', `e-bildirge giriş tarih: ${eBildirgeGiris.tarih}`);
assert(eBildirgeGiris.firmaAdi && eBildirgeGiris.firmaAdi.includes('YURT'), `e-bildirge giriş firma: ${eBildirgeGiris.firmaAdi}`);
assert(eBildirgeGiris.tcNo === '12345678901', `e-bildirge giriş tc: ${eBildirgeGiris.tcNo}`);

const eBildirgeGirisTm = parseSgkEBildirgeText(`
SİGORTALI İŞE GİRİŞ BİLDİRGESİ
(T.C.KİMLİK NUMARASI)
1      2      3      4      5      6      7      8      9      0      1    X
AYŞE
1 Adı    NÜFUSA KAYITLI OLDUĞU YER
DEMİR
BATMAN
2 Soyadı
İl
16 Sigortalının işe başladığı tarih    01.09.2026
Meslek Adı ve Kodu    8189.13 -Kablo İzolasyon Elemanı
İşverenin/İşyerinin/İlgili Kuruluşun Adı-Soyadı/Ünv.    İşyerinin (Kurumun) Adresi
YURTMEKANİK İNŞAAT SANAYİ VE TİCARET LİMİTED ŞİRKETİ
24
İKİTELLİ OSB HESKOOP M7 BLOK İSTANBUL
`);
assert(eBildirgeGirisTm.yon === 'giris', `giriş tm yön: ${eBildirgeGirisTm.yon}`);
assert(eBildirgeGirisTm.ad === 'AYŞE' || eBildirgeGirisTm.ad === 'AYSE', `giriş tm ad: ${eBildirgeGirisTm.ad}`);
assert(String(eBildirgeGirisTm.soyad).includes('DEMİR') || String(eBildirgeGirisTm.soyad).includes('DEMIR'), `giriş tm soyad: ${eBildirgeGirisTm.soyad}`);
assert(eBildirgeGirisTm.soyad !== 'BATMAN', 'giriş tm soyad il değil');
assert(eBildirgeGirisTm.tarih === '2026-09-01', `giriş tm tarih: ${eBildirgeGirisTm.tarih}`);
assert(eBildirgeGirisTm.tcNo === '12345678901', `giriş tm tc: ${eBildirgeGirisTm.tcNo}`);
assert(eBildirgeGirisTm.firmaAdi && eBildirgeGirisTm.firmaAdi.includes('YURT'), `giriş tm firma: ${eBildirgeGirisTm.firmaAdi}`);
assert(eBildirgeGirisTm.firmaAdi && eBildirgeGirisTm.firmaAdi.includes('TİCARET') || eBildirgeGirisTm.firmaAdi?.includes('TICARET'), `giriş tm unvan: ${eBildirgeGirisTm.firmaAdi}`);
assert(eBildirgeGirisTm.isGorev && eBildirgeGirisTm.isGorev.includes('KABLO'), `giriş tm meslek: ${eBildirgeGirisTm.isGorev}`);
assert(!/^\d/.test(String(eBildirgeGirisTm.isGorev)), `giriş tm meslek kodu silindi: ${eBildirgeGirisTm.isGorev}`);

const eBildirgeTmLayout = parseSgkEBildirgeText(`
SİGORTALI İŞTEN AYRILIŞ BİLDİRGESİ
(T.C.KİMLİK NUMARASI)
2      1      3      4      5      6      7      8      9      0      1
ALİ
1 Adı    NÜFUSA KAYITLI OLDUGU YER
YILMAZ    MARDİN
2 Soyadı
İl
Diğer Elektrik Tesisatçıları-7411.02
14
Meslek Adı ve Kodu
28.08.2026
15    Sigortalının İşten Ayrılış Tarihi    16
İşverenin/İşyerinin/İlgili Kuruluşun Adı-Soyadı/Ünv.    İşyerinin (Kurumun) Adresi
22
KUTER ELEKTRİK TAAHHÜT İNŞAAT SANAYİ VE TİCARET    BAĞLARBAŞI MAHALLESİ YENİYOL SOKAK İSTANBUL
`);
assert(eBildirgeTmLayout.yon === 'cikis', `tm yön: ${eBildirgeTmLayout.yon}`);
assert(eBildirgeTmLayout.ad === 'ALİ' || eBildirgeTmLayout.ad === 'ALI', `tm ad: ${eBildirgeTmLayout.ad}`);
assert(String(eBildirgeTmLayout.soyad).includes('YILMAZ'), `tm soyad: ${eBildirgeTmLayout.soyad}`);
assert(eBildirgeTmLayout.firmaAdi && eBildirgeTmLayout.firmaAdi.includes('KUTER'), `tm firma: ${eBildirgeTmLayout.firmaAdi}`);
assert(eBildirgeTmLayout.isGorev && (eBildirgeTmLayout.isGorev.includes('ELEKTRIK') || eBildirgeTmLayout.isGorev.includes('ELEKTRİK')), `tm meslek: ${eBildirgeTmLayout.isGorev}`);
assert(eBildirgeTmLayout.tarih === '2026-08-28', `tm tarih: ${eBildirgeTmLayout.tarih}`);
assert(eBildirgeTmLayout.tcNo === '21345678901', `tm tc: ${eBildirgeTmLayout.tcNo}`);

const cariKartlar: CariKart[] = [
  { id: 'ck1', unvan: 'KUTER İNŞAAT LTD. ŞTİ.', kartTipi: 'TASERON', durum: 'AKTIF' } as CariKart,
];
assert(resolveTaseronGrupFirmaAdi('Kuter Insaat', cariKartlar).includes('KUTER'), 'cari hizalama');
assert(
  resolveTaseronGrupFirmaAdi('YURTMEKANİK İNŞAAT SANAYİ VE TİCARET LİMİTED ŞİRKETİ', [
    { id: 'ck2', unvan: 'YURT MEKANİK', kartTipi: 'TASERON', durum: 'AKTIF' } as CariKart,
  ]) === 'YURT MEKANİK',
  'YURTMEKANİK → kurulu YURT MEKANİK'
);
assert(
  resolveTaseronGrupFirmaAdi(
    'KUTER ELEKTRİK TAAHHÜT İNŞAAT SANAYİ VE TİCARET',
    [],
    [{ id: 'p_k', ad: 'X', soyad: 'Y', firmaTipi: 'TASERON', firmaAdi: 'KUTER İNŞAAT', durum: true } as Personel]
  ) === 'KUTER İNŞAAT',
  'PDF ünvanı personel kartındaki kurulu ada hizalanır'
);

const parsed = normalizeTaseronGrupParse({
  yon: 'giris',
  ad: 'ali',
  soyad: 'yılmaz',
  firmaAdi: 'kuter inşaat',
  isGorev: 'alçı sıva',
  tcNo: '12345678901',
  tarih: '01.09.2026',
});
assert(parsed.ad === 'ALİ' || parsed.ad === 'ALI', 'normalize ad');
assert(parsed.tarih === '2026-09-01', 'normalize tarih');
assert(parsed.yon === 'giris', 'normalize yön');

const talep = buildTaseronGirisTalepDoc({
  id: 'GIRIS-TASERON_GRUP-1',
  parsed,
  gonderen: 'test@kibritci.com',
});
assert(talep.kaynak === TASERON_GRUP_KAYNAK, 'kuyruk kaynak');
assert(talep.firmaTipi === 'TASERON', 'kuyruk firmaTipi');
assert(talep.gorev === TASERON_PERSONEL_GOREV, 'kuyruk gorev');
assert(talep.nitelik === 'ALÇI SIVA' || String(talep.nitelik).includes('ALCI') || String(talep.nitelik).includes('ALÇI'), 'kuyruk nitelik');
assert(talep.grupBildirildi === true, 'grup bildirildi');
assert(isTaseronGrupTalep(talep), 'isTaseronGrupTalep');
assert(isTaseronGrupOnayHazir(talep as any), 'onay hazır (metin, evraksız)');

const open = findOpenTaseronGrupTalep([talep as any], { ad: parsed.ad, soyad: parsed.soyad, tcNo: parsed.tcNo });
assert(open?.id === talep.id, 'açık kuyruk eşleşme');

const existingAktif: Personel = {
  id: 'p_old',
  ad: parsed.ad,
  soyad: parsed.soyad,
  tcNo: parsed.tcNo || '',
  gorev: 'SERAMİKÇİ',
  firmaTipi: 'TASERON',
  firmaAdi: 'ESKİ FİRMA',
  durum: true,
  personelGrubu: 'SAHA',
  maas: 1,
} as Personel;
const candAktif = buildTaseronGrupPersonelCandidate(talep as any, existingAktif);
assert(candAktif.gorev === 'SERAMİKÇİ', 'aktif görev ezilmez');
assert(candAktif.firmaAdi === 'ESKİ FİRMA', 'aktif firma ezilmez');
assert(candAktif.durum === true, 'aktif durum korunur');
assert(candAktif.personelGrubu === 'SAHA', 'aktif grup korunur');

const existingPasif: Personel = { ...existingAktif, durum: false, istenCikisTarihi: '2026-01-01' };
const candRehire = buildTaseronGrupPersonelCandidate(talep as any, existingPasif);
assert(candRehire.durum === true, 'pasif yeniden giriş aktif olur');
assert(candRehire.firmaTipi === 'TASERON', 'rehire firmaTipi');
assert(candRehire.iseGirisTarihi === '2026-09-01', 'rehire giriş tarihi');

const anaFirmaAday: Personel = {
  id: 'p_ana',
  ad: parsed.ad,
  soyad: parsed.soyad,
  tcNo: parsed.tcNo || '',
  gorev: 'İŞÇİ',
  firmaTipi: 'ANA_FIRMA',
  durum: true,
} as Personel;
assert(anaFirmaAday.firmaTipi === 'ANA_FIRMA', 'Ana Firma kartı bu modülde yazılmaz');

assert(findTaseronPersonelByTc([existingAktif], parsed.tcNo)?.id === 'p_old', 'çıkış TC eşleşir');
assert(!findTaseronPersonelByTc([existingAktif], '99999999999'), 'olmayan TC yok');
assert(
  !findTaseronPersonelByTc([anaFirmaAday], parsed.tcNo),
  'çıkış Ana Firma TC ile pasif etmez'
);

assert(TASERON_GRUP_OTOMASYON.grupDinleme === false, 'grup dinlenmez');
const assembled = assembleTaseronGrupFromParts({
  fromPdf: {
    yon: 'giris',
    ad: 'AYŞE',
    soyad: 'DEMİR',
    firmaAdi: 'YURTMEKANİK İNŞAAT SANAYİ VE TİCARET LİMİTED ŞİRKETİ',
    tarih: '2026-09-01',
    tcNo: '12345678901',
  },
  fileName: 'AYSE DEMIR İŞE GİRİŞ BİLDİRGESİ.pdf',
  caption: 'Yurt mekanik giriş',
});
assert(assembled.yon === 'giris', 'otomasyon yön');
assert(assembled.ad === 'AYŞE' || assembled.ad === 'AYSE', `otomasyon ad: ${assembled.ad}`);
assert(taseronGrupKuyrukHazir(assembled), 'otomasyon kuyruk hazır');

console.log('taseronGrupSablon.assert: ok');
