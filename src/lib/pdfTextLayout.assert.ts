/**
 * PDF Tm/Tj yerleşim çıkarıcı iddiaları.
 * Çalıştır: npx tsx src/lib/pdfTextLayout.assert.ts
 */
import { extractPdfTextLayout, layoutTextFromContentStream } from './pdfTextLayout';
import { parseSgkEBildirgeText } from './taseronGrupSablon';
import { deflateSync } from 'node:zlib';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const stream = [
  'BT',
  '1 0 0 1 100 800 Tm',
  '(S\xDDGORTALI \xDD\xDETEN AYRILI\xDE B\xDDLD\xDDRGES\xDD)Tj',
  '1 0 0 1 40 780 Tm',
  '(1)Tj',
  '1 0 0 1 55 780 Tm',
  '(Ad\xFD)Tj',
  '1 0 0 1 200 780 Tm',
  '(AL\xDD)Tj',
  '1 0 0 1 40 760 Tm',
  '(2)Tj',
  '1 0 0 1 55 760 Tm',
  '(Soyad\xFD)Tj',
  '1 0 0 1 200 760 Tm',
  '(YILMAZ)Tj',
  'ET',
].join('\n');

const laid = layoutTextFromContentStream(stream);
assert(/SİGORTALI İŞTEN AYRILIŞ BİLDİRGESİ/.test(laid) || /SIGORTALI/.test(laid) || /SİGORTALI/.test(laid), `başlık: ${laid.slice(0, 80)}`);
assert(laid.includes('ALİ') || laid.includes('ALI'), `ad satırı: ${laid}`);
assert(laid.includes('YILMAZ'), 'soyad');

const parsed = parseSgkEBildirgeText(laid);
assert(parsed.yon === 'cikis', `yon: ${parsed.yon}`);
assert(parsed.ad === 'ALİ' || parsed.ad === 'ALI', `parsed ad: ${parsed.ad}`);
assert(String(parsed.soyad).includes('YILMAZ'), `parsed soyad: ${parsed.soyad}`);

const deflated = deflateSync(Buffer.from(stream, 'latin1'));
const fakePdf = Buffer.concat([
  Buffer.from('%PDF-1.4\n1 0 obj\n<< /Length ' + deflated.length + ' /Filter /FlateDecode >>\nstream\n', 'latin1'),
  deflated,
  Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1'),
]);
const fromPdf = extractPdfTextLayout(fakePdf);
assert(fromPdf.includes('YILMAZ'), `inflate extract: ${fromPdf.slice(0, 120)}`);

console.log('pdfTextLayout.assert: ok');
