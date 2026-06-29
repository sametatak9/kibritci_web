import { doc, setDoc } from 'firebase/firestore';
import { db, fetchCollection, removeDocument, saveDocument } from './firebase';
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

/** Firestore belge kimliği = e-posta (tek kaynak, çift kayıt önlenir) */
export function kullaniciDocId(email: string): string {
  return email.trim().toLowerCase();
}

function kullaniciPriorityScore(u: KullaniciLike): number {
  const yetki = normalizeYetki(u.yetki);
  let score = 0;
  if (u.durum === 'AKTİF') score += 100;
  else if (u.durum === 'ONAY BEKLİYOR') score += 40;
  if (isMobileRole(yetki)) score += 80;
  if (yetki === 'YÖNETİCİ') score += 45;
  if (yetki && yetki !== 'MİSAFİR') score += 20;
  if (u.ad || u.soyad) score += 5;
  if (u.tcNo) score += 3;
  return score;
}

export function dedupeKullanicilarByEmail<T extends KullaniciLike>(users: T[]): T[] {
  const byEmail = new Map<string, T>();
  for (const u of users) {
    const key = u.email?.trim().toLowerCase();
    if (!key) continue;
    const normalized = { ...u, id: key, email: key } as T;
    const existing = byEmail.get(key);
    if (!existing || kullaniciPriorityScore(normalized) >= kullaniciPriorityScore(existing)) {
      byEmail.set(key, normalized);
    }
  }
  return Array.from(byEmail.values());
}

export function findKullaniciByEmail<T extends KullaniciLike>(
  users: T[],
  email?: string | null
): T | undefined {
  const key = email?.trim().toLowerCase();
  if (!key) return undefined;
  return dedupeKullanicilarByEmail(users.filter((u) => u.email?.trim().toLowerCase() === key))[0];
}

export function hasDuplicateKullaniciEmails(users: KullaniciLike[]): boolean {
  const seen = new Set<string>();
  for (const u of users) {
    const key = u.email?.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return users.some((u) => u.email && u.id !== kullaniciDocId(u.email));
}

/** Tek kullanıcıyı e-posta anahtarlı belgeye yazar, çift kayıtları siler */
export async function saveKullanici(user: KullaniciLike): Promise<KullaniciLike> {
  const emailKey = kullaniciDocId(user.email);
  const canonical: KullaniciLike = { ...user, id: emailKey, email: emailKey };

  await saveDocument('kullanicilar', canonical as KullaniciLike & { id: string });

  try {
    const all = await fetchCollection<KullaniciLike>('kullanicilar');
    const dupes = all.filter(
      (u) => u.email?.trim().toLowerCase() === emailKey && u.id !== emailKey
    );
    await Promise.all(dupes.map((u) => removeDocument('kullanicilar', u.id).catch(() => undefined)));
  } catch (err) {
    console.warn('Çift kullanıcı temizliği atlandı:', err);
  }

  return canonical;
}

export async function persistKullaniciRole<T extends KullaniciLike>(
  kullanicilar: T[],
  targetId: string,
  newYetki: string
): Promise<T> {
  const target =
    kullanicilar.find((u) => u.id === targetId) ||
    findKullaniciByEmail(kullanicilar, targetId);
  if (!target?.email) throw new Error('Kullanıcı bulunamadı');

  const emailKey = kullaniciDocId(target.email);
  const mobileRole = isMobileRole(newYetki);
  const updated: KullaniciLike = {
    ...target,
    id: emailKey,
    email: emailKey,
    yetki: newYetki,
    durum: mobileRole ? 'AKTİF' : target.durum,
    kisitliSayfalar: sanitizeKisitliSayfalar(newYetki, target.kisitliSayfalar),
  };

  await saveKullanici(updated);

  try {
    await setDoc(
      doc(db, 'portalKullanicilar', emailKey),
      { role: newYetki, yetki: newYetki },
      { merge: true }
    );
  } catch (err) {
    console.warn('portalKullanicilar rol güncellenemedi:', err);
  }

  return updated as T;
}

export async function removeDuplicateKullaniciDocs<T extends KullaniciLike>(users: T[]): Promise<T[]> {
  const winners = dedupeKullanicilarByEmail(users);

  for (const winner of winners) {
    const emailKey = kullaniciDocId(winner.email);
    const dupes = users.filter(
      (u) => u.email?.trim().toLowerCase() === emailKey && u.id !== emailKey
    );
    const canonical = users.find((u) => u.id === emailKey);

    if (dupes.length === 0 && canonical) continue;

    const canonicalScore = canonical
      ? kullaniciPriorityScore({ ...canonical, id: emailKey, email: emailKey })
      : -1;
    const winnerScore = kullaniciPriorityScore({ ...winner, id: emailKey, email: emailKey });

    if (!canonical || winnerScore >= canonicalScore) {
      await saveKullanici({ ...winner, id: emailKey, email: emailKey });
    } else {
      await Promise.all(
        dupes.map((u) => removeDocument('kullanicilar', u.id).catch(() => undefined))
      );
    }
  }

  return winners.map(
    (w) => ({ ...w, id: kullaniciDocId(w.email), email: kullaniciDocId(w.email) }) as T
  );
}

export function parseKullanicilarSnapshot(
  docs: Array<{ id: string; data: () => Record<string, unknown> }>
): KullaniciLike[] {
  return docs.map((d) => {
    const data = d.data();
    const email = String(data.email || d.id).trim().toLowerCase();
    return { ...data, id: email, email } as KullaniciLike;
  });
}

export async function deleteKullaniciByEmail(email: string): Promise<void> {
  const emailKey = kullaniciDocId(email);
  const all = await fetchCollection<KullaniciLike>('kullanicilar');
  const targets = all.filter((u) => u.email?.trim().toLowerCase() === emailKey);
  await Promise.all(
    targets.map((u) => removeDocument('kullanicilar', u.id).catch(() => undefined))
  );
}
