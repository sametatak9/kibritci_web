import { GoogleGenAI } from '@google/genai';

export type GeminiKeyFormat = 'auth' | 'standard' | 'unknown' | 'missing';

let aiClient: GoogleGenAI | null = null;

/** Ortam değişkeninden anahtarı okur — tırnak/boşluk temizler */
export function resolveGeminiApiKey(): string | undefined {
  const raw = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!raw) return undefined;
  return raw.trim().replace(/^['"]|['"]$/g, '');
}

export function detectGeminiKeyFormat(key?: string): GeminiKeyFormat {
  if (!key) return 'missing';
  if (key.startsWith('AQ.')) return 'auth';
  if (key.startsWith('AIza')) return 'standard';
  return 'unknown';
}

export function getGeminiKeyInfo(): { format: GeminiKeyFormat; preview: string; length: number } {
  const key = resolveGeminiApiKey();
  const format = detectGeminiKeyFormat(key);
  if (!key) return { format: 'missing', preview: '(tanımsız)', length: 0 };
  const visible = key.length <= 12 ? '***' : `${key.slice(0, 6)}…${key.slice(-4)}`;
  return { format, preview: visible, length: key.length };
}

export function formatGeminiKeyHint(format: GeminiKeyFormat): string {
  switch (format) {
    case 'auth':
      return 'Auth key (AQ.…) — Google AI Studio\'nun yeni formatı, geçerlidir.';
    case 'standard':
      return 'Standard key (AIza…) — Kısıtlamasız eski anahtarlar 19 Haziran 2026\'dan itibaren reddedilir. Auth key (AQ.) kullanın.';
    case 'unknown':
      return 'Anahtar formatı tanınmadı. https://aistudio.google.com/apikey adresinden yeni key oluşturun.';
    default:
      return 'GEMINI_API_KEY ortam değişkeni tanımlı değil.';
  }
}

export function parseGeminiError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (/API key not valid|invalid.?api.?key|401|403|PERMISSION_DENIED/i.test(msg)) {
    return [
      'Gemini API anahtarı reddedildi.',
      '• AI Studio\'dan yeni Auth key (AQ.…) oluşturun: https://aistudio.google.com/apikey',
      '• Vercel: Settings → Environment Variables → GEMINI_API_KEY (tırnaksız, boşluksuz)',
      '• Değişiklikten sonra redeploy yapın',
      '• Eski AIza anahtarı kısıtlamasızsa artık çalışmaz — Auth key kullanın',
    ].join('\n');
  }
  if (/GEMINI_API_KEY|GOOGLE_API_KEY/i.test(msg)) {
    return msg;
  }
  return msg;
}

export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = resolveGeminiApiKey();
    if (!key) {
      throw new Error(
        'GEMINI_API_KEY tanımlı değil. Yerelde .env.local dosyasına, Vercel\'de Project Settings → Environment Variables bölümüne ekleyin.'
      );
    }

    const format = detectGeminiKeyFormat(key);
    if (format === 'unknown') {
      throw new Error(
        `GEMINI_API_KEY formatı tanınmıyor (${key.slice(0, 8)}…). AI Studio'dan yeni key alın: https://aistudio.google.com/apikey`
      );
    }

    // Auth (AQ.) ve Standard (AIza) anahtarları desteklenir
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

/** Bağlantı testi — health endpoint ve npm run test:gemini için */
export async function testGeminiConnection(): Promise<{
  ok: boolean;
  keyInfo: ReturnType<typeof getGeminiKeyInfo>;
  modelResponse?: string;
  error?: string;
}> {
  const keyInfo = getGeminiKeyInfo();
  if (keyInfo.format === 'missing') {
    return { ok: false, keyInfo, error: formatGeminiKeyHint('missing') };
  }

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Reply with exactly: OK',
      config: { maxOutputTokens: 16, temperature: 0 },
    });
    return { ok: true, keyInfo, modelResponse: response.text?.trim() };
  } catch (err) {
    return { ok: false, keyInfo, error: parseGeminiError(err) };
  }
}
