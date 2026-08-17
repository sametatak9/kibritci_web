import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { AylikYoklamaMap } from '../types/erp';
import { auth, db, cleanUndefined, withTimeout } from './firebase';
import { formatFirestoreWriteError } from './authWriteGuard';
import {
  countYoklamaDateKeys,
  countYoklamaDayEntries,
  countYoklamaFilledDays,
  countYoklamaPersons,
  mergeYoklamaMaps,
  shouldBlockYoklamaMassWrite,
} from './yoklamaGuard';
import { hasSubstantialYoklamaData, isProductionLive } from './productionDataGuard';

export const YOKLAMA_DOC_ID = 'global_yoklama_map';
export const YOKLAMA_ARCHIVE_COLLECTION = 'yoklamaArsivleri';
const MAX_ARCHIVES = 80;
/** Mega-belge: PC'de getDocFromServer sık timeout — cache/ay shard tercih edilir */
export const YOKLAMA_SERVER_READ_TIMEOUT_MS = 90_000;
export const YOKLAMA_CACHE_READ_TIMEOUT_MS = 35_000;
export const YOKLAMA_WRITE_TIMEOUT_MS = 60_000;
export const YOKLAMA_MONTH_READ_TIMEOUT_MS = 12_000;
export const YOKLAMA_MEGA_CACHE_QUICK_MS = 8_000;
const YOKLAMA_MONTH_CACHE_PREFIX = 'kibritci_yoklama_ay_v1_';
const YOKLAMA_MONTH_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Arşiv budama en fazla bu kadar saniyede bir çalışır (her kayıtta tam tarama yok) */
const ARCHIVE_PRUNE_MIN_INTERVAL_MS = 10 * 60 * 1000;

let lastArchivePruneAt = 0;
let archivePruneInFlight: Promise<void> | null = null;
let monthShardMigrateInFlight: Promise<void> | null = null;

export type YoklamaSaveSource =
  | 'yoklama_screen'
  | 'formen_mobil'
  | 'idari'
  | 'kamp'
  | 'evrak'
  | 'legacy_bootstrap'
  | 'restore'
  | 'sync';

export interface YoklamaSaveResult {
  ok: boolean;
  error?: string;
  blocked?: boolean;
  personCount?: number;
  filledDayCount?: number;
  /** Sunucuya yazılan birleşik harita (yerel state bununla güncellenmeli) */
  map?: AylikYoklamaMap;
}

export interface YoklamaArchiveEntry {
  id: string;
  olusturmaTarihi: string;
  kaynak: YoklamaSaveSource;
  personelSayisi: number;
  gunSayisi: number;
  doluGunSayisi: number;
  tarihAnahtarSayisi: number;
  aciklama?: string;
}

function buildYoklamaFirestorePayload(map: Record<string, unknown>): { dataJson: string } {
  return { dataJson: JSON.stringify(map) };
}

export function parseYoklamaDataJson(raw: Record<string, unknown> | undefined): AylikYoklamaMap {
  if (!raw) return {};
  if (typeof raw.dataJson === 'string') {
    try {
      return JSON.parse(raw.dataJson) as AylikYoklamaMap;
    } catch {
      return {};
    }
  }
  return (raw.data as AylikYoklamaMap) || {};
}

export function yoklamaMonthDocId(yearMonth: string): string {
  return `ay_${yearMonth}`;
}

/** Haritadaki YYYY-MM anahtarlarını listeler */
export function listYoklamaYearMonths(map: AylikYoklamaMap): string[] {
  const months = new Set<string>();
  for (const personMap of Object.values(map || {})) {
    if (!personMap || typeof personMap !== 'object') continue;
    for (const key of Object.keys(personMap)) {
      const m = key.match(/^(\d{4}-\d{2})-\d{2}$/);
      if (m) months.add(m[1]);
    }
  }
  return [...months].sort();
}

