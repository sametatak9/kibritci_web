import { getFirebaseAdmin } from './firebaseAdmin';
import { AuthCustomClaims, buildAuthCustomClaims, normalizeClaimRole } from '../lib/roleClaims';

export async function readKullaniciClaimsSource(email: string): Promise<AuthCustomClaims | null> {
  const admin = getFirebaseAdmin();
  const emailKey = email.trim().toLowerCase();
  const snap = await admin.firestore().collection('kullanicilar').doc(emailKey).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return buildAuthCustomClaims({
    email: emailKey,
    yetki: String(data.yetki || data.role || 'MİSAFİR'),
    durum: String(data.durum || 'ONAY BEKLİYOR'),
  });
}

export async function ensureAuthUser(email: string, password?: string): Promise<string> {
  const admin = getFirebaseAdmin();
  const emailKey = email.trim().toLowerCase();
  try {
    const existing = await admin.auth().getUserByEmail(emailKey);
    return existing.uid;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== 'auth/user-not-found') throw err;
    if (!password) {
      throw new Error(`Firebase Auth kullanıcısı yok: ${emailKey}. Şifre ile oluşturulmalı.`);
    }
    const created = await admin.auth().createUser({
      email: emailKey,
      password,
      emailVerified: true,
    });
    return created.uid;
  }
}

export async function setUserCustomClaims(uid: string, claims: AuthCustomClaims): Promise<void> {
  const admin = getFirebaseAdmin();
  await admin.auth().setCustomUserClaims(uid, {
    role: claims.role,
    durum: claims.durum,
    email: claims.email,
  });
}

export async function syncClaimsForEmail(email: string, password?: string): Promise<AuthCustomClaims> {
  const claims = await readKullaniciClaimsSource(email);
  if (!claims) {
    throw new Error(`kullanicilar/${email.trim().toLowerCase()} bulunamadı`);
  }
  const uid = await ensureAuthUser(email, password);
  await setUserCustomClaims(uid, claims);
  return claims;
}

export async function verifyIdToken(idToken: string) {
  const admin = getFirebaseAdmin();
  return admin.auth().verifyIdToken(idToken);
}

export function callerIsYonetici(decoded: { role?: string; [key: string]: unknown }): boolean {
  return normalizeClaimRole(String(decoded.role || '')) === 'YÖNETİCİ';
}
