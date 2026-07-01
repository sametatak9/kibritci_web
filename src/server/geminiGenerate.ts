import type { GenerateContentConfig, Content } from '@google/genai';
import { getGeminiClient, parseGeminiError } from './gemini';

const IS_VERCEL = Boolean(process.env.VERCEL);

/** Ücretsiz kotada 2.5-flash en hızlı doluyor — önce alternatif modeller */
export const GEMINI_MODEL_FALLBACK = IS_VERCEL
  ? ['gemini-2.0-flash', 'gemini-2.5-flash']
  : ['gemini-2.5-flash', 'gemini-2.0-flash'];

const MODELS = GEMINI_MODEL_FALLBACK;

const MAX_RETRIES_PER_MODEL = IS_VERCEL ? 1 : 2;
const RETRY_DELAY_MS = IS_VERCEL ? 350 : 1200;
const ATTEMPT_TIMEOUT_MS = IS_VERCEL ? 9_000 : 45_000;

function isTemporaryGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;
  return (
    status === 503 ||
    status === 429 ||
    /503|429|UNAVAILABLE|high demand|Resource exhausted/i.test(msg)
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            `${label} ${Math.round(ms / 1000)} sn içinde tamamlanamadı. Vercel Hobby planda limit ~10 sn; Pro plan veya daha küçük dosya deneyin.`
          )
        ),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function generateGeminiWithFallback(options: {
  contents: Content[] | string;
  config?: GenerateContentConfig;
  label?: string;
}): Promise<{ text: string; model: string }> {
  const ai = getGeminiClient();
  const label = options.label || 'Gemini isteği';
  let lastError: unknown = null;

  for (const model of MODELS) {
    for (let attempt = 0; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      }
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model,
            contents: options.contents,
            config: options.config,
          }),
          ATTEMPT_TIMEOUT_MS,
          label
        );
        const text = response.text?.trim();
        if (text) {
          return { text, model };
        }
        throw new Error('Gemini boş yanıt döndürdü');
      } catch (err) {
        lastError = err;
        const canRetry = attempt < MAX_RETRIES_PER_MODEL && isTemporaryGeminiError(err);
        if (!canRetry && !isTemporaryGeminiError(err)) {
          break;
        }
      }
    }
  }

  if (lastError instanceof Error) {
    throw new Error(parseGeminiError(lastError));
  }
  throw new Error(parseGeminiError(lastError));
}
