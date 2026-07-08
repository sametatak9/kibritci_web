#!/usr/bin/env node
/**
 * firebase-target.config.json yoksa .env.local / .env içindeki VITE_FIREBASE_* ile oluşturur.
 */
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TARGET_PATH = resolve(ROOT, 'firebase-target.config.json');

dotenv.config({ path: resolve(ROOT, '.env.local') });
dotenv.config({ path: resolve(ROOT, '.env') });

function env(key) {
  const v = process.env[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

export function ensureTargetConfig() {
  if (existsSync(TARGET_PATH)) {
    const cfg = JSON.parse(readFileSync(TARGET_PATH, 'utf8'));
    if (cfg.apiKey && cfg.projectId === 'kibritci-erp') {
      return { ok: true, path: TARGET_PATH, source: 'file' };
    }
  }

  const cfg = {
    projectId: env('VITE_FIREBASE_PROJECT_ID') || 'kibritci-erp',
    apiKey: env('VITE_FIREBASE_API_KEY'),
    authDomain: env('VITE_FIREBASE_AUTH_DOMAIN'),
    storageBucket: env('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: env('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: env('VITE_FIREBASE_APP_ID'),
    measurementId: env('VITE_FIREBASE_MEASUREMENT_ID') || '',
    firestoreDatabaseId: env('VITE_FIREBASE_FIRESTORE_DATABASE_ID') || '',
  };

  const missing = ['apiKey', 'authDomain', 'storageBucket', 'messagingSenderId', 'appId'].filter(
    (k) => !cfg[k]
  );

  if (missing.length) {
    return {
      ok: false,
      missing,
      hint: 'Firebase Console > kibritci-erp > Project settings > Web app → firebase-target.config.json oluşturun',
    };
  }

  if (cfg.projectId !== 'kibritci-erp') {
    return { ok: false, hint: `VITE_FIREBASE_PROJECT_ID=${cfg.projectId} — kibritci-erp olmalı` };
  }

  writeFileSync(TARGET_PATH, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  return { ok: true, path: TARGET_PATH, source: 'env' };
}

if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '\0')) {
  const result = ensureTargetConfig();
  if (result.ok) {
    console.log(`firebase-target.config.json hazır (${result.source})`);
  } else {
    console.error('firebase-target.config.json eksik:', result.hint || result.missing?.join(', '));
    process.exit(1);
  }
}
