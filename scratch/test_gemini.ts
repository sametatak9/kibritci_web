import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { getAllGeminiApiKeys, detectGeminiKeyFormat, formatGeminiKeyHint } from '../src/server/gemini';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  console.log('=== Gemini Çoklu API Anahtarı Doğrulama Testi ===\n');

  const keys = getAllGeminiApiKeys();
  console.log(`Tespit Edilen Toplam Anahtar Sayısı: ${keys.length}\n`);

  if (keys.length === 0) {
    console.error('✗ Hiçbir GEMINI_API_KEY bulunamadı! .env.local veya .env dosyanızı kontrol edin.');
    return;
  }

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const format = detectGeminiKeyFormat(key);
    const preview = key.length <= 12 ? '***' : `${key.slice(0, 6)}…${key.slice(-4)}`;

    console.log(`--- Anahtar #${i + 1} ---`);
    console.log(`Format : ${format} (${formatGeminiKeyHint(format)})`);
    console.log(`Önizleme: ${preview}`);
    console.log(`Uzunluk : ${key.length} karakter`);

    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: 'Reply with: TEST_OK',
        config: { maxOutputTokens: 32, temperature: 0 },
      });

      const text = response.text?.trim();
      if (text) {
        console.log(`Sonuç   : ✓ BAŞARILI — Yanıt: "${text}"\n`);
      } else {
        console.log(`Sonuç   : ⚠️ Boş yanıt döndü\n`);
      }
    } catch (err: any) {
      console.error(`Sonuç   : ✗ BAŞARISIZ — Hata: ${err?.message || err}\n`);
    }
  }
}

main();
