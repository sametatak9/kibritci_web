/**
 * Vercel Node function — üyelik şifresi (Express / serverless-http YOK).
 * Hobby plan maxDuration 10 (20 geçersiz sayılıp tüm deploy'u düşürebilir).
 * Yetki: JWT claim + kurucu e-posta; Firestore rolüne güvenilmez.
 */
'use strict';

const FOUNDER_EMAILS = new Set(['santiye@kibritci.com', 'sametatak9@gmail.com']);
const SECONDARY_ADMINS = new Set(['mudur@gmail.com']);
const ADMIN_ROLES = new Set(['KURUCU', 'YÖNETİCİ', 'YONETICI']);

function json(res, status, body) {
  res.status(status).json(body);
}

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function getBearerToken(req) {
  const header = String(req.headers.authorization || req.headers.Authorization || '');
  const m = header.match(/^Bearer\s+(.+)$/i);
  return (m && m[1] && m[1].trim()) || '';
}

function callerMayManage(decoded) {
  const email = normalizeEmail(decoded && decoded.email);
  if (FOUNDER_EMAILS.has(email) || SECONDARY_ADMINS.has(email)) return true;
  const role = String((decoded && (decoded.role || decoded.rol)) || '').toLocaleUpperCase('tr-TR');
  return ADMIN_ROLES.has(role);
}

function readJsonBody(req, timeoutMs) {
  const limit = timeoutMs || 4000;
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch {
      return Promise.reject(new Error('JSON gövde okunamadı'));
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('İstek gövdesi zaman aşımına uğradı'));
    }, limit);
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('JSON gövde okunamadı'));
      }
    });
    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    json(res, 200, { ok: true, route: 'update-user' });
    return;
  }
  if (req.method !== 'POST') {
    json(res, 405, { success: false, error: 'Yalnızca POST' });
    return;
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      json(res, 401, { success: false, error: 'Oturum doğrulanamadı.' });
      return;
    }

    let admin;
    try {
      admin = require('firebase-admin');
    } catch (err) {
      json(res, 503, {
        success: false,
        error: 'firebase-admin yüklenemedi.',
        detail: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    try {
      if (!admin.apps.length) {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (!raw) {
          json(res, 503, {
            success: false,
            error: 'Sunucu yapılandırması eksik (FIREBASE_SERVICE_ACCOUNT_JSON).',
          });
          return;
        }
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        admin.initializeApp({ credential: admin.credential.cert(parsed) });
      }
    } catch (err) {
      json(res, 503, {
        success: false,
        error: 'Firebase Admin başlatılamadı. FIREBASE_SERVICE_ACCOUNT_JSON geçersiz olabilir.',
        detail: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    const decoded = await admin.auth().verifyIdToken(token);
    if (!callerMayManage(decoded)) {
      json(res, 403, { success: false, error: 'Bu işlem için kurucu / yönetici yetkisi gerekir.' });
      return;
    }

    const body = await readJsonBody(req);
    const targetEmail = normalizeEmail(body.email);
    const newPassword = String(body.password || body.newPassword || '').trim();
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';

    if (!targetEmail || !targetEmail.includes('@')) {
      json(res, 400, { success: false, error: 'Geçerli e-posta gerekli.' });
      return;
    }
    if (newPassword.length < 6) {
      json(res, 400, { success: false, error: 'Yeni şifre en az 6 karakter olmalı.' });
      return;
    }

    const payload = { password: newPassword, emailVerified: true };
    if (displayName) payload.displayName = displayName;

    let uid;
    let created = false;
    try {
      const existing = await admin.auth().getUserByEmail(targetEmail);
      uid = existing.uid;
      await admin.auth().updateUser(uid, payload);
    } catch (err) {
      if (!err || err.code !== 'auth/user-not-found') throw err;
      const snap = await admin.firestore().collection('kullanicilar').doc(targetEmail).get();
      if (!snap.exists) {
        json(res, 404, {
          success: false,
          error: `${targetEmail} için ERP kullanıcı kaydı bulunamadı. Önce Admin panelden kullanıcı oluşturun.`,
        });
        return;
      }
      const createdUser = await admin.auth().createUser({
        email: targetEmail,
        password: newPassword,
        displayName: displayName || targetEmail,
        emailVerified: true,
      });
      uid = createdUser.uid;
      created = true;
    }

    json(res, 200, { success: true, uid, created, email: targetEmail });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Şifre güncellenemedi';
    const code = error && typeof error === 'object' && error.code ? String(error.code) : '';
    json(res, 500, { success: false, error: message, code: code || undefined });
  }
}

module.exports = handler;
module.exports.config = { maxDuration: 10 };
