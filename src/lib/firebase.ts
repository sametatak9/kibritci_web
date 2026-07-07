import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  onSnapshot,
  writeBatch,
  query
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestoreDatabaseId, resolveFirebaseConfig } from './firebaseConfig';
import { shouldBlockMassDelete } from './productionDataGuard';

const firebaseConfig = resolveFirebaseConfig();

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const firestoreDbId = getFirestoreDatabaseId(firebaseConfig);
export const db = firestoreDbId ? getFirestore(app, firestoreDbId) : getFirestore(app);
export const auth = getAuth(app);

/** Firestore güvenlik kuralları oturum gerektirir; giriş öncesi anonim oturum açar. */
export async function ensureFirestoreAuth(): Promise<boolean> {
  if (auth.currentUser) return true;
  try {
    await signInAnonymously(auth);
    return true;
  } catch (err) {
    console.warn('Anonim Firestore oturumu açılamadı:', err);
    return false;
  }
}

/** Hangi Firebase projesine bağlı olduğumuzu konsolda görmek için */
if (typeof window !== 'undefined') {
  console.info(
    `[Firebase] projectId=${firebaseConfig.projectId}` +
      (firestoreDbId ? ` firestoreDb=${firestoreDbId}` : ' firestoreDb=(default)')
  );
}

/**
 * Helper to wrap any promise with a timeout
 */
export async function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('FIRESTORE_TIMEOUT'));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Generic helper to fetch all documents in a collection
 */
export async function fetchCollection<T>(collectionName: string): Promise<T[]> {
  const colRef = collection(db, collectionName);
  const snapshot = await withTimeout(getDocs(colRef));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as unknown as T);
}

/**
 * Recursively cleans an object by replacing undefined values with null
 * to prevent Firestore synchronization crashes.
 */
export function cleanUndefined(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null) return null;

  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item));
  }

  if (typeof obj === 'object') {
    if (obj instanceof Date || obj instanceof RegExp) {
      return obj;
    }
    const cleanObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        cleanObj[key] = val === undefined ? null : cleanUndefined(val);
      }
    }
    return cleanObj;
  }

  return obj;
}

/**
 * Generic helper to save or update a single document
 */
export async function saveDocument<T extends { id: string }>(collectionName: string, item: T): Promise<void> {
  const docRef = doc(db, collectionName, item.id);
  await withTimeout(setDoc(docRef, cleanUndefined(item), { merge: true }), 15000);
}

/** Yeni üyelik — portal + kullanıcı kayıtlarını paralel yazar */
export async function saveSignupDocuments(
  emailKey: string,
  portalData: Record<string, unknown>,
  kullaniciData: Record<string, unknown>
): Promise<void> {
  const portalRef = doc(db, 'portalKullanicilar', emailKey);
  const kullaniciRef = doc(db, 'kullanicilar', emailKey);
  const payload = cleanUndefined({ ...kullaniciData, id: emailKey, email: emailKey });

  await withTimeout(
    Promise.all([
      setDoc(portalRef, cleanUndefined(portalData), { merge: true }),
      setDoc(kullaniciRef, payload, { merge: true }),
    ]),
    30000
  );
}

/**
 * Generic helper to delete a document
 */
export async function removeDocument(collectionName: string, id: string): Promise<void> {
  const docRef = doc(db, collectionName, id);
  await withTimeout(deleteDoc(docRef), 15000);
}

/**
 * Generic helper to seed collection with initial items if empty
 */
export async function seedCollectionIfEmpty<T extends { id: string }>(
  collectionName: string, 
  initialItems: T[]
): Promise<T[]> {
  const colRef = collection(db, collectionName);
  const snapshot = await withTimeout(getDocs(colRef));
  
  if (snapshot.empty) {
    if (initialItems.length === 0) {
      return [];
    }
    console.log(`Seeding initial data for ${collectionName}...`);
    const batch = writeBatch(db);
    
    initialItems.forEach(item => {
      const docRef = doc(db, collectionName, item.id);
      batch.set(docRef, cleanUndefined(item));
    });
    
    await withTimeout(batch.commit());
    return initialItems;
  }
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as unknown as T);
}

