import dotenv from 'dotenv';
import path from 'path';
import { testGeminiConnection, formatGeminiKeyHint } from '../src/server/gemini';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  console.log('=== Gemini API Bağlantı Testi ===\n');
  const result = await testGeminiConnection();

  console.log('Anahtar formatı:', result.keyInfo.format);
  console.log('Önizleme:', result.keyInfo.preview);
  console.log('Uzunluk:', result.keyInfo.length);
  console.log('Not:', formatGeminiKeyHint(result.keyInfo.format));
  console.log('');

  if (result.ok) {
    console.log('✓ BAŞARILI — Model yanıtı:', result.modelResponse);
    process.exit(0);
  }

  console.error('✗ BAŞARISIZ\n', result.error);
  process.exit(1);
}

main();
