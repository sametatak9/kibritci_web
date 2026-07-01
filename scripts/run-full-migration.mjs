#!/usr/bin/env node
/**
 * Güvenli geçiş orkestrasyonu — canlı Render env değiştirilmez.
 * 1. Hedef config kontrol
 * 2. Kaynak audit
 * 3. Dry-run
 * 4. Kopyala
 * 5. Doğrula
 */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureTargetConfig } from './ensure-target-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function run(label, args) {
  console.log(`\n>>> ${label}`);
  const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit', shell: false });
  if (r.status !== 0) {
    console.error(`\nHATA: ${label} başarısız (kod ${r.status})`);
    process.exit(r.status ?? 1);
  }
}

console.log('=== Kibritçi ERP — Firebase güvenli taşıma ===\n');

const cfg = ensureTargetConfig();
if (!cfg.ok) {
  console.error('\nEksik yapılandırma:', cfg.hint || cfg.missing);
  console.error(`
Firebase Console → kibritci-erp → Project settings → Web app
Değerleri firebase-target.config.json dosyasına kaydedin (gitignore'da).

Veya .env.local içine VITE_FIREBASE_* tanımlayın.
`);
  process.exit(1);
}
console.log(`Hedef config: ${cfg.path} (${cfg.source})`);

const migrate = resolve(ROOT, 'scripts/migrate-firestore.mjs');

run('Kaynak denetim', [migrate, '--audit-only']);
run('Dry-run simülasyon', [migrate, '--dry-run']);
run('Veri kopyalama', [migrate, '--execute']);
run('Doğrulama', [migrate, '--verify-only']);

console.log(`
=== Taşıma tamam ===

Sonraki adımlar (canlı geçiş):
1. Render Dashboard → kibritci-erp → Environment
2. VITE_FIREBASE_* değerlerini firebase-target.config.json ile aynı yapın
3. VITE_FIREBASE_FIRESTORE_DATABASE_ID → boş bırakın
4. Manual Deploy
5. Konsol: [Firebase] projectId=kibritci-erp

Geri alma: Render env sil → deploy → learned-spark-25xj8
`);
