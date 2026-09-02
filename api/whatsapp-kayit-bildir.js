var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/server/whatsappKayitBildirHttp.ts
var whatsappKayitBildirHttp_exports = {};
__export(whatsappKayitBildirHttp_exports, {
  default: () => whatsappKayitBildirHandler
});
module.exports = __toCommonJS(whatsappKayitBildirHttp_exports);

// src/lib/roleClaims.ts
var FOUNDER_EMAILS = ["sametatak9@gmail.com", "santiye@kibritci.com"];
var PRIVILEGED_ADMIN_EMAILS = [
  ...FOUNDER_EMAILS,
  "mudur@gmail.com"
];

// src/lib/yetkiUtils.ts
var PORTAL_PAGES = [
  { key: "ana_sayfa", label: "Ana Sayfa Dashboard", group: "BA\u015ELANGI\xC7" },
  { key: "personel", label: "Personel Y\xF6netimi", group: "PERSONEL" },
  { key: "yoklama", label: "Yoklama ve Puantaj", group: "PERSONEL" },
  { key: "faaliyet_personel", label: "Faaliyeti Olan Personeller", group: "PERSONEL" },
  { key: "maas", label: "Maa\u015F Hesaplama & \xD6deme", group: "PERSONEL" },
  { key: "personel_izin", label: "Personel \u0130zin Formu", group: "PERSONEL" },
  { key: "grup_kopru", label: "Grup K\xF6pr\xFCs\xFC", group: "PERSONEL" },
  { key: "kasa", label: "Haftal\u0131k Kasa", group: "F\u0130NANS & ENVANTER" },
  { key: "satin_alma", label: "Sat\u0131n Alma Talep", group: "F\u0130NANS & ENVANTER" },
  { key: "siparis_formu", label: "Sipari\u015F Formu", group: "F\u0130NANS & ENVANTER" },
  { key: "irsaliye_fatura", label: "\u0130rsaliye & Fatura", group: "F\u0130NANS & ENVANTER" },
  { key: "t_cetveli", label: "T Cetveli", group: "F\u0130NANS & ENVANTER" },
  { key: "fatura_giris", label: "Fatura Giri\u015Fi", group: "F\u0130NANS & ENVANTER" },
  { key: "evrak_baglama", label: "Evrak Ba\u011Flama", group: "F\u0130NANS & ENVANTER" },
  { key: "evrak_etiketleri", label: "Evrak Etiketleri", group: "F\u0130NANS & ENVANTER" },
  { key: "taseron_kesinti", label: "Ta\u015Feron Y\xF6netimi", group: "F\u0130NANS & ENVANTER" },
  { key: "cari_stok", label: "Cari ve Stok Kartlar\u0131", group: "F\u0130NANS & ENVANTER" },
  { key: "kibar_hakedis", label: "ZER YAPI Hakedi\u015F", group: "F\u0130NANS & ENVANTER" },
  { key: "operator", label: "Operat\xF6r Faaliyetleri", group: "\u0130\u015E MAK\u0130NES\u0130 & OPERAT\xD6R" },
  { key: "arac", label: "Ara\xE7 ve Demirba\u015F", group: "\u0130DAR\u0130 \u0130\u015ELER & SAHA" },
  { key: "kamp", label: "Kamp Y\xF6netimi", group: "\u0130DAR\u0130 \u0130\u015ELER & SAHA" },
  { key: "saha", label: "Daily Saha Faaliyetleri", group: "\u0130DAR\u0130 \u0130\u015ELER & SAHA" },
  { key: "proje_ilerleme", label: "Proje \u0130lerlemesi", group: "\u0130DAR\u0130 \u0130\u015ELER & SAHA" },
  { key: "rapor_programlama", label: "Raporlama & Programlama", group: "\u0130DAR\u0130 \u0130\u015ELER & SAHA" },
  { key: "tutanak", label: "Haz\u0131r Tutanaklar", group: "\u0130DAR\u0130 \u0130\u015ELER & SAHA" },
  { key: "formen_ekrani", label: "Formen Mobil Paneli", group: "\u0130DAR\u0130 \u0130\u015ELER & SAHA" },
  { key: "guvenlik_ekrani", label: "G\xFCvenlik & Kap\u0131 Kontrol", group: "\u0130DAR\u0130 \u0130\u015ELER & SAHA" },
  { key: "kampci_ekrani", label: "Kamp\xE7\u0131 Mobil Paneli", group: "\u0130DAR\u0130 \u0130\u015ELER & SAHA" },
  { key: "tesisatci_ekrani", label: "Tesisat\xE7\u0131 Mobil Paneli", group: "\u0130DAR\u0130 \u0130\u015ELER & SAHA" },
  { key: "mermerci_ekrani", label: "Mermerci Mobil Paneli", group: "\u0130DAR\u0130 \u0130\u015ELER & SAHA" },
  { key: "seramik_ekrani", label: "G\xF6t\xFCr\xFC / Seramik Mobil Paneli", group: "\u0130DAR\u0130 \u0130\u015ELER & SAHA" },
  { key: "lojistik_ekrani", label: "\u015E\xF6f\xF6r Mobil Paneli", group: "\u0130DAR\u0130 \u0130\u015ELER & SAHA" },
  { key: "depocu_ekrani", label: "Depocu Mobil Paneli", group: "\u0130DAR\u0130 \u0130\u015ELER & SAHA" },
  { key: "onay_islemleri", label: "Onay Havuzu & \u0130mzalar", group: "RAPOR VE \u0130LET\u0130\u015E\u0130M" },
  { key: "admin", label: "\xDCyelik Onay & \u0130mza", group: "ADM\u0130N\u0130STRATOR" },
  { key: "yetki_verme", label: "Sayfa Yetkilendirme", group: "ADM\u0130N\u0130STRATOR" }
];
var NEVER_RESTRICT_TABS = ["ana_sayfa"];
var RESTRICTABLE_PORTAL_PAGES = PORTAL_PAGES.filter(
  (p) => !NEVER_RESTRICT_TABS.includes(p.key)
);
var MOBILE_ROLE_ALLOWED_TABS = {
  // Formen günlük planı yönetirken ana sayfadaki genel özeti de görebilir.
  FORMEN: ["ana_sayfa", "formen_ekrani", "faaliyet_personel", "proje_ilerleme", "rapor_programlama", "personel", "siparis_formu"],
  G\u00DCVENL\u0130K: ["guvenlik_ekrani", "siparis_formu"],
  KAMP\u00C7I: ["kampci_ekrani", "siparis_formu"],
  TES\u0130SAT\u00C7I: ["tesisatci_ekrani", "siparis_formu"],
  MERMERC\u0130: ["mermerci_ekrani", "siparis_formu"],
  G\u00D6T\u00DCR\u00DC: ["seramik_ekrani", "siparis_formu"],
  LOJ\u0130ST\u0130K: ["lojistik_ekrani", "siparis_formu"],
  OPERAT\u00D6R: ["operator", "siparis_formu"],
  DEPOCU: ["depocu_ekrani", "siparis_formu"],
  ANAHTARCI: ["siparis_formu"]
};
var MOBILE_ROLE_HOME_TAB = Object.fromEntries(
  Object.entries(MOBILE_ROLE_ALLOWED_TABS).map(([role, tabs]) => [role, tabs[0]])
);

