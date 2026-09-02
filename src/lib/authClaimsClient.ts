import { auth } from './firebase';

export interface SyncedClaims {
  role: string;
  durum: string;
  email: string;
}

/** Sunucudan Firestore kullanicilar kaydına göre custom claims yazar ve token yeniler */
export async function syncAuthClaimsFromServer(targetEmail?: string): Promise<SyncedClaims | null> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return null;

  try {
    const idToken = await user.getIdToken();
    const res = await fetchWithTimeout('/api/auth/sync-claims', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(targetEmail ? { email: targetEmail.trim().toLowerCase() } : {}),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[authClaims] sync başarısız:', res.status, errText);
      return null;
    }

    const data = (await res.json()) as { claims: SyncedClaims };
    await user.getIdToken(true);
    return data.claims;
  } catch (err) {
    console.warn('[authClaims] sync başarısız:', err);
    return null;
  }
}

/** Yönetici: yeni kullanıcı için Auth hesabı oluşturur ve claim yazar */
export async function provisionAuthUser(
  email: string,
  password: string
): Promise<SyncedClaims | null> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return null;

  const idToken = await user.getIdToken();
  const res = await fetch('/api/auth/provision-user', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.warn('[authClaims] provision başarısız:', res.status, errText);
    return null;
  }

  const data = (await res.json()) as { claims: SyncedClaims };
  return data.claims;
}

const AUTH_ADMIN_TIMEOUT_MS = 25000;

async function fetchWithTimeout(url: string, init: RequestInit, ms = AUTH_ADMIN_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new Error(
        'İşlem zaman aşımına uğradı (25 sn). Sunucu yanıt vermedi — birkaç saniye sonra tekrar deneyin.'
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Kurucu / yönetici: bir kullanıcının şifresini Auth üzerinde günceller; Auth yoksa oluşturur */
export async function adminUpdateUserPassword(
  email: string,
  password: string
): Promise<{ created: boolean }> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error('Oturum yok. Kurucu hesabıyla yeniden giriş yapıp tekrar deneyin.');
  }

  const idToken = await user.getIdToken();
  const res = await fetchWithTimeout('/api/auth/admin/update-user', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    const raw = String(data.error || '');
    if (res.status === 503 || raw.toLowerCase().includes('yapılandır')) {
      throw new Error(
        "Şifre güncellemesi için sunucu yapılandırması eksik (FIREBASE_SERVICE_ACCOUNT_JSON). Vercel ortam değişkenini kontrol edin."
      );
    }
    if (raw.includes('user-not-found') || raw.includes('no user record')) {
      throw new Error(
        "Firebase giriş hesabı bulunamadı ve oluşturulamadı. Vercel'de FIREBASE_SERVICE_ACCOUNT_JSON tanımlı mı kontrol edin."
      );
    }
    throw new Error(raw || `Şifre güncellenemedi (HTTP ${res.status}).`);
  }

  const data = (await res.json()) as { created?: boolean };
  return { created: Boolean(data.created) };
}
