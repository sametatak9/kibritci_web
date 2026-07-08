/**
 * Haziran 2026 el yazısı günlük yoklama PDF → JSON (sayfa grupları)
 * node scripts/parse-haziran-handwriting.mjs [pdf-yolu]
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) { console.error('GEMINI_API_KEY yok'); process.exit(1); }

const pdfPath = process.argv[2] || path.join(process.cwd(), 'scripts', 'haziran2026-yoklama.pdf');
const BATCHES = [[1, 10], [11, 20], [21, 30]];

const daySchema = {
  type: Type.OBJECT,
  properties: {
    sayfaNo: { type: Type.NUMBER },
    tarih: { type: Type.STRING },
    yoklamaKayitlari: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          adSoyad: { type: Type.STRING },
          gorev: { type: Type.STRING },
          durum: { type: Type.STRING },
          mesaiSaati: { type: Type.NUMBER },
          not: { type: Type.STRING },
        },
        required: ['adSoyad', 'durum'],
      },
    },
  },
  required: ['tarih', 'yoklamaKayitlari'],
};

function promptForRange(from, to) {
  return `
Türkiye inşaat şantiyesi puantaj uzmanısın. DOĞRAMA 157-46 parsel Haziran 2026 el yazısı yoklama PDF'i.
SADECE SAYFA ${from}-${to} arasını oku (sayfa N = N Haziran 2026).

Her sayfa için gunler dizisine ekle:
- sayfaNo: ${from}..${to}
- tarih: 2026-06-XX
- yoklamaKayitlari: isim listesi (adSoyad, gorev, durum="Geldi", mesaiSaati sayı veya 0)

Mesai rakamlarını ismin yanından oku. Türkçe karakterleri koru.
Çıktı: { "gunler": [...] }
`;
}

async function parseBatch(ai, base64, from, to, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          promptForRange(from, to),
          { inlineData: { mimeType: 'application/pdf', data: base64 } },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: { gunler: { type: Type.ARRAY, items: daySchema } },
            required: ['gunler'],
          },
          temperature: 0.05,
        },
      });
      const parsed = JSON.parse(response.text || '{}');
      return parsed.gunler || [];
    } catch (e) {
      console.warn(`Sayfa ${from}-${to} deneme ${attempt}/${retries}:`, e.message?.slice(0, 80));
      if (attempt === retries) throw e;
      await new Promise(r => setTimeout(r, 5000 * attempt));
    }
  }
  return [];
}

async function main() {
  if (!fs.existsSync(pdfPath)) { console.error('PDF yok:', pdfPath); process.exit(1); }
  const base64 = fs.readFileSync(pdfPath).toString('base64');
  console.log(`PDF: ${pdfPath} (${(base64.length * 0.75 / 1024 / 1024).toFixed(2)} MB)`);

  const ai = new GoogleGenAI({ apiKey });
  const allDays = [];

  for (const [from, to] of BATCHES) {
    console.log(`\n→ Sayfa ${from}-${to}...`);
    const days = await parseBatch(ai, base64, from, to);
    console.log(`  ${days.length} gün okundu`);
    days.forEach(g => console.log(`    s${g.sayfaNo} ${g.tarih} — ${g.yoklamaKayitlari?.length || 0} kişi`));
    allDays.push(...days);
    await new Promise(r => setTimeout(r, 2000));
  }

  const outDir = path.join(process.cwd(), 'scripts', 'haziran2026-output');
  fs.mkdirSync(outDir, { recursive: true });
  const normalized = {
    kaynak: path.basename(pdfPath),
    parsedAt: new Date().toISOString(),
    gunler: allDays.sort((a, b) => (a.sayfaNo || 0) - (b.sayfaNo || 0)),
  };
  const outFile = path.join(outDir, 'haziran2026-draft.json');
  fs.writeFileSync(outFile, JSON.stringify(normalized, null, 2), 'utf8');
  console.log(`\nKaydedildi: ${outFile} (${normalized.gunler.length} gün)`);
}

main().catch(e => { console.error(e); process.exit(1); });