export function parseYoklamaSnapshotData(
  raw: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw.dataJson === 'string') {
    try {
      return JSON.parse(raw.dataJson) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return (raw.data as Record<string, unknown>) || {};
}

function buildYoklamaFirestorePayload(map: Record<string, unknown>): { dataJson: string } {
  return { dataJson: JSON.stringify(map) };
}

/**
 * Specifically seed yoklamalar because its keys are dynamic and the root is a nested map
 * Let's store yoklama in a single document 'all_yoklama' under collection 'yoklamalar' 
 * or as individual documents with { id: personelId, d: { [day]: { durum, mesai } } }
 */
export async function seedYoklamaIfEmpty(initialYoklama: any): Promise<any> {
  const docRef = doc(db, 'yoklamalar', 'global_yoklama_map');
  const snapshot = await withTimeout(getDocs(collection(db, 'yoklamalar')));
  
  if (snapshot.empty) {
    console.log(`Seeding dynamic yoklama map...`);
    await withTimeout(setDoc(docRef, cleanUndefined(buildYoklamaFirestorePayload(initialYoklama))));
    return initialYoklama;
  }
  
  // Find 'global_yoklama_map' document
  const globalDoc = snapshot.docs.find(d => d.id === 'global_yoklama_map');
  if (globalDoc) {
    return parseYoklamaSnapshotData(globalDoc.data() as Record<string, unknown>);
  }
  return {};
}

export async function fetchYoklamaDocument(): Promise<Record<string, unknown>> {
  const snapshot = await withTimeout(getDocs(collection(db, 'yoklamalar')));
  const globalDoc = snapshot.docs.find((d) => d.id === 'global_yoklama_map');
  if (globalDoc) return parseYoklamaSnapshotData(globalDoc.data() as Record<string, unknown>);
  return {};
}

/** Uzak kayıttaki personelleri korur; yerel güncellemeler üstüne yazılır */
export function mergeYoklamaMaps(
  remote: Record<string, unknown>,
  local: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...remote };
  for (const [personId, days] of Object.entries(local || {})) {
    const remoteDays = (result[personId] as Record<string, unknown>) || {};
    result[personId] = { ...remoteDays, ...(days as Record<string, unknown>) };
  }
  return result;
}

export async function saveYoklamaDocument(yoklamaMap: Record<string, unknown>): Promise<void> {
  const docRef = doc(db, 'yoklamalar', 'global_yoklama_map');
  let payload = yoklamaMap;
  try {
    const remote = await fetchYoklamaDocument();
    if (Object.keys(remote).length > 0) {
      payload = mergeYoklamaMaps(remote, yoklamaMap);
    }
  } catch {
    /* yerel kayıt */
  }
  await withTimeout(setDoc(docRef, cleanUndefined(buildYoklamaFirestorePayload(payload)), 45000));
}

/**
 * Generic helper to delta-sync live list array states to Firestore
 */
export async function syncArrayToFirestore<T extends { id: string }>(
  collectionName: string,
  oldArray: T[],
  newArray: T[]
): Promise<void> {
  try {
    const massDeleteBlocked = shouldBlockMassDelete(collectionName, oldArray.length, newArray.length);
    if (massDeleteBlocked) {
      // #region agent log
      fetch('http://127.0.0.1:7872/ingest/ef5f18bc-f649-42ac-a5a3-37f3283d64f9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9ac11e'},body:JSON.stringify({sessionId:'9ac11e',runId:'baseline-1',hypothesisId:'H3',location:'firebase.ts:syncArrayToFirestore',message:'mass delete blocked by guard',data:{collectionName,oldCount:oldArray.length,newCount:newArray.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return;
    }

    const oldMap = new Map(oldArray.map(item => [item.id, item]));
    const newMap = new Map(newArray.map(item => [item.id, item]));

    const promises: Promise<any>[] = [];

    // Save/Update new or changed items
    for (const [id, item] of newMap.entries()) {
      const oldItem = oldMap.get(id);
      if (!oldItem || JSON.stringify(oldItem) !== JSON.stringify(item)) {
        promises.push(saveDocument(collectionName, item));
      }
    }

    // Delete removed items
    for (const id of oldMap.keys()) {
      if (!newMap.has(id)) {
        promises.push(removeDocument(collectionName, id));
      }
    }

    // #region agent log
    fetch('http://127.0.0.1:7872/ingest/ef5f18bc-f649-42ac-a5a3-37f3283d64f9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9ac11e'},body:JSON.stringify({sessionId:'9ac11e',runId:'baseline-1',hypothesisId:'H1',location:'firebase.ts:syncArrayToFirestore',message:'sync operation prepared',data:{collectionName,oldCount:oldArray.length,newCount:newArray.length,operations:promises.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    await Promise.all(promises);
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7872/ingest/ef5f18bc-f649-42ac-a5a3-37f3283d64f9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9ac11e'},body:JSON.stringify({sessionId:'9ac11e',runId:'baseline-1',hypothesisId:'H1',location:'firebase.ts:syncArrayToFirestore',message:'sync operation failed',data:{collectionName,error:String(error)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.error(`Error syncing array for collection ${collectionName}:`, error);
  }
}

