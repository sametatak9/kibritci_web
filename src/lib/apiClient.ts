/**
 * API yanıtlarını güvenli JSON olarak okur.
 * Vite/HTML fallback veya Vercel yapılandırma hatalarında anlaşılır hata verir.
 */
export async function fetchApiJson<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error(
      'Sunucuya bağlanılamadı. Yerelde "npm run dev" (port 3000) veya Vercel\'de GEMINI_API_KEY ortam değişkenini kontrol edin.'
    );
  }

  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  if (!contentType.includes('application/json')) {
    const snippet = text.slice(0, 120).replace(/\s+/g, ' ').trim();
    if (snippet.startsWith('<!') || snippet.toLowerCase().includes('html') || snippet.startsWith('The page')) {
      throw new Error(
        `AI API yanıt vermedi (HTML döndü). Vercel'de /api rotalarının aktif olduğundan ve GEMINI_API_KEY tanımlı olduğundan emin olun. (${snippet.slice(0, 60)}...)`
      );
    }
    throw new Error(`Beklenmeyen sunucu yanıtı: ${snippet || res.statusText}`);
  }

  let json: T & { error?: string; success?: boolean };
  try {
    json = JSON.parse(text) as T & { error?: string; success?: boolean };
  } catch {
    throw new Error(`Sunucu geçersiz JSON döndürdü: ${text.slice(0, 120)}`);
  }

  if (!res.ok) {
    const errMsg = (json as { error?: string }).error || `Sunucu hatası (${res.status})`;
    if (res.status === 504) {
      throw new Error(
        `504 Gateway Timeout — AI işlemi Vercel süre limitini aştı. ${errMsg}`
      );
    }
    throw new Error(errMsg);
  }

  return json as T;
}