// src/lib/taseronGrupSablon.ts
var TASERON_GRUP_WP_HAT = "0501 683 3400";
function taseronGrupWpHatE164() {
  const digits = TASERON_GRUP_WP_HAT.replace(/\D/g, "");
  if (digits.startsWith("90")) return digits;
  return `90${digits.replace(/^0/, "")}`;
}

// src/lib/whatsappKayitBildirim.ts
function isWhatsAppCloudSendConfigured() {
  return Boolean(
    String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim() && String(process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim()
  );
}
function waSenderToE164(gonderen) {
  const raw = String(gonderen || "").trim();
  if (!raw) return null;
  const wa = raw.match(/wa:(\+?\d{8,20})/i);
  const digits = (wa ? wa[1] : raw).replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;
  return digits;
}
function buildPersonelKayitAcildiText(opts) {
  const name = String(opts.personelIsim || `${opts.ad || ""} ${opts.soyad || ""}`).replace(/\s+/g, " ").trim().toLocaleUpperCase("tr-TR");
  const firma = String(opts.firmaAdi || "").replace(/\s+/g, " ").trim().toLocaleUpperCase("tr-TR") || "\u2014";
  const kim = name || "PERSONEL";
  if (opts.yon === "cikis") {
    return `${kim} personeli ${firma} firmas\u0131nda kayd\u0131 kapat\u0131ld\u0131.`;
  }
  return `${kim} personeli ${firma} firmas\u0131nda kayd\u0131 a\xE7\u0131ld\u0131.`;
}
function uniqueWhatsAppNotifyTargets(opts) {
  const own = String(opts.ownHatE164 || "").replace(/\D/g, "");
  const extraEnv = String(process.env.WHATSAPP_NOTIFY_TO || opts.extraTo || "");
  const candidates = [waSenderToE164(opts.gonderen), waSenderToE164(extraEnv)].filter(
    (n) => Boolean(n)
  );
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const n of candidates) {
    if (own && n === own) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}
async function sendWhatsAppCloudText(opts) {
  const token = String(opts.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
  const phoneId = String(opts.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const to = String(opts.to || "").replace(/\D/g, "");
  if (!token || !phoneId) {
    return { ok: false, status: 503, detail: "WHATSAPP_ACCESS_TOKEN veya WHATSAPP_PHONE_NUMBER_ID yok" };
  }
  if (!to) return { ok: false, status: 400, detail: "al\u0131c\u0131 yok" };
  const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: String(opts.body || "").slice(0, 4096) }
    })
  });
  const raw = await res.text().catch(() => "");
  if (!res.ok) {
    return { ok: false, status: res.status, detail: raw.slice(0, 300) };
  }
  return { ok: true, status: res.status };
}