export function sliceYoklamaMapToYearMonth(map: AylikYoklamaMap, yearMonth: string): AylikYoklamaMap {
  const prefix = `${yearMonth}-`;
  const out: AylikYoklamaMap = {};
  for (const [personId, days] of Object.entries(map || {})) {
    if (!days || typeof days !== 'object') continue;
    const sliced: Record<string, unknown> = {};
    for (const [dayKey, val] of Object.entries(days)) {
      if (dayKey.startsWith(prefix)) sliced[dayKey] = val;
    }
    if (Object.keys(sliced).length > 0) {
      out[personId] = sliced as AylikYoklamaMap[string];
    }
  }
  return out;
}

function countFilledInYearMonths(map: AylikYoklamaMap, yearMonths: string[]): number {
  if (!yearMonths.length) return countYoklamaFilledDays(map);
  let total = 0;
  for (const ym of yearMonths) {
    total += countYoklamaFilledDays(sliceYoklamaMapToYearMonth(map, ym));
  }
  return total;
}

export function nearbyYoklamaYearMonths(center = new Date(), radius = 2): string[] {
  const out: string[] = [];
  const y = center.getFullYear();
  const m = center.getMonth(); // 0-based
  for (let i = -radius; i <= radius; i++) {
    const d = new Date(y, m + i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function surroundingYearMonths(center = new Date(), radius = 2): string[] {
  return nearbyYoklamaYearMonths(center, radius);
}

export function readCachedYoklamaMonth(yearMonth: string): AylikYoklamaMap {
  if (typeof localStorage === 'undefined' || !yearMonth) return {};
  try {
    const raw = localStorage.getItem(`${YOKLAMA_MONTH_CACHE_PREFIX}${yearMonth}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { savedAt?: number; map?: AylikYoklamaMap };
    if (!parsed?.map || typeof parsed.map !== 'object') return {};
    if (Date.now() - Number(parsed.savedAt || 0) > YOKLAMA_MONTH_CACHE_MAX_AGE_MS) return {};
    return parsed.map;
  } catch {
    return {};
  }
}

export function readCachedYoklamaMonths(yearMonths: string[]): AylikYoklamaMap {
  let merged: AylikYoklamaMap = {};
  for (const ym of yearMonths) {
    const part = readCachedYoklamaMonth(ym);
    if (Object.keys(part).length === 0) continue;
    merged = mergeYoklamaMaps(merged, part) as AylikYoklamaMap;
  }
  return merged;
}

export function writeCachedYoklamaMonth(yearMonth: string, map: AylikYoklamaMap): void {
  if (typeof localStorage === 'undefined' || !yearMonth) return;
  const slice = sliceYoklamaMapToYearMonth(map, yearMonth);
  if (countYoklamaFilledDays(slice) < 1) return;
  try {
    localStorage.setItem(
      `${YOKLAMA_MONTH_CACHE_PREFIX}${yearMonth}`,
      JSON.stringify({ savedAt: Date.now(), map: slice })
    );
  } catch {
    try {
      localStorage.removeItem(`${YOKLAMA_MONTH_CACHE_PREFIX}${yearMonth}`);
    } catch {
      /* ignore */
    }
  }
}

export function cacheYoklamaMonthsFromMap(map: AylikYoklamaMap, yearMonths?: string[]): void {
  const months = yearMonths?.length ? yearMonths : listYoklamaYearMonths(map);
  for (const ym of months) writeCachedYoklamaMonth(ym, map);
}

async function fetchMonthShardFromApi(yearMonth: string): Promise<AylikYoklamaMap> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return {};
  try {
    const token = await user.getIdToken();
    const res = await fetch(`/api/yoklama-ay/${encodeURIComponent(yearMonth)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return {};
    const json = (await res.json()) as { map?: AylikYoklamaMap };
    if (!json.map || typeof json.map !== 'object') return {};
    return json.map;
  } catch {
    return {};
  }
}

async function fetchMonthShard(yearMonth: string): Promise<AylikYoklamaMap> {
  const cached = readCachedYoklamaMonth(yearMonth);
  const [apiMap, docMap] = await Promise.all([
    fetchMonthShardFromApi(yearMonth),
    (async () => {
      const docRef = doc(db, 'yoklamalar', yoklamaMonthDocId(yearMonth));
      try {
        const snap = await withTimeout(() => getDoc(docRef), YOKLAMA_MONTH_READ_TIMEOUT_MS, 0);
        if (!snap.exists()) return {} as AylikYoklamaMap;
        return parseYoklamaDataJson(snap.data() as Record<string, unknown>);
      } catch {
        return {} as AylikYoklamaMap;
      }
    })(),
  ]);
  let merged = cached;
  for (const part of [docMap, apiMap]) {
    if (Object.keys(part).length === 0) continue;
    merged = mergeYoklamaMaps(merged, part) as AylikYoklamaMap;
  }
  if (countYoklamaFilledDays(merged) > 0) {
    writeCachedYoklamaMonth(yearMonth, merged);
  }
  return merged;
}

/** Küçük ay belgelerini paralel oku — PC timeout'ta ana belgeye gerek kalmaz */
export async function fetchYoklamaMonthShards(
  yearMonths: string[]
): Promise<AylikYoklamaMap> {
  const unique = [...new Set(yearMonths.filter(Boolean))];
  if (unique.length === 0) return {};
  const parts = await Promise.all(unique.map((ym) => fetchMonthShard(ym)));
  let merged: AylikYoklamaMap = {};
  for (const part of parts) {
    if (Object.keys(part).length === 0) continue;
    merged = mergeYoklamaMaps(merged, part) as AylikYoklamaMap;
  }
  return merged;
}

/** Yakın ay belgelerini canlı dinle — mega-belgeyi açılışta indirmez. */
export function subscribeYoklamaMonthShards(
  yearMonths: string[],
  onData: (map: AylikYoklamaMap, yearMonth: string) => void
): () => void {
  const unique = [...new Set(yearMonths.filter(Boolean))];
  const unsubs = unique.map((ym) =>
    onSnapshot(
      doc(db, 'yoklamalar', yoklamaMonthDocId(ym)),
      (snap) => {
        if (!snap.exists()) return;
        const map = parseYoklamaDataJson(snap.data() as Record<string, unknown>);
        if (Object.keys(map).length === 0) return;
        writeCachedYoklamaMonth(ym, map);
        onData(map, ym);
      },
      (err) => {
        console.warn('[yoklama] ay shard dinleme hatası', ym, err);
      }
    )
  );
  return () => unsubs.forEach((u) => u());
}

async function writeMonthShard(yearMonth: string, slice: AylikYoklamaMap): Promise<void> {
  if (Object.keys(slice).length === 0) return;
  const docRef = doc(db, 'yoklamalar', yoklamaMonthDocId(yearMonth));
  await withTimeout(
    setDoc(
      docRef,
      cleanUndefined({
        ...buildYoklamaFirestorePayload(slice),
        yearMonth,
        updatedAt: new Date().toISOString(),
        personCount: countYoklamaPersons(slice),
        filledDayCount: countYoklamaFilledDays(slice),
      }),
      { merge: false }
    ),
    25_000
  );
}

/** Büyük haritayı ay belgelerine böler (arka plan; hata yutma) */
export function scheduleYoklamaMonthShardSync(map: AylikYoklamaMap): void {
  if (monthShardMigrateInFlight) return;
  const months = listYoklamaYearMonths(map);
  if (months.length === 0) return;
  monthShardMigrateInFlight = (async () => {
    // Önce yakın aylar — PC Temmuz yüklemesi için kritik
    const near = new Set(surroundingYearMonths(new Date(), 3));
    const ordered = [
      ...months.filter((m) => near.has(m)),
      ...months.filter((m) => !near.has(m)),
    ];
    for (const ym of ordered) {
      try {
        const slice = sliceYoklamaMapToYearMonth(map, ym);
        await writeMonthShard(ym, slice);
      } catch (err) {
        console.warn('[yoklama] ay shard yazılamadı', ym, err);
      }
    }
  })()
    .catch((err) => console.warn('[yoklama] ay shard senkronu atlandı:', err))
    .finally(() => {
      monthShardMigrateInFlight = null;
    });
}

export async function fetchYoklamaMap(): Promise<AylikYoklamaMap> {
  const docRef = doc(db, 'yoklamalar', YOKLAMA_DOC_ID);
  const docSnap = await withTimeout(getDoc(docRef), YOKLAMA_CACHE_READ_TIMEOUT_MS);
  if (!docSnap.exists()) return {};
  return parseYoklamaDataJson(docSnap.data() as Record<string, unknown>);
}

/** IndexedDB önbelleğini atlayıp sunucudan oku (masaüstü/telefon senkron farkı için). */
export async function fetchYoklamaMapFromServer(): Promise<{
  map: AylikYoklamaMap;
  dataJson: string | null;
}> {
  const docRef = doc(db, 'yoklamalar', YOKLAMA_DOC_ID);
  const docSnap = await withTimeout(getDocFromServer(docRef), YOKLAMA_SERVER_READ_TIMEOUT_MS);
  if (!docSnap.exists()) return { map: {}, dataJson: null };
  const raw = docSnap.data() as Record<string, unknown>;
  return {
    map: parseYoklamaDataJson(raw),
    dataJson: typeof raw.dataJson === 'string' ? raw.dataJson : null,
  };
}

/** Sunucu okuması: timeout / ağ kopmasında birkaç kez dene. */
export async function fetchYoklamaMapFromServerWithRetry(retries = 3): Promise<{
  map: AylikYoklamaMap;
  dataJson: string | null;
}> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fetchYoklamaMapFromServer();
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Yoklama sunucudan okunamadı');
}

/**
 * PC dostu yükleme: önce ay shard + yerel özet, mega-belge yalnızca gerekirse.
 * Mega-belge cache okuması UI'yi 35sn bekletmesin diye kısa timeout kullanır.
 */
export async function fetchYoklamaMapPreferFast(opts?: {
  yearMonths?: string[];
  allowServerForce?: boolean;
}): Promise<{
  map: AylikYoklamaMap;
  dataJson: string | null;
  source: 'cache' | 'month_shards' | 'server' | 'merged';
}> {
  const yearMonths = opts?.yearMonths?.length
    ? opts.yearMonths
    : surroundingYearMonths(new Date(), 2);
  const allowServerForce = opts?.allowServerForce !== false;

  let best: AylikYoklamaMap = readCachedYoklamaMonths(yearMonths);
  let bestFilled = countYoklamaFilledDays(best);
  let dataJson: string | null = null;
  let source: 'cache' | 'month_shards' | 'server' | 'merged' = bestFilled > 0 ? 'cache' : 'month_shards';

  // 1) Küçük ay belgeleri + API — mega-belgeyi bekletmeden
  try {
    const shards = await fetchYoklamaMonthShards(yearMonths);
    const shardFilled = countYoklamaFilledDays(shards);
    if (shardFilled > 0) {
      if (bestFilled > 0) {
        best = mergeYoklamaMaps(best, shards) as AylikYoklamaMap;
        bestFilled = countYoklamaFilledDays(best);
        source = 'merged';
      } else {
        best = shards;
        bestFilled = shardFilled;
        source = 'month_shards';
      }
    }
  } catch (err) {
    console.warn('[yoklama] ay shard okuma atlandı:', err);
  }

  const requestedFilled = countFilledInYearMonths(best, yearMonths);
  const shardsGoodEnough = requestedFilled >= 5 || (bestFilled >= 30 && requestedFilled > 0);

  // 2) İstenen aylar dolduysa mega-belgeyi UI yolundan çıkar (arka plan)
  if (shardsGoodEnough) {
    cacheYoklamaMonthsFromMap(best, yearMonths);
    try {
      dataJson = JSON.stringify(best);
    } catch {
      dataJson = null;
    }
    if (allowServerForce) {
      void fetchYoklamaMapFromServer()
        .then((server) => {
          scheduleYoklamaMonthShardSync(server.map);
          cacheYoklamaMonthsFromMap(server.map, yearMonths);
        })
        .catch(() => undefined);
    }
    if (bestFilled >= 30) {
      scheduleYoklamaMonthShardSync(best);
    }
    return { map: best, dataJson, source };
  }

  // 3) Shard zayıfsa kısa timeout ile cache mega-belge
  try {
    const cached = await withTimeout(
      () => getDoc(doc(db, 'yoklamalar', YOKLAMA_DOC_ID)),
      YOKLAMA_MEGA_CACHE_QUICK_MS,
      0
    );
    if (cached.exists()) {
      const map = parseYoklamaDataJson(cached.data() as Record<string, unknown>);
      const filled = countYoklamaFilledDays(map);
      if (filled > bestFilled) {
        best = bestFilled > 0 ? (mergeYoklamaMaps(best, map) as AylikYoklamaMap) : map;
        bestFilled = countYoklamaFilledDays(best);
        source = bestFilled > filled ? 'merged' : 'cache';
        const raw = cached.data() as Record<string, unknown>;
        dataJson = typeof raw.dataJson === 'string' ? raw.dataJson : JSON.stringify(best);
      } else if (filled > 0 && bestFilled > 0) {
        best = mergeYoklamaMaps(best, map) as AylikYoklamaMap;
        bestFilled = countYoklamaFilledDays(best);
        source = 'merged';
      }
    }
  } catch (err) {
    console.warn('[yoklama] mega-belge cache hızlı okuma atlandı:', err);
  }

  const requestedAfterCache = countFilledInYearMonths(best, yearMonths);
  const needServer =
    allowServerForce &&
    (bestFilled < 30 || !hasSubstantialYoklamaData(best) || requestedAfterCache < 5);

  if (needServer) {
    try {
      const server = await fetchYoklamaMapFromServerWithRetry(2);
      const serverFilled = countYoklamaFilledDays(server.map);
      if (serverFilled >= bestFilled) {
        best = server.map;
        bestFilled = serverFilled;
        dataJson = server.dataJson;
        source = 'server';
      } else if (serverFilled > 0) {
        best = mergeYoklamaMaps(best, server.map) as AylikYoklamaMap;
        bestFilled = countYoklamaFilledDays(best);
        source = 'merged';
      }
    } catch (err) {
      console.warn('[yoklama] sunucu mega-belge okunamadı (cache/shard ile devam):', err);
      if (bestFilled === 0) {
        throw err instanceof Error
          ? err
          : new Error(
              'Yoklama yüklenemedi: bağlantı zaman aşımı. Önbellek ve ay yedekleri de boş.'
            );
      }
    }
  }

  if (bestFilled >= 30) {
    scheduleYoklamaMonthShardSync(best);
  }
  cacheYoklamaMonthsFromMap(best, yearMonths);

  return { map: best, dataJson, source };
}

async function fetchYoklamaMapWithRetry(retries = 3): Promise<AylikYoklamaMap> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fetchYoklamaMap();
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Yoklama belgesi okunamadı');
}

async function writeYoklamaMap(map: AylikYoklamaMap): Promise<void> {
  const docRef = doc(db, 'yoklamalar', YOKLAMA_DOC_ID);
  await withTimeout(
    setDoc(docRef, cleanUndefined(buildYoklamaFirestorePayload(map)), { merge: false }),
    YOKLAMA_WRITE_TIMEOUT_MS
  );
}

function archiveDocId(): string {
  return `arsiv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function archiveYoklamaSnapshot(
  map: AylikYoklamaMap,
  kaynak: YoklamaSaveSource,
  aciklama?: string
): Promise<string | null> {
  const personelSayisi = countYoklamaPersons(map);
  const gunSayisi = countYoklamaDayEntries(map);
  if (personelSayisi === 0 && gunSayisi === 0) return null;

  const id = archiveDocId();
  const payload = {
    id,
    olusturmaTarihi: new Date().toISOString(),
    kaynak,
    personelSayisi,
    gunSayisi,
    doluGunSayisi: countYoklamaFilledDays(map),
    tarihAnahtarSayisi: countYoklamaDateKeys(map),
    aciklama: aciklama || null,
    dataJson: JSON.stringify(map),
  };

  await withTimeout(
    setDoc(doc(db, YOKLAMA_ARCHIVE_COLLECTION, id), cleanUndefined(payload)),
    20000
  );

  const now = Date.now();
  if (now - lastArchivePruneAt >= ARCHIVE_PRUNE_MIN_INTERVAL_MS) {
    lastArchivePruneAt = now;
    if (!archivePruneInFlight) {
      archivePruneInFlight = pruneOldYoklamaArchives()
        .catch((err) => {
          console.warn('Yoklama arşivi temizliği atlandı:', err);
        })
        .finally(() => {
          archivePruneInFlight = null;
        });
    }
  }

  return id;
}

async function pruneOldYoklamaArchives(): Promise<void> {
  const colRef = collection(db, YOKLAMA_ARCHIVE_COLLECTION);
  // Sadece fazlalık kadar oku — tüm arşiv koleksiyonunu çekme
  const snapshot = await withTimeout(
    getDocs(query(colRef, orderBy('olusturmaTarihi', 'desc'), limit(MAX_ARCHIVES + 25)))
  );
  const docs = snapshot.docs;
  if (docs.length <= MAX_ARCHIVES) return;

  const toDelete = docs.slice(MAX_ARCHIVES);
  await Promise.all(toDelete.map((d) => withTimeout(deleteDoc(d.ref), 10000)));
}

export async function listYoklamaArchives(limitCount = 25): Promise<YoklamaArchiveEntry[]> {
  const colRef = collection(db, YOKLAMA_ARCHIVE_COLLECTION);
  const snapshot = await withTimeout(
    getDocs(query(colRef, orderBy('olusturmaTarihi', 'desc'), limit(limitCount)))
  );
  return snapshot.docs.map((d) => {
    const data = d.data() as YoklamaArchiveEntry & { dataJson?: string };
    return {
      id: data.id || d.id,
      olusturmaTarihi: data.olusturmaTarihi,
      kaynak: data.kaynak,
      personelSayisi: data.personelSayisi,
      gunSayisi: data.gunSayisi,
      doluGunSayisi: data.doluGunSayisi,
      tarihAnahtarSayisi: data.tarihAnahtarSayisi,
      aciklama: data.aciklama,
    };
  });
}

export async function loadYoklamaArchiveMap(archiveId: string): Promise<AylikYoklamaMap> {
  const found = await withTimeout(getDoc(doc(db, YOKLAMA_ARCHIVE_COLLECTION, archiveId)));
  if (!found.exists()) throw new Error('Arşiv kaydı bulunamadı');
  return parseYoklamaDataJson(found.data() as Record<string, unknown>);
}

let saveChain: Promise<YoklamaSaveResult> = Promise.resolve({ ok: true });

export function enqueueYoklamaSave(
  localMap: AylikYoklamaMap,
  kaynak: YoklamaSaveSource
): Promise<YoklamaSaveResult> {
  const task = saveChain.then(() => persistYoklamaDocument(localMap, kaynak));
  saveChain = task.catch(() => ({ ok: false, error: 'Kayıt kuyruğu hatası' }));
  return task;
}

/** Yazmadan önce uzak harita: cache öncelikli (PC timeout'u azaltır) */
async function loadRemoteForWrite(): Promise<AylikYoklamaMap> {
  try {
    const cached = await fetchYoklamaMapWithRetry(isProductionLive() ? 3 : 2);
    if (hasSubstantialYoklamaData(cached) || countYoklamaFilledDays(cached) >= 30) {
      // Arka planda sunucu ile doğrula; yazmayı bloklama
      void fetchYoklamaMapFromServer()
        .then((s) => {
          if (countYoklamaFilledDays(s.map) > countYoklamaFilledDays(cached) + 20) {
            scheduleYoklamaMonthShardSync(s.map);
          }
        })
        .catch(() => undefined);
      return cached;
    }
  } catch {
    /* cache boş / timeout */
  }

  try {
    const shards = await fetchYoklamaMonthShards(surroundingYearMonths(new Date(), 3));
    if (countYoklamaFilledDays(shards) >= 10) return shards;
  } catch {
    /* ignore */
  }

  return (await fetchYoklamaMapFromServerWithRetry(2)).map;
}

export async function persistYoklamaDocument(
  localMap: AylikYoklamaMap,
  kaynak: YoklamaSaveSource = 'sync'
): Promise<YoklamaSaveResult> {
  let remote: AylikYoklamaMap;

  try {
    remote = await loadRemoteForWrite();
  } catch (err) {
    if (isProductionLive() || hasSubstantialYoklamaData(localMap)) {
      return {
        ok: false,
        error:
          'Yoklama kaydedilemedi: sunucudaki mevcut veri okunamadı. Kayıt güvenlik nedeniyle iptal edildi. Bağlantınızı kontrol edip tekrar deneyin.',
      };
    }
    remote = {};
  }

  const remoteNonEmpty = Object.keys(remote).length > 0;
  const payload = remoteNonEmpty
    ? (mergeYoklamaMaps(remote, localMap) as AylikYoklamaMap)
    : localMap;

  if (remoteNonEmpty) {
    const guard = shouldBlockYoklamaMassWrite(remote, payload);
    if (guard.blocked) {
      void archiveYoklamaSnapshot(remote, kaynak, `Engellenen yazma: ${guard.reason}`).catch((e) =>
        console.warn('Engellenen yazma arşivi atlandı:', e)
      );
      return { ok: false, blocked: true, error: guard.reason };
    }
  }

  try {
    await writeYoklamaMap(payload);
    cacheYoklamaMonthsFromMap(payload);
    // Ay shard'ları — sonraki PC yüklemeleri mega-belgeye muhtaç kalmasın
    scheduleYoklamaMonthShardSync(payload);
    // Arşiv kritik yolda bekletmesin (timeout zincirini kısaltır)
    if (remoteNonEmpty) {
      void archiveYoklamaSnapshot(remote, kaynak, 'Kayıt sonrası otomatik yedek').catch((e) =>
        console.warn('Yoklama arşivi atlandı:', e)
      );
    }
    return {
      ok: true,
      map: payload,
      personCount: countYoklamaPersons(payload),
      filledDayCount: countYoklamaFilledDays(payload),
    };
  } catch (err) {
    const msg = formatFirestoreWriteError(err, 'Yoklama yazılamadı');
    return { ok: false, error: `Yoklama yazılamadı: ${msg}` };
  }
}

export async function restoreYoklamaFromArchive(
  archiveId: string,
  kaynak: YoklamaSaveSource = 'restore'
): Promise<YoklamaSaveResult> {
  const archivedMap = await loadYoklamaArchiveMap(archiveId);
  if (!hasSubstantialYoklamaData(archivedMap) && countYoklamaDayEntries(archivedMap) < 5) {
    return { ok: false, error: 'Seçilen arşiv kaydı boş veya geçersiz görünüyor.' };
  }

  let remote: AylikYoklamaMap = {};
  try {
    remote = await fetchYoklamaMapWithRetry(3);
  } catch {
    /* ilk kurulum */
  }

  if (Object.keys(remote).length > 0) {
    await archiveYoklamaSnapshot(remote, 'restore', `Geri yükleme öncesi yedek (hedef: ${archiveId})`);
  }

  const merged = Object.keys(remote).length > 0
    ? (mergeYoklamaMaps(remote, archivedMap) as AylikYoklamaMap)
    : archivedMap;

  try {
    await writeYoklamaMap(merged);
    scheduleYoklamaMonthShardSync(merged);
    return {
      ok: true,
      personCount: countYoklamaPersons(merged),
      filledDayCount: countYoklamaFilledDays(merged),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Geri yükleme başarısız: ${msg}` };
  }
}
