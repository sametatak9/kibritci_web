/**
 * Kurucu / üyelik yetkisi iddiaları.
 * Çalıştır: npx tsx src/lib/roleClaims.assert.ts
 */
import {
  callerCanManageAuthUsers,
  isFounderEmail,
  isPortalAdminRole,
  isPrivilegedAdminEmail,
  normalizeClaimRole,
} from './roleClaims';
import { canAccessUyelikAdminPanel } from './yetkiUtils';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isFounderEmail('sametatak9@gmail.com'), 'samet kurucu');
assert(isFounderEmail('SametAtak9@Gmail.com'), 'kurucu e-posta case-insensitive');
assert(isFounderEmail('santiye@kibritci.com'), 'şantiye kurucu');
assert(!isFounderEmail('formen.test@kibritci.com'), 'formen kurucu değil');

assert(isPrivilegedAdminEmail('mudur@gmail.com'), 'müdür ayrıcalıklı');
assert(isPrivilegedAdminEmail('SANTIYE@kibritci.com'), 'şantiye ayrıcalıklı');

assert(isPortalAdminRole('KURUCU'), 'KURUCU portal admin');
assert(isPortalAdminRole('YÖNETİCİ'), 'YÖNETİCİ portal admin');
assert(isPortalAdminRole('YONETICI') === false || normalizeClaimRole('YÖNETİCİ') === 'YÖNETİCİ', 'normalize');
assert(!isPortalAdminRole('FORMEN'), 'formen portal admin değil');
assert(!isPortalAdminRole('MİSAFİR'), 'misafir portal admin değil');

assert(
  callerCanManageAuthUsers({ email: 'sametatak9@gmail.com', role: 'MİSAFİR' }),
  'kurucu e-posta claim olmasa da üyelik yönetir'
);
assert(
  callerCanManageAuthUsers({ email: 'santiye@kibritci.com', role: 'KURUCU' }),
  'şantiye kurucu üyelik yönetir'
);
assert(
  callerCanManageAuthUsers({ email: 'SANTIYE@KIBRITCI.COM', role: '' }),
  'şantiye e-posta büyük harf'
);
assert(
  callerCanManageAuthUsers({ email: 'idari@kibritci.com', role: 'KURUCU' }),
  'KURUCU claim e-posta bağımsız yönetir'
);
assert(
  callerCanManageAuthUsers({ email: 'mudur@gmail.com', role: 'MUHASEBE' }),
  'müdür e-posta üyelik yönetir'
);
assert(
  !callerCanManageAuthUsers({ email: 'formen.test@kibritci.com', role: 'FORMEN' }),
  'formen üyelik yönetemez'
);

assert(canAccessUyelikAdminPanel('KURUCU'), 'KURUCU üyelik paneli');
assert(canAccessUyelikAdminPanel('YÖNETİCİ'), 'YÖNETİCİ üyelik paneli');
assert(canAccessUyelikAdminPanel('FORMEN') === false, 'formen üyelik paneli yok');
assert(canAccessUyelikAdminPanel('FORMEN', { isPrivilegedAdmin: true }), 'ayrıcalıklı admin override');
assert(canAccessUyelikAdminPanel('İDARİ_İŞLER'), 'idari işler üyelik paneli');

const sw = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../public/sw.js'), 'utf8');
assert(sw.includes("url.pathname.startsWith('/api/')"), 'SW /api isteklerini yakalamaz');
assert(sw.includes("method !== 'GET'"), 'SW POST yakalamaz');
assert(!/cache:\s*['"]no-store['"]/.test(sw), 'SW POST+no-store yok');

console.log('roleClaims.assert.ts OK');
