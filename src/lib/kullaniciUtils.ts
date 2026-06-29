import { doc, setDoc } from 'firebase/firestore';
import { db, fetchCollection, removeDocument, saveDocument } from './firebase';
import {
  applyRoleDefaults,
  isMobileRole,
  normalizeYetki,
} from './yetkiUtils';

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
  yetkiUpdatedAt?: string;
  /** Firestore belge kimliği (e-postadan farklı olabilir) */
  _docId?: string;
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
  if (u._docId === kullaniciDocId(u.email)) score += 50;
  if (u.yetkiUpdatedAt) {
    score += Math.min(new Date(u.yetkiUpdatedAt).getTime() / 1e12, 50);
  }
  return score;
}

export function dedupeKullanicilarByEmail<T extends KullaniciLike>(users: T[]): T[] {
  const byEmail = new Map<string, T>();
  for (const u of users) {
    const key = u.email?.trim().toLowerCase();
    if (!key) continue;
    const normalized = { ...u, id: key, email: key } as T;
    const existing = byEmail.get(key);
    if (!existing) {
      byEmail.set(key, normalized);
      continue;
    }
    const nextScore = kullaniciPriorityScore(normalized);
    const existingScore = kullaniciPriorityScore(existing);
    if (
      nextScore > existingScore ||
      (nextScore === existingScore && normalized._docId === key)
    ) {
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
  const docIdsByEmail = new Map<string, Set<string>>();
  for (const u of users) {
    const key = u.email?.trim().toLowerCase();
    if (!key) continue;
    const docId = u._docId || u.id;
    if (!docIdsByEmail.has(key)) docIdsByEmail.set(key, new Set());
    docIdsByEmail.get(key)!.add(docId);
  }
  for (const [email, ids] of docIdsByEmail) {
    if (ids.size > 1) return true;
    const only = [...ids][0];
    if (only && only !== kullaniciDocId(email)) return true;
  }
  return false;
}

async function deleteDuplicateDocs(emailKey: string, keepDocId = emailKey): Promise<void> {
  const all = await fetchCollection<KullaniciLike & { id: string }>('kullanicilar');
  const dupes = all.filter(
    (u) => u.email?.trim().toLowerCase() === emailKey && u.id !== keepDocId
  );
  await Promise.all(dupes.map((u) => removeDocument('kullanicilar', u.id).catch(() => undefined)));
}

/** Tek kullanıcıyı e-posta anahtarlı belgeye yazar, çift kayıtları siler */
export async function saveKullanici(user: KullaniciLike): Promise<KullaniciLike> {
  const emailKey = kullaniciDocId(user.email);
  const canonical: KullaniciLike = { ...user, id: emailKey, email: emailKey };

  await deleteDuplicateDocs(emailKey, emailKey);
  await saveDocument('kullanicilar', canonical as KullaniciLike & { id: string });

  return canonical;
}

/** Yeni üyelik — tüm koleksiyonu taramadan doğrudan yazar (hızlı kayıt) */
export async function saveKullaniciForSignup(user: KullaniciLike): Promise<KullaniciLike> {
  const emailKey = kullaniciDocId(user.email);
  const canonical: KullaniciLike = { ...user, id: emailKey, email: emailKey };
  await saveDocument('kullanicilar', canonical as KullaniciLike & { id: string });
  void deleteDuplicateDocs(emailKey, emailKey).catch(() => undefined);
  return canonical;
}

export async function persistKullaniciRole<T extends KullaniciLike>(
  kullanicilar: T[],
  targetId: string,
  newYetki: string
): Promise<T> {
  const target =
    kullanicilar.find((u) => u.id === targetId || u._docId === targetId) ||
    findKullaniciByEmail(kullanicilar, targetId);
  if (!target?.email) throw new Error('Kullanıcı bulunamadı');

  const emailKey = kullaniciDocId(target.email);
  const normalizedYetki = normalizeYetki(newYetki);
  const mobileRole = isMobileRole(normalizedYetki);
  const withRole = applyRoleDefaults(target, normalizedYetki);

  const updated: KullaniciLike = {
    ...withRole,
    id: emailKey,
    email: emailKey,
    durum: mobileRole ? 'AKTİF' : target.durum,
    yetkiUpdatedAt: new Date().toISOString(),
  };

  await saveKullanici(updated);

  try {
    await setDoc(
      doc(db, 'portalKullanicilar', emailKey),
      {
        role: normalizedYetki,
        yetki: normalizedYetki,
        yetkiUpdatedAt: updated.yetkiUpdatedAt,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('portalKullanicilar rol güncellenemedi:', err);
  }

  return updated as T;
}

/** Yalnızca çift belgeleri siler; mevcut e-posta anahtarlı kaydı ezmez */
export async function removeDuplicateKullaniciDocs<T extends KullaniciLike>(users: T[]): Promise<void> {
  const emails = new Set(users.map((u) => u.email?.trim().toLowerCase()).filter(Boolean) as string[]);
  for (const emailKey of emails) {
    if (!hasDuplicateKullaniciEmails(users.filter((u) => u.email?.trim().toLowerCase() === emailKey))) {
      const orphan = users.find(
        (u) => u.email?.trim().toLowerCase() === emailKey && (u._docId || u.id) !== emailKey
      );
      if (orphan) {
        await removeDocument('kullanicilar', orphan._docId || orphan.id).catch(() => undefined);
      }
      continue;
    }
    const winner = dedupeKullanicilarByEmail(
      users.filter((u) => u.email?.trim().toLowerCase() === emailKey)
    )[0];
    if (!winner) continue;

    const canonical = users.find(
      (u) => u.email?.trim().toLowerCase() === emailKey && u._docId === emailKey
    );

    const dupes = users.filter(
      (u) =>
        u.email?.trim().toLowerCase() === emailKey &&
        (u._docId || u.id) !== emailKey
    );

    await Promise.all(
      dupes.map((u) => removeDocument('kullanicilar', u._docId || u.id).catch(() => undefined))
    );

    if (!canonical) {
      await saveKullanici({ ...winner, id: emailKey, email: emailKey });
    }
  }
}

export function parseKullanicilarSnapshot(
  docs: Array<{ id: string; data: () => Record<string, unknown> }>
): KullaniciLike[] {
  return docs.map((d) => {
    const data = d.data();
    const email = String(data.email || d.id).trim().toLowerCase();
    return {
      ...data,
      id: email,
      email,
      _docId: d.id,
      yetki: (normalizeYetki(String(data.yetki || data.role || '')) || data.yetki || data.role) as string | undefined,
    } as KullaniciLike;
  });
}

export async function deleteKullaniciByEmail(email: string): Promise<void> {
  const emailKey = kullaniciDocId(email);
  const all = await fetchCollection<KullaniciLike & { id: string }>('kullanicilar');
  const targets = all.filter((u) => u.email?.trim().toLowerCase() === emailKey);
  await Promise.all(
    targets.map((u) => removeDocument('kullanicilar', u.id).catch(() => undefined))
  );
}
