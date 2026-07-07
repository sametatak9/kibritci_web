#!/usr/bin/env node
/**
 * Tüm kullanicilar icin Firebase Auth custom claims senkronize eder.
 * Gereksinim: FIREBASE_SERVICE_ACCOUNT_JSON ortam degiskeni
 *
 *   npm run auth:sync-claims
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnvLocal() {
  const envPath = resolve(ROOT, '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function normalizeRole(yetki) {
  if (!yetki) return 'MİSAFİR';
  let v = String(yetki).trim().toLocaleUpperCase('tr-TR');
  const aliases = {
    KAMPCI: 'KAMPÇI',
    KAMPCİ: 'KAMPÇI',
    GUVENLIK: 'GÜVENLİK',
    LOJISTIK: 'LOJİSTİK',
    DEPO: 'DEPOCU',
    ŞOFÖR: 'LOJİSTİK',
    SOFOR: 'LOJİSTİK',
  };
  return aliases[v] ?? v;
}

function buildClaims(email, data) {
  return {
    email: email.trim().toLowerCase(),
    role: normalizeRole(data.yetki || data.role),
    durum: String(data.durum || 'ONAY BEKLİYOR').trim(),
  };
}

loadEnvLocal();

const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
if (!json) {
  console.error('FIREBASE_SERVICE_ACCOUNT_JSON tanımlı değil (.env.local veya ortam değişkeni)');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)) });
const db = admin.firestore();
const authAdmin = admin.auth();

const snap = await db.collection('kullanicilar').get();
let ok = 0;
let fail = 0;

for (const docSnap of snap.docs) {
  const data = docSnap.data() || {};
  const email = String(data.email || docSnap.id).trim().toLowerCase();
  if (!email) continue;

  const claims = buildClaims(email, data);

  try {
    let uid;
    try {
      uid = (await authAdmin.getUserByEmail(email)).uid;
    } catch (err) {
      if (err?.code !== 'auth/user-not-found') throw err;
      console.warn(`  ATLA (Auth yok): ${email}`);
      fail += 1;
      continue;
    }
    await authAdmin.setCustomUserClaims(uid, claims);
    console.log(`OK  ${email} → ${claims.role} / ${claims.durum}`);
    ok += 1;
  } catch (err) {
    console.error(`HATA ${email}:`, err instanceof Error ? err.message : err);
    fail += 1;
  }
}

console.log(`\nTamamlandı: ${ok} başarılı, ${fail} atlandı/hata`);
