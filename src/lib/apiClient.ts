/**
 * API yanıtlarını güvenli JSON olarak okur.
 * Vite/HTML fallback ("The page could not be found") durumunda anlaşılır hata verir.
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
      'Sunucuya bağlanılamadı. Lütfen terminalde "npm run dev" komutu ile uygulamayı başlatın (http://localhost:3000).'
    );
  }

  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  if (!contentType.includes('application/json')) {
    const snippet = text.slice(0, 80).replace(/\s+/g, ' ').trim();
    if (snippet.startsWith('<!') || snippet.toLowerCase().includes('html') || snippet.startsWith('The page')) {
      throw new Error(
        `API yanıt vermedi (HTML sayfa döndü). Uygulamayı "npm run dev" ile port 3000\'de çalıştırın. (${snippet}...)`
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
    throw new Error((json as { error?: string }).error || `Sunucu hatası (${res.status})`);
  }

  return json as T;
}
