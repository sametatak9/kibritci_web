import { doc, setDoc } from 'firebase/firestore';
import { db, removeDocument, saveDocument } from './firebase';
import { isMobileRole, normalizeYetki, sanitizeKisitliSayfalar } from './yetkiUtils';

export interface KullaniciLike {
  id: string;
  email: string;
  yetki?: string;
  durum?: string;
  kayitTarihi?: string;
  ad?: string;
  soyad?: string;
  tcNo?: string;
  imzaText?: string;
  imzaStyle?: string;
  imzaCanvas?: string;
  matchedPersonelId?: string;
  kisitliSayfalar?: string[];
}

/** Aynı e-posta için hangi kaydın öncelikli olduğunu belirler */
function kullaniciPriorityScore(u: KullaniciLike): number {
  const yetki = normalizeYetki(u.yetki);
  let score = 0;
  if (u.durum === 'AKTİF') score += 100;
  else if (u.durum === 'ONAY BEKLİYOR') score += 40;
  if (isMobileRole(yetki)) score += 50;
  if (yetki === 'YÖNETİCİ') score += 45;
  if (yetki && yetki !== 'MİSAFİR') score += 20;
  if (u.ad || u.soyad) score += 5;
  if (u.tcNo) score += 3;
  return score;
}

/** Firestore'dan gelen çift kayıtları e-posta bazında birleştirir */
export function dedupeKullanicilarByEmail<T extends KullaniciLike>(users: T[]): T[] {
  const byEmail = new Map<string, T>();
  for (const u of users) {
    const key = u.email?.trim().toLowerCase();
    if (!key) continue;
    const existing = byEmail.get(key);
    if (!existing || kullaniciPriorityScore(u) >= kullaniciPriorityScore(existing)) {
      byEmail.set(key, u);
    }
  }
  return Array.from(byEmail.values());
}

/** Giriş yapan / yetki kontrolü için doğru kullanıcı kaydını seçer */
export function findKullaniciByEmail<T extends KullaniciLike>(
  users: T[],
  email?: string | null
): T | undefined {
  const key = email?.trim().toLowerCase();
  if (!key) return undefined;
  const matches = users.filter((u) => u.email?.trim().toLowerCase() === key);
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];
  return matches.sort((a, b) => kullaniciPriorityScore(b) - kullaniciPriorityScore(a))[0];
}

export function hasDuplicateKullaniciEmails(users: KullaniciLike[]): boolean {
  const seen = new Set<string>();
  for (const u of users) {
    const key = u.email?.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

/** Rol değişikliğini tüm eşleşen Firestore belgelerine yazar */
export async function persistKullaniciRole<T extends KullaniciLike>(
  kullanicilar: T[],
  targetId: string,
  newYetki: string
): Promise<T> {
  const target = kullanicilar.find((u) => u.id === targetId);
  if (!target?.email) throw new Error('Kullanıcı bulunamadı');

  const emailKey = target.email.trim().toLowerCase();
  const mobileRole = isMobileRole(newYetki);
  const updatedFields = {
    yetki: newYetki,
    durum: mobileRole ? 'AKTİF' : target.durum,
    kisitliSayfalar: sanitizeKisitliSayfalar(newYetki, target.kisitliSayfalar as string[] | undefined),
  };

  const sameEmailDocs = kullanicilar.filter((u) => u.email?.trim().toLowerCase() === emailKey);
  await Promise.all(
    sameEmailDocs.map((u) =>
      saveDocument('kullanicilar', { ...u, ...updatedFields, id: u.id } as T & { id: string })
    )
  );

  try {
    await setDoc(doc(db, 'portalKullanicilar', emailKey), { role: newYetki, yetki: newYetki }, { merge: true });
  } catch (err) {
    console.warn('portalKullanicilar rol güncellenemedi:', err);
  }

  return { ...target, ...updatedFields } as T;
}

/** Birleştirilmiş kayıt dışında kalan çift kullanıcı belgelerini siler */
export async function removeDuplicateKullaniciDocs<T extends KullaniciLike>(users: T[]): Promise<T[]> {
  const winners = dedupeKullanicilarByEmail(users);
  const winnerIds = new Set(winners.map((w) => w.id));
  const losers = users.filter((u) => {
    const key = u.email?.trim().toLowerCase();
    if (!key) return false;
    const winner = findKullaniciByEmail(winners, key);
    return winner && winner.id !== u.id;
  });

  if (losers.length === 0) return winners;

  await Promise.all(losers.map((u) => removeDocument('kullanicilar', u.id).catch(() => undefined)));
  return winners;
}

/** onSnapshot ham listesini normalize eder */
export function parseKullanicilarSnapshot(
  docs: Array<{ id: string; data: () => Record<string, unknown> }>
): KullaniciLike[] {
  return docs.map((d) => {
    const data = d.data();
    return { ...data, id: d.id } as KullaniciLike;
  });
}