// src/server/nodeHttpUtil.ts
function sendJson(res, status, body) {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
function getBearerToken(req) {
  const header = String(req.headers.authorization || "").trim();
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m && m[1] && m[1].trim() || "";
}
async function readJsonBody(req, timeoutMs = 8e3) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === "string" && req.body.trim()) {
    return JSON.parse(req.body);
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("\u0130stek g\xF6vdesi zaman a\u015F\u0131m\u0131na u\u011Frad\u0131"));
    }, timeoutMs);
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("JSON g\xF6vde okunamad\u0131"));
      }
    });
    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

// src/server/whatsappKayitBildirHttp.ts
var FIREBASE_WEB_API_KEY = "AIzaSyC7DIWBLXrkdDMIufYK_jEnSOjQ7XZQ6VI";
var FOUNDER_EMAILS2 = /* @__PURE__ */ new Set(["santiye@kibritci.com", "sametatak9@gmail.com", "mudur@gmail.com"]);
var ADMIN_ROLES = /* @__PURE__ */ new Set(["KURUCU", "Y\xD6NET\u0130C\u0130", "YONETICI"]);
function callerMayNotify(decoded) {
  const email = String(decoded.email || "").trim().toLowerCase();
  if (FOUNDER_EMAILS2.has(email)) return true;
  const role = String(decoded.role || decoded.rol || "").toLocaleUpperCase("tr-TR");
  return ADMIN_ROLES.has(role);
}
function decodeJwtPayload(token) {
  const part = token.split(".")[1];
  if (!part) return {};
  const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return JSON.parse(json);
}
async function verifyFirebaseIdToken(idToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    }
  );
  if (!res.ok) {
    throw new Error("Oturum do\u011Frulanamad\u0131.");
  }
  const data = await res.json();
  const email = String(data.users?.[0]?.email || "").trim().toLowerCase();
  if (!email) throw new Error("Oturum e-postas\u0131 yok.");
  const payload = decodeJwtPayload(idToken);
  return { ...payload, email };
}
async function whatsappKayitBildirHandler(req, res) {
  const method = String(req.method || "GET").toUpperCase();
  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (method === "GET" || method === "HEAD") {
    sendJson(res, 200, {
      ok: true,
      route: "whatsapp-kayit-bildir",
      sendConfigured: isWhatsAppCloudSendConfigured()
    });
    return;
  }
  if (method !== "POST") {
    sendJson(res, 405, { error: "Yaln\u0131zca POST" });
    return;
  }
  try {
    const token = getBearerToken(req);
    if (!token) {
      sendJson(res, 401, { success: false, error: "Oturum do\u011Frulanamad\u0131." });
      return;
    }
    const decoded = await verifyFirebaseIdToken(token);
    if (!callerMayNotify(decoded)) {
      sendJson(res, 403, { success: false, error: "Bu i\u015Flem i\xE7in kurucu / y\xF6netici yetkisi gerekir." });
      return;
    }
    if (!isWhatsAppCloudSendConfigured()) {
      sendJson(res, 503, {
        success: false,
        error: "WhatsApp g\xF6nderimi yap\u0131land\u0131r\u0131lmam\u0131\u015F. Vercel\u2019de WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID gerekir.",
        skipped: true
      });
      return;
    }
    const body = await readJsonBody(req, 4e3);
    const yon = String(body.yon || "giris") === "cikis" ? "cikis" : "giris";
    const text = buildPersonelKayitAcildiText({
      ad: String(body.ad || ""),
      soyad: String(body.soyad || ""),
      personelIsim: String(body.personelIsim || ""),
      firmaAdi: String(body.firmaAdi || ""),
      yon
    });
    const targets = uniqueWhatsAppNotifyTargets({
      gonderen: String(body.gonderen || ""),
      ownHatE164: taseronGrupWpHatE164()
    });
    if (!targets.length) {
      sendJson(res, 200, {
        success: true,
        skipped: true,
        reason: "wa: g\xF6nderen yok (Cloud API WhatsApp grubuna yazamaz)",
        text
      });
      return;
    }
    const results = [];
    for (const to of targets) {
      results.push({ to, ...await sendWhatsAppCloudText({ to, body: text }) });
    }
    sendJson(res, 200, { success: true, text, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bildirim g\xF6nderilemedi";
    sendJson(res, 500, { success: false, error: message });
  }
}
(() => {
  const exp = module.exports;
  const fn =
    exp && typeof exp.default === "function" ? exp.default
    : exp && typeof exp.vercelExpressHandler === "function" ? exp.vercelExpressHandler
    : exp;
  if (typeof fn === "function") {
    module.exports = function vercelNodeHandler(req, res) { return fn(req, res); };
  }
})();
//# sourceMappingURL=whatsapp-kayit-bildir.js.map
