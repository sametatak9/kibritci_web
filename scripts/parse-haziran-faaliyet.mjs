/**
 * Haziran 2026 el yazısı günlük saha faaliyet PDF → JSON (sayfa grupları)
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) { console.error('GEMINI_API_KEY yok'); process.exit(1); }

const pdfPath = process.argv[2] || path.join(process.cwd(), 'scripts', 'haziran2026-faaliyet.pdf');
const BATCHES = [[1, 5], [6, 10], [11, 15], [16, 20], [21, 25], [26, 30]];

const faaliyetItem = {
  type: Type.OBJECT,
  properties: {
    parsel: { type: Type.STRING },
    blok: { type: Type.STRING },
    isNiteligi: { type: Type.STRING },
    ustaSayisi: { type: Type.NUMBER },
    isciSayisi: { type: Type.NUMBER },
    hamMetin: { type: Type.STRING },
  },
  required: ['isNiteligi'],
};

const daySchema = {
  type: Type.OBJECT,
  properties: {
    sayfaNo: { type: Type.NUMBER },
    tarih: { type: Type.STRING },
    faaliyetler: { type: Type.ARRAY, items: faaliyetItem },
  },
  required: ['tarih', 'faaliyetler'],
};

function promptForRange(from, to) {
  return `
157-46 DOĞRAMA parseli Haziran 2026 el yazısı günlük saha faaliyet raporu.
SADECE PDF SAYFA ${from}-${to} oku (sayfa N = N Haziran 2026).

Her gün için faaliyetler dizisi:
- parsel: 157/46 (varsayılan), 157/51 veya 160/2
- blok: A1, B1, C1, D1, E1, F1, GENEL SAHA...
- isNiteligi: iş açıklaması BÜYÜK HARF
- ustaSayisi, isciSayisi: parantez içinden say
- hamMetin: okunan satır

Çıktı: { "gunler": [...] }
`;
}

async function parseBatch(ai, base64, from, to, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: attempt > 2 ? 'gemini-2.0-flash' : 'gemini-2.5-flash',
        contents: [promptForRange(from, to), { inlineData: { mimeType: 'application/pdf', data: base64 } }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: { gunler: { type: Type.ARRAY, items: daySchema } },
            required: ['gunler'],
          },
          temperature: 0.05,
          maxOutputTokens: 8192,
        },
      });
      const text = response.text?.trim();
      if (!text) throw new Error('boş yanıt');
      return JSON.parse(text).gunler || [];
    } catch (e) {
      console.warn(`Faaliyet ${from}-${to} deneme ${attempt}:`, e.message?.slice(0, 100));
      if (attempt === retries) throw e;
      await new Promise(r => setTimeout(r, 8000 * attempt));
    }
  }
  return [];
}

async function main() {
  if (!fs.existsSync(pdfPath)) { console.error('PDF yok:', pdfPath); process.exit(1); }
  const base64 = fs.readFileSync(pdfPath).toString('base64');
  console.log(`Faaliyet PDF: ${pdfPath}`);

  const ai = new GoogleGenAI({ apiKey });
  const allDays = [];

  for (const [from, to] of BATCHES) {
    console.log(`\n→ Faaliyet sayfa ${from}-${to}...`);
    const days = await parseBatch(ai, base64, from, to);
    const cnt = days.reduce((s, g) => s + (g.faaliyetler?.length || 0), 0);
    console.log(`  ${days.length} gün, ${cnt} faaliyet`);
    allDays.push(...days);
    await new Promise(r => setTimeout(r, 2000));
  }

  const outDir = path.join(process.cwd(), 'scripts', 'haziran2026-output');
  fs.mkdirSync(outDir, { recursive: true });
  const out = {
    kaynak: path.basename(pdfPath),
    parsedAt: new Date().toISOString(),
    gunler: allDays.sort((a, b) => (a.sayfaNo || 0) - (b.sayfaNo || 0)),
  };
  fs.writeFileSync(path.join(outDir, 'haziran2026-faaliyet-draft.json'), JSON.stringify(out, null, 2), 'utf8');
  const total = out.gunler.reduce((s, g) => s + (g.faaliyetler?.length || 0), 0);
  console.log(`\nKaydedildi: ${total} faaliyet, ${out.gunler.length} gün`);
}

main().catch(e => { console.error(e); process.exit(1); });
