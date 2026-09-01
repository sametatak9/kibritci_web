var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/lib/roleClaims.ts
function isFounderEmail(email) {
  const key = email?.trim().toLowerCase() || "";
  return FOUNDER_EMAILS.includes(key);
}
function getFounderCanonicalPassword(email) {
  return FOUNDER_PASSWORDS[email.trim().toLowerCase()];
}
function verifyFounderCredentials(email, password) {
  const key = email.trim().toLowerCase();
  const aliases = FOUNDER_PASSWORD_ALIASES[key];
  if (aliases) return aliases.includes(password);
  return FOUNDER_PASSWORDS[key] === password;
}
function normalizeClaimRole(yetki) {
  if (!yetki) return "M\u0130SAF\u0130R";
  let v = String(yetki).trim().toLocaleUpperCase("tr-TR");
  const aliases = {
    KAMPCI: "KAMP\xC7I",
    KAMPC\u0130: "KAMP\xC7I",
    GUVENLIK: "G\xDCVENL\u0130K",
    LOJISTIK: "LOJ\u0130ST\u0130K",
    DEPO: "DEPOCU",
    \u015E\u00D6F\u00D6R: "LOJ\u0130ST\u0130K",
    \u015EOF\u00D6R: "LOJ\u0130ST\u0130K",
    SOF\u00D6R: "LOJ\u0130ST\u0130K",
    SOFOR: "LOJ\u0130ST\u0130K",
    DRIVER: "LOJ\u0130ST\u0130K",
    TESISATCI: "TES\u0130SAT\xC7I",
    TES\u0130SATCI: "TES\u0130SAT\xC7I",
    MERMERCI: "MERMERC\u0130",
    GOTURU: "G\xD6T\xDCR\xDC",
    G\u00D6TURU: "G\xD6T\xDCR\xDC",
    SERAMIK: "G\xD6T\xDCR\xDC",
    SERAM\u0130K: "G\xD6T\xDCR\xDC",
    OPERATOR: "OPERAT\xD6R",
    OPERAT\u00D6R: "OPERAT\xD6R"
  };
  return aliases[v] ?? v;
}
function normalizeClaimDurum(durum) {
  const raw = String(durum || "ONAY BEKL\u0130YOR").trim();
  if (!raw) return "ONAY BEKL\u0130YOR";
  const upper = raw.toLocaleUpperCase("tr-TR");
  const compact = upper.replace(/\s+/g, "");
  if (compact === "AKT\u0130F" || compact === "AKTIF" || compact === "ACTIVE") return "AKT\u0130F";
  if (compact === "KISITLI" || compact.replace(/İ/g, "I") === "KISITLI") return "KISITLI";
  if (upper.includes("ONAY") && upper.includes("BEK")) return "ONAY BEKL\u0130YOR";
  return upper;
}
function buildAuthCustomClaims(input) {
  const email = input.email.trim().toLowerCase();
  return {
    email,
    role: normalizeClaimRole(input.yetki),
    durum: normalizeClaimDurum(input.durum)
  };
}
var FOUNDER_EMAILS, FOUNDER_PASSWORDS, FOUNDER_PASSWORD_ALIASES;
var init_roleClaims = __esm({
  "src/lib/roleClaims.ts"() {
    FOUNDER_EMAILS = ["sametatak9@gmail.com", "santiye@kibritci.com"];
    FOUNDER_PASSWORDS = {
      "sametatak9@gmail.com": "117270.Sametatak",
      "santiye@kibritci.com": "kibritci2026"
    };
    FOUNDER_PASSWORD_ALIASES = {
      "sametatak9@gmail.com": ["117270.Sametatak", "117270Sa"],
      "santiye@kibritci.com": ["kibritci2026"]
    };
  }
});

// src/lib/dateKeyUtils.ts
var init_dateKeyUtils = __esm({
  "src/lib/dateKeyUtils.ts"() {
  }
});

// src/lib/gorevUtils.ts
var init_gorevUtils = __esm({
  "src/lib/gorevUtils.ts"() {
  }
});

// src/lib/yoklamaUtils.ts
function parseFlexibleDateParts(raw) {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  const ymd = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }
  const dmy = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }
  const dm = v.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]);
    const year = 2024;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }
  return null;
}
function isDateInEmploymentRange(p, year, month, day) {
  const currentDateVal = year * 1e4 + month * 100 + day;
  const hireTarih = p.iseGirisTarihi || p.girisTarihi || p.kayitTarihi;
  const hire = parseFlexibleDateParts(hireTarih);
  if (hire) {
    const hireDateVal = hire.year * 1e4 + hire.month * 100 + hire.day;
    if (currentDateVal < hireDateVal) return false;
  }
  const exitTarih = p.istenCikisTarihi || p.cikisTarihi;
  const exit = parseFlexibleDateParts(exitTarih);
  if (exit) {
    const exitDateVal = exit.year * 1e4 + exit.month * 100 + exit.day;
    if (currentDateVal > exitDateVal) return false;
  }
  return true;
}
function isDayActiveForPersonel(p, year, month, day, _personMap) {
  return isDateInEmploymentRange(p, year, month, day);
}
function normalizeCompanyName(name) {
  return String(name || "").toLocaleUpperCase("tr-TR").replace(/İ/g, "I").replace(/Ş/g, "S").replace(/Ğ/g, "G").replace(/Ü/g, "U").replace(/Ö/g, "O").replace(/Ç/g, "C").replace(/\s+/g, " ").trim();
}
function isKibritciCompany(name) {
  const n = normalizeCompanyName(name);
  return !n || n.includes("KIBRITCI");
}
function isAnaFirmaFirmaAdi(name) {
  const raw = String(name || "").trim();
  if (!raw) return true;
  const upper = raw.toLocaleUpperCase("tr-TR");
  if (upper === "ANA F\u0130RMA" || upper === "ANA FIRMA") return true;
  return isKibritciCompany(raw);
}
function isTaseronPersonel(p) {
  if (!p) return false;
  if (p.firmaTipi === "TASERON") return true;
  const firmaAdi = String(p.firmaAdi || "").trim();
  if (!firmaAdi) return false;
  if (isAnaFirmaFirmaAdi(firmaAdi)) return false;
  return !isKibritciCompany(firmaAdi);
}
var init_yoklamaUtils = __esm({
  "src/lib/yoklamaUtils.ts"() {
  }
});

// src/lib/yetkiUtils.ts
var PORTAL_PAGES, NEVER_RESTRICT_TABS, RESTRICTABLE_PORTAL_PAGES, MOBILE_ROLE_ALLOWED_TABS, MOBILE_ROLE_HOME_TAB;
var init_yetkiUtils = __esm({
  "src/lib/yetkiUtils.ts"() {
    PORTAL_PAGES = [
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
    NEVER_RESTRICT_TABS = ["ana_sayfa"];
    RESTRICTABLE_PORTAL_PAGES = PORTAL_PAGES.filter(
      (p) => !NEVER_RESTRICT_TABS.includes(p.key)
    );
    MOBILE_ROLE_ALLOWED_TABS = {
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
    MOBILE_ROLE_HOME_TAB = Object.fromEntries(
      Object.entries(MOBILE_ROLE_ALLOWED_TABS).map(([role, tabs]) => [role, tabs[0]])
    );
  }
});

// src/lib/mobilOnayUtils.ts
var init_mobilOnayUtils = __esm({
  "src/lib/mobilOnayUtils.ts"() {
    init_yetkiUtils();
  }
});

// src/lib/guvenlikHelpers.ts
function isAkvizyonFirmaAdi(name) {
  const n = String(name || "").toLocaleUpperCase("tr-TR").replace(/İ/g, "I").replace(/Ş/g, "S").replace(/Ğ/g, "G").replace(/Ü/g, "U").replace(/Ö/g, "O").replace(/Ç/g, "C").replace(/\s+/g, " ").trim();
  return n.includes("AKVIZYON");
}
function isAkvizyonPersonel(p) {
  if (!p) return false;
  if (!isTaseronPersonel(p)) return false;
  return isAkvizyonFirmaAdi(p.firmaAdi);
}
function isPersonelActiveOnDate(p, dateStr) {
  const parts = String(dateStr || "").split("-").map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return true;
  const [y, m, d] = parts;
  return isDayActiveForPersonel(p, y, m, d);
}
var init_guvenlikHelpers = __esm({
  "src/lib/guvenlikHelpers.ts"() {
    init_dateKeyUtils();
    init_gorevUtils();
    init_yoklamaUtils();
    init_roleClaims();
    init_mobilOnayUtils();
  }
});

// src/lib/akvizyonNobetAutoArchive.ts
var akvizyonNobetAutoArchive_exports = {};
__export(akvizyonNobetAutoArchive_exports, {
  AKVIZYON_NOBET_KAPANIS_SAAT: () => AKVIZYON_NOBET_KAPANIS_SAAT,
  buildAkvizyonOtomatikKapanisPayload: () => buildAkvizyonOtomatikKapanisPayload,
  collectAkvizyonPersonelForDate: () => collectAkvizyonPersonelForDate,
  finalizeAkvizyonYoklamaMap: () => finalizeAkvizyonYoklamaMap,
  getIstanbulDateParts: () => getIstanbulDateParts,
  isAkvizyonNobetKapanisZamaniGecti: () => isAkvizyonNobetKapanisZamaniGecti,
  isAkvizyonNobetKilitli: () => isAkvizyonNobetKilitli,
  istanbulTodayKey: () => istanbulTodayKey,
  shouldAutoCloseAkvizyonNobet: () => shouldAutoCloseAkvizyonNobet
});
function getIstanbulDateParts(now = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value || "00";
  const dateKey = `${get("year")}-${get("month")}-${get("day")}`;
  return {
    dateKey,
    hour: Number(get("hour")),
    minute: Number(get("minute"))
  };
}
function istanbulTodayKey(now = /* @__PURE__ */ new Date()) {
  return getIstanbulDateParts(now).dateKey;
}
function isAkvizyonNobetKapanisZamaniGecti(tarih, now = /* @__PURE__ */ new Date()) {
  const { dateKey, hour, minute } = getIstanbulDateParts(now);
  if (tarih < dateKey) return true;
  if (tarih > dateKey) return false;
  return hour > AKVIZYON_NOBET_KAPANIS_SAAT || hour === AKVIZYON_NOBET_KAPANIS_SAAT && minute >= 0;
}
function isAkvizyonNobetKilitli(doc) {
  return Boolean(doc?.kilitli || doc?.otomatikKapanis);
}
function collectAkvizyonPersonelForDate(personeller, tarih) {
  return (personeller || []).filter(
    (p) => isAkvizyonPersonel(p) && isPersonelActiveOnDate(p, tarih)
  );
}
function finalizeAkvizyonYoklamaMap(personelIds, existing) {
  const next = { ...existing || {} };
  for (const id of personelIds) {
    if (!next[id]) next[id] = "Gelmedi";
  }
  return next;
}
function buildAkvizyonOtomatikKapanisPayload(options) {
  const nowIso = options.nowIso || (/* @__PURE__ */ new Date()).toISOString();
  const yoklama = finalizeAkvizyonYoklamaMap(
    options.personelIds,
    options.existing?.yoklama
  );
  return {
    id: options.tarih,
    tarih: options.tarih,
    kayitZamani: options.existing?.kayitZamani || nowIso,
    kaydeden: options.existing?.kaydeden || options.kaydeden || "sistem_otomatik",
    yoklama,
    kilitli: true,
    otomatikKapanis: true,
    kapanisZamani: nowIso,
    kapanisSaati: AKVIZYON_NOBET_KAPANIS_SAAT,
    notlar: options.existing?.notlar || `Akvizyon grup n\xF6beti saat ${AKVIZYON_NOBET_KAPANIS_SAAT}:00'da otomatik kapat\u0131l\u0131p ar\u015Fivlendi.`
  };
}
function shouldAutoCloseAkvizyonNobet(tarih, existing, now = /* @__PURE__ */ new Date()) {
  if (!isAkvizyonNobetKapanisZamaniGecti(tarih, now)) return false;
  if (isAkvizyonNobetKilitli(existing)) return false;
  return true;
}
var AKVIZYON_NOBET_KAPANIS_SAAT;
var init_akvizyonNobetAutoArchive = __esm({
  "src/lib/akvizyonNobetAutoArchive.ts"() {
    init_guvenlikHelpers();
    AKVIZYON_NOBET_KAPANIS_SAAT = 21;
  }
});

// api/handler.ts
var import_express = __toESM(require("express"));

// src/server/registerApiRoutes.ts
var import_genai4 = require("@google/genai");

// src/server/gemini.ts
var import_genai = require("@google/genai");
var aiClient = null;
function resolveGeminiApiKey() {
  const raw = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!raw) return void 0;
  return raw.trim().replace(/^['"]|['"]$/g, "");
}
function getAllGeminiApiKeys() {
  const keys = [];
  const raw1 = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (raw1) {
    const split = raw1.split(/[,|]/).map((k) => k.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
    keys.push(...split);
  }
  for (let i = 2; i <= 5; i++) {
    const raw = process.env[`GEMINI_API_KEY_${i}`];
    if (raw) {
      const k = raw.trim().replace(/^['"]|['"]$/g, "");
      if (k && !keys.includes(k)) keys.push(k);
    }
  }
  return keys;
}
function detectGeminiKeyFormat(key) {
  if (!key) return "missing";
  if (key.startsWith("AQ.")) return "auth";
  if (key.startsWith("AIza")) return "standard";
  return "unknown";
}
function getGeminiKeyInfo() {
  const key = resolveGeminiApiKey();
  const format = detectGeminiKeyFormat(key);
  if (!key) return { format: "missing", preview: "(tan\u0131ms\u0131z)", length: 0 };
  const visible = key.length <= 12 ? "***" : `${key.slice(0, 6)}\u2026${key.slice(-4)}`;
  return { format, preview: visible, length: key.length };
}
function formatGeminiKeyHint(format) {
  switch (format) {
    case "auth":
      return "Auth key (AQ.\u2026) \u2014 Google AI Studio'nun yeni format\u0131, ge\xE7erlidir.";
    case "standard":
      return "Standard key (AIza\u2026) \u2014 K\u0131s\u0131tlamas\u0131z eski anahtarlar 19 Haziran 2026'dan itibaren reddedilir. Auth key (AQ.) kullan\u0131n.";
    case "unknown":
      return "Anahtar format\u0131 tan\u0131nmad\u0131. https://aistudio.google.com/apikey adresinden yeni key olu\u015Fturun.";
    default:
      return "GEMINI_API_KEY ortam de\u011Fi\u015Fkeni tan\u0131ml\u0131 de\u011Fil.";
  }
}
function parseGeminiError(error) {
  const raw = error instanceof Error ? error.message : String(error);
  let msg = raw;
  try {
    const parsed = JSON.parse(raw);
    const inner = parsed?.error?.message ?? parsed?.message;
    if (typeof inner === "string") msg = inner;
  } catch {
  }
  if (/429|RESOURCE_EXHAUSTED|quota exceeded|exceeded your current quota|prepayment credits are depleted|billing#prepay/i.test(msg)) {
    const modelMatch = msg.match(/model:\s*([\w.-]+)/i);
    const model = modelMatch?.[1] ?? "Gemini";
    return [
      `Gemini API kredisi/kotas\u0131 t\xFCkendi (${model}).`,
      "prepayment credits depleted hatas\u0131, proje bakiyesinin bitti\u011Fini g\xF6sterir.",
      "\u2022 Google AI Studio \u2192 Projects \u2192 Billing b\xF6l\xFCm\xFCnden bakiye/faturaland\u0131rma a\xE7\u0131n",
      "\u2022 Sonra Render/Vercel \xFCzerinde redeploy yap\u0131n",
      "\u2022 Detay: https://ai.google.dev/gemini-api/docs/billing#prepay"
    ].join("\n");
  }
  if (/Request had invalid authentication credentials|Expected OAuth 2 access token|invalid authentication credentials|API key not valid|invalid.?api.?key|401|403|PERMISSION_DENIED/i.test(msg)) {
    return [
      "Gemini API anahtar\u0131 reddedildi.",
      "\u2022 AI Studio'dan yeni Auth key (AQ.\u2026) olu\u015Fturun: https://aistudio.google.com/apikey",
      "\u2022 Render/Vercel: Environment Variables \u2192 GEMINI_API_KEY (t\u0131rnaks\u0131z, bo\u015Fluksuz)",
      "\u2022 De\u011Fi\u015Fiklikten sonra redeploy yap\u0131n",
      "\u2022 Eski AIza anahtar\u0131 k\u0131s\u0131tlamas\u0131zsa art\u0131k \xE7al\u0131\u015Fmaz \u2014 Auth key kullan\u0131n"
    ].join("\n");
  }
  if (/GEMINI_API_KEY|GOOGLE_API_KEY/i.test(msg)) {
    return msg;
  }
  return msg;
}
function getGeminiClient() {
  if (!aiClient) {
    const key = resolveGeminiApiKey();
    if (!key) {
      throw new Error(
        "GEMINI_API_KEY tan\u0131ml\u0131 de\u011Fil. Yerelde .env.local dosyas\u0131na, Vercel'de Project Settings \u2192 Environment Variables b\xF6l\xFCm\xFCne ekleyin."
      );
    }
    const format = detectGeminiKeyFormat(key);
    if (format === "unknown") {
      throw new Error(
        `GEMINI_API_KEY format\u0131 tan\u0131nm\u0131yor (${key.slice(0, 8)}\u2026). AI Studio'dan yeni key al\u0131n: https://aistudio.google.com/apikey`
      );
    }
    aiClient = new import_genai.GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}
async function testGeminiConnection() {
  const keyInfo = getGeminiKeyInfo();
  if (keyInfo.format === "missing") {
    return { ok: false, keyInfo, error: formatGeminiKeyHint("missing") };
  }
  try {
    const ai = getGeminiClient();
    let lastError = null;
    const modelsToTest = [
      "gemini-flash-lite-latest",
      "gemini-flash-latest",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash-latest",
      "gemini-2.0-flash"
    ];
    for (const model of modelsToTest) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: "Reply with exactly: OK",
          config: { maxOutputTokens: 128, temperature: 0 }
        });
        const text = response.text?.trim();
        if (text) {
          return { ok: true, keyInfo, modelResponse: `${text} (${model})` };
        }
      } catch (err) {
        lastError = err;
        console.warn(`Gemini test model ${model} failed:`, err);
      }
    }
    return { ok: false, keyInfo, error: parseGeminiError(lastError) };
  } catch (err) {
    return { ok: false, keyInfo, error: parseGeminiError(err) };
  }
}

// src/server/geminiGenerate.ts
var import_genai2 = require("@google/genai");
var IS_VERCEL = Boolean(process.env.VERCEL);
var GEMINI_MODEL_FALLBACK = [
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash-latest",
  "gemini-2.0-flash"
];
var ATTEMPT_TIMEOUT_MS = IS_VERCEL ? 9e3 : 45e3;
var modelQuotaBlacklist = /* @__PURE__ */ new Map();
function isModelBlacklisted(model, apiKey) {
  const key = `${apiKey.slice(0, 10)}_${model}`;
  const until = modelQuotaBlacklist.get(key);
  if (!until) return false;
  if (Date.now() > until) {
    modelQuotaBlacklist.delete(key);
    return false;
  }
  return true;
}
function blacklistModel(model, apiKey) {
  const key = `${apiKey.slice(0, 10)}_${model}`;
  modelQuotaBlacklist.set(key, Date.now() + 5 * 60 * 1e3);
}
function isQuotaOrExhaustedError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  const status = err?.status;
  return status === 429 || /429|RESOURCE_EXHAUSTED|quota exceeded|exceeded your current quota|limit: 0|prepayment credits/i.test(msg);
}
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(
        new Error(
          `${label} ${Math.round(ms / 1e3)} sn i\xE7inde yan\u0131t vermedi. Sunucu zaman a\u015F\u0131m\u0131n\u0131 \xF6nlemek i\xE7in i\u015Flem durduruldu.`
        )
      ),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
async function generateGeminiWithFallback(options) {
  const keys = getAllGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error(
      "GEMINI_API_KEY ortam de\u011Fi\u015Fkeni tan\u0131ml\u0131 de\u011Fil. L\xFCtfen .env.local veya Render/Vercel ortam de\u011Fi\u015Fkenlerine ekleyin."
    );
  }
  const label = options.label || "Yapay zeka analizi";
  let lastError = null;
  for (const apiKey of keys) {
    const ai = new import_genai2.GoogleGenAI({ apiKey });
    for (const model of GEMINI_MODEL_FALLBACK) {
      if (isModelBlacklisted(model, apiKey)) {
        continue;
      }
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model,
            contents: options.contents,
            config: options.config
          }),
          ATTEMPT_TIMEOUT_MS,
          label
        );
        const text = response.text?.trim();
        if (text) {
          return { text, model };
        }
        throw new Error("Yapay zeka bo\u015F yan\u0131t d\xF6nd\xFCrd\xFC");
      } catch (err) {
        lastError = err;
        console.warn(`[Gemini Fallback] '${model}' denenirken hata olu\u015Ftu:`, err?.message || err);
        if (isQuotaOrExhaustedError(err)) {
          blacklistModel(model, apiKey);
        }
      }
    }
  }
  if (lastError instanceof Error) {
    throw new Error(parseGeminiError(lastError));
  }
  throw new Error(parseGeminiError(lastError));
}

// src/server/pendingSignupsStore.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var DATA_FILE = import_path.default.join(process.cwd(), "data", "pending-signups.json");
function ensureDir() {
  import_fs.default.mkdirSync(import_path.default.dirname(DATA_FILE), { recursive: true });
}
function readPendingSignups() {
  try {
    if (!import_fs.default.existsSync(DATA_FILE)) return [];
    const raw = import_fs.default.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writePendingSignups(items) {
  ensureDir();
  import_fs.default.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), "utf8");
}
function upsertPendingSignup(record) {
  const emailKey = record.email.trim().toLowerCase();
  const normalized = { ...record, id: emailKey, email: emailKey };
  const items = readPendingSignups().filter((x) => x.email !== emailKey);
  items.push(normalized);
  writePendingSignups(items);
  return normalized;
}
function deletePendingSignup(email) {
  const emailKey = email.trim().toLowerCase();
  const items = readPendingSignups();
  const next = items.filter((x) => x.email !== emailKey);
  if (next.length === items.length) return false;
  writePendingSignups(next);
  return true;
}
function listPendingSignups() {
  return readPendingSignups().filter((x) => (x.durum || "BEKLEMEDE") === "BEKLEMEDE").sort(
    (a, b) => new Date(b.olusturulma).getTime() - new Date(a.olusturulma).getTime()
  );
}

// src/server/firebaseAdmin.ts
var import_firebase_admin = __toESM(require("firebase-admin"), 1);
var initialized = false;
function isFirebaseAdminConfigured() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}
function getFirebaseAdmin() {
  if (initialized) return import_firebase_admin.default;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const cred = JSON.parse(json);
    import_firebase_admin.default.initializeApp({ credential: import_firebase_admin.default.credential.cert(cred) });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    import_firebase_admin.default.initializeApp({ credential: import_firebase_admin.default.credential.applicationDefault() });
  } else {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON tan\u0131ml\u0131 de\u011Fil. Vercel Environment veya .env.local dosyas\u0131na Firebase service account JSON ekleyin."
    );
  }
  initialized = true;
  return import_firebase_admin.default;
}

// src/server/authClaimsService.ts
var import_crypto = require("crypto");
init_roleClaims();
async function readKullaniciClaimsSource(email) {
  const admin2 = getFirebaseAdmin();
  const emailKey = email.trim().toLowerCase();
  const snap = await admin2.firestore().collection("kullanicilar").doc(emailKey).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return buildAuthCustomClaims({
    email: emailKey,
    yetki: String(data.yetki || data.role || "M\u0130SAF\u0130R"),
    durum: String(data.durum || "ONAY BEKL\u0130YOR")
  });
}
async function ensureAuthUser(email, password) {
  const admin2 = getFirebaseAdmin();
  const emailKey = email.trim().toLowerCase();
  try {
    const existing = await admin2.auth().getUserByEmail(emailKey);
    return existing.uid;
  } catch (err) {
    const code = err?.code;
    if (code !== "auth/user-not-found") throw err;
    if (!password) {
      throw new Error(`Firebase Auth kullan\u0131c\u0131s\u0131 yok: ${emailKey}. \u015Eifre ile olu\u015Fturulmal\u0131.`);
    }
    const created = await admin2.auth().createUser({
      email: emailKey,
      password,
      emailVerified: true
    });
    return created.uid;
  }
}
async function setUserCustomClaims(uid, claims) {
  const admin2 = getFirebaseAdmin();
  await admin2.auth().setCustomUserClaims(uid, {
    role: claims.role,
    durum: claims.durum,
    email: claims.email
  });
}
async function syncClaimsForEmail(email, password) {
  const claims = await readKullaniciClaimsSource(email);
  if (!claims) {
    throw new Error(`kullanicilar/${email.trim().toLowerCase()} bulunamad\u0131`);
  }
  const uid = await ensureAuthUser(email, password);
  await setUserCustomClaims(uid, claims);
  return claims;
}
async function verifyIdToken(idToken) {
  const admin2 = getFirebaseAdmin();
  return admin2.auth().verifyIdToken(idToken);
}
function callerIsYonetici(decoded) {
  if (normalizeClaimRole(String(decoded.role || "")) === "Y\xD6NET\u0130C\u0130") return true;
  return isFounderEmail(String(decoded.email || ""));
}
async function bootstrapFounderAccount(email, password) {
  if (!verifyFounderCredentials(email, password)) {
    throw new Error("Ge\xE7ersiz kurucu giri\u015F bilgileri");
  }
  const admin2 = getFirebaseAdmin();
  const emailKey = email.trim().toLowerCase();
  const authPassword = getFounderCanonicalPassword(emailKey) || password;
  const claims = {
    email: emailKey,
    role: "Y\xD6NET\u0130C\u0130",
    durum: "AKT\u0130F"
  };
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  await admin2.firestore().collection("kullanicilar").doc(emailKey).set(
    {
      id: emailKey,
      email: emailKey,
      yetki: "Y\xD6NET\u0130C\u0130",
      durum: "AKT\u0130F",
      kayitTarihi: today,
      yetkiUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    { merge: true }
  );
  await admin2.firestore().collection("portalKullanicilar").doc(emailKey).set(
    {
      email: emailKey,
      password: authPassword,
      role: "Y\xD6NET\u0130C\u0130",
      yetki: "Y\xD6NET\u0130C\u0130",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    { merge: true }
  );
  let uid;
  try {
    const existing = await admin2.auth().getUserByEmail(emailKey);
    uid = existing.uid;
    await admin2.auth().updateUser(uid, { password: authPassword, emailVerified: true });
  } catch (err) {
    const code = err?.code;
    if (code !== "auth/user-not-found") throw err;
    const created = await admin2.auth().createUser({
      email: emailKey,
      password: authPassword,
      emailVerified: true
    });
    uid = created.uid;
  }
  await setUserCustomClaims(uid, claims);
  return claims;
}
async function emailMayResetPassword(emailKey) {
  const admin2 = getFirebaseAdmin();
  if (isFounderEmail(emailKey)) return true;
  const [userSnap, portalSnap] = await Promise.all([
    admin2.firestore().collection("kullanicilar").doc(emailKey).get(),
    admin2.firestore().collection("portalKullanicilar").doc(emailKey).get()
  ]);
  return userSnap.exists || portalSnap.exists;
}
async function preparePasswordReset(email) {
  const admin2 = getFirebaseAdmin();
  const emailKey = email.trim().toLowerCase();
  if (!emailKey) throw new Error("E-posta zorunlu");
  const allowed = await emailMayResetPassword(emailKey);
  if (!allowed) {
    return { prepared: true, created: false };
  }
  await admin2.firestore().collection("kullanicilar").doc(emailKey).set({
    sifreSifirlamaTalebi: true
  }, { merge: true }).catch((e) => {
    console.warn("sifreSifirlamaTalebi yazilamadi:", e);
  });
  try {
    await admin2.auth().getUserByEmail(emailKey);
    return { prepared: true, created: false };
  } catch (err) {
    const code = err?.code;
    if (code !== "auth/user-not-found") throw err;
  }
  const tempPassword = (0, import_crypto.randomBytes)(24).toString("base64url");
  const created = await admin2.auth().createUser({
    email: emailKey,
    password: tempPassword,
    emailVerified: isFounderEmail(emailKey)
  });
  if (isFounderEmail(emailKey)) {
    await setUserCustomClaims(created.uid, {
      email: emailKey,
      role: "Y\xD6NET\u0130C\u0130",
      durum: "AKT\u0130F"
    });
  } else {
    const claims = await readKullaniciClaimsSource(emailKey);
    if (claims) {
      await setUserCustomClaims(created.uid, claims);
    }
  }
  return { prepared: true, created: true };
}
async function deletePortalAuthUser(email) {
  const admin2 = getFirebaseAdmin();
  const emailKey = email.trim().toLowerCase();
  if (!emailKey) throw new Error("E-posta zorunlu");
  try {
    const existing = await admin2.auth().getUserByEmail(emailKey);
    await admin2.auth().deleteUser(existing.uid);
  } catch (err) {
    const code = err?.code;
    if (code !== "auth/user-not-found") throw err;
  }
  await admin2.firestore().collection("silinenKullanicilar").doc(emailKey).set(
    {
      email: emailKey,
      silinmeTarihi: (/* @__PURE__ */ new Date()).toISOString()
    },
    { merge: true }
  );
}

// src/server/taseronGrupIntake.ts
var import_node_crypto = require("node:crypto");
var import_genai3 = require("@google/genai");

// src/lib/pdfTextLayout.ts
var import_node_zlib = require("node:zlib");
function inflatePdfStream(body) {
  try {
    return (0, import_node_zlib.inflateSync)(body);
  } catch {
  }
  try {
    return (0, import_node_zlib.inflateRawSync)(body);
  } catch {
    return null;
  }
}
function unescapePdfLiteral(latin1) {
  const unescaped = latin1.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "	").replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8))).replace(/\\([()\\])/g, "$1");
  try {
    return new TextDecoder("windows-1254").decode(Buffer.from(unescaped, "latin1"));
  } catch {
    return unescaped;
  }
}
function layoutTextFromContentStream(latin1) {
  const src = String(latin1 || "");
  const items = [];
  const re = /1 0 0 1\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm[\s\S]{0,220}?\(((?:\\.|[^\\)])*)\)\s*Tj/g;
  let m;
  while (m = re.exec(src)) {
    const t = unescapePdfLiteral(m[3] || "").replace(/\s+/g, " ").trim();
    if (!t) continue;
    items.push({ x: Number(m[1]), y: Number(m[2]), t });
  }
  if (items.length === 0) return "";
  const buckets = /* @__PURE__ */ new Map();
  for (const it of items) {
    const yKey = Math.round(it.y / 2) * 2;
    const list = buckets.get(yKey) || [];
    list.push(it);
    buckets.set(yKey, list);
  }
  const lines = [];
  for (const yKey of [...buckets.keys()].sort((a, b) => b - a)) {
    const row = (buckets.get(yKey) || []).sort((a, b) => a.x - b.x);
    let line = "";
    let prevX = -Infinity;
    for (const it of row) {
      if (!line) {
        line = it.t;
      } else if (it.x - prevX > 12) {
        line += `    ${it.t}`;
      } else {
        line += ` ${it.t}`;
      }
      prevX = it.x;
    }
    if (line.trim()) lines.push(line);
  }
  return lines.join("\n");
}
function extractPdfTextLayout(bytes) {
  const latin1 = Buffer.from(bytes).toString("latin1");
  const chunks = [];
  const re = /stream\r?\n([\s\S]*?)endstream/g;
  let m;
  while (m = re.exec(latin1)) {
    let body = Buffer.from(m[1], "latin1");
    if (body.length >= 2 && body[0] === 13 && body[1] === 10) body = body.subarray(2);
    else if (body[0] === 10 || body[0] === 13) body = body.subarray(1);
    if (body.length > 2e6) continue;
    const dec = inflatePdfStream(body);
    if (!dec) continue;
    const streamLatin1 = dec.toString("latin1");
    if (!/\(.*\)\s*Tj/.test(streamLatin1)) continue;
    const laid = layoutTextFromContentStream(streamLatin1);
    if (laid.trim()) chunks.push(laid);
  }
  return chunks.join("\n");
}

// src/lib/sgkGrupSablon.ts
function normalizePersonName(ad, soyad) {
  return `${ad || ""} ${soyad || ""}`.toLocaleLowerCase("tr-TR").replace(/[ıİ]/g, "i").replace(/[şŞ]/g, "s").replace(/[çÇ]/g, "c").replace(/[ğĞ]/g, "g").replace(/[üÜ]/g, "u").replace(/[öÖ]/g, "o").replace(/\s+/g, " ").trim();
}
function digitsTc(raw) {
  return String(raw || "").replace(/\D/g, "");
}
function fullNameOf(x) {
  return normalizePersonName(x.ad, x.soyad) || normalizePersonName(x.personelIsim || "");
}
function namesMatchExact(a, b) {
  const na = fullNameOf(a);
  const nb = fullNameOf(b);
  if (!na || !nb) return false;
  if (na.split(" ").filter(Boolean).length < 2) return false;
  if (nb.split(" ").filter(Boolean).length < 2) return false;
  return na === nb;
}
function isPendingPersonelOnayDurum(durum) {
  const d = String(durum || "");
  return d === "BEKLEMEDE" || d === "WP_G\xD6NDER\u0130LD\u0130" || d === "GRUP_BILDIRILDI";
}

// src/lib/firmaCanonicalUtils.ts
init_guvenlikHelpers();
init_yoklamaUtils();
function isPlaceholderTaseronUnvan(unvan) {
  const u = String(unvan || "").trim();
  if (!u) return true;
  const norm = u.toLocaleLowerCase("tr-TR");
  if (/^[-–—.]+$/.test(norm)) return true;
  if (/^(belirtilmedi|belirsiz|yok|tanimsiz|tanimlanmadi|bilinmiyor|test|deneme)$/i.test(norm)) {
    return true;
  }
  const key = firmaAnahtar(u);
  if (!key || key.length <= 2) return true;
  if (/^[a]+$/i.test(key.replace(/\s/g, ""))) return true;
  return false;
}
function isExplicitAnaFirmaUnvan(name) {
  const raw = String(name || "").trim();
  if (!raw) return false;
  return isAnaFirmaFirmaAdi(raw);
}

// src/lib/taseronUtils.ts
init_guvenlikHelpers();
init_yoklamaUtils();
var TASERON_PERSONEL_GOREV = "TA\u015EERON PERSONEL";
function isTaseronPersonelRecord(p) {
  return p.firmaTipi === "TASERON" || isTaseronPersonel(p);
}
function shouldHideFromTaseronEnvanter(unvan) {
  return isPlaceholderTaseronUnvan(unvan) || isExplicitAnaFirmaUnvan(unvan);
}
function getTaseronCariKartlar(cariKartlar) {
  return cariKartlar.filter(
    (c) => (c.kartTipi === "TASERON" || String(c.tur || "").toUpperCase() === "TASERON") && c.durum !== "PASIF" && !shouldHideFromTaseronEnvanter(c.unvan)
  );
}
function normFirma(s) {
  return String(s || "").trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}
function firmaAnahtar(s) {
  return normFirma(s).replace(/ı/g, "i").replace(/İ/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").replace(/\b(limited|ltd\.?|şti\.?|sti\.?|a\.?\s*ş\.?|as\.?|san\.?|tic\.?|ve|insaat|inşaat|sirketi|sirket)\b/gi, " ").replace(/[.,/\\\-_'"()]/g, " ").replace(/\s+/g, " ").trim();
}
function firmaEslesir(a, b) {
  if (!a?.trim() || !b?.trim()) return false;
  if (normFirma(a) === normFirma(b)) return true;
  const ka = firmaAnahtar(a);
  const kb = firmaAnahtar(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (ka.length >= 4 && kb.length >= 4 && (ka.includes(kb) || kb.includes(ka))) return true;
  return false;
}

// src/lib/taseronGrupSablon.ts
var TASERON_GRUP_ADI = "Arnavutk\xF6y \u0130\u015Fe Giri\u015F";
var TASERON_GRUP_KAYNAK = "TASERON_GRUP";
function isTaseronGrupTalep(item) {
  return String(item?.kaynak || "") === TASERON_GRUP_KAYNAK;
}
function inferTaseronYonFromText(raw) {
  const t = String(raw || "").toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c");
  if (!t.trim()) return null;
  const cikisHit = /isten\s*cikis|isten\s*ayril|cikis\s*bildir|isten\s*cikarma|isten\s*cikaril|isden\s*cikis|isten\s*cikis|_?ayrilis|\bayrilis\b|sigortali\s*isten\s*ayril/.test(
    t
  ) || /\bcikis\b/.test(t) && !/ise\s*giris|giris\s*bildir/.test(t);
  const girisHit = /ise\s*giris|ise\s*baslama|giris\s*bildir|sigortali\s*ise\s*giris|bildirgesi|\bgiris\b/.test(t);
  if (cikisHit && !girisHit) return "cikis";
  if (girisHit && !cikisHit) return "giris";
  if (cikisHit) return "cikis";
  if (girisHit) return "giris";
  return null;
}
function parseIsoOrTrDate(raw) {
  const s = String(raw || "").trim();
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const tr = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (tr) return `${tr[3]}-${tr[2].padStart(2, "0")}-${tr[1].padStart(2, "0")}`;
  return "";
}
function labeledValue(text, labels) {
  const lines = String(text || "").split(/\r?\n/);
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^${escaped}\\s*:\\s*(.+)$`, "i");
    for (const ln of lines) {
      const clean = ln.replace(/\*/g, "").trim();
      const m = clean.match(re);
      if (m?.[1]) return m[1].replace(/^[_ ]+|[_ ]+$/g, "").trim();
    }
  }
  return "";
}
function splitAdSoyad(full) {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { ad: "", soyad: "" };
  if (parts.length === 1) return { ad: parts[0].toLocaleUpperCase("tr-TR"), soyad: "" };
  return {
    ad: parts[0].toLocaleUpperCase("tr-TR"),
    soyad: parts.slice(1).join(" ").toLocaleUpperCase("tr-TR")
  };
}
function stripExt(name) {
  return String(name || "").replace(/\.(pdf|jpe?g|png|webp|heic)$/i, "").trim();
}
function parseTaseronGrupMessageMeta(opts) {
  const fileName = stripExt(opts.fileName || "");
  const caption = String(opts.caption || "").trim();
  const yon = inferTaseronYonFromText(`${fileName} ${caption}`) || void 0;
  const tcNo = digitsTc(fileName.match(/\d{11}/)?.[0] || caption.match(/\d{11}/)?.[0]);
  const fold = (s) => String(s || "").toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c");
  let ad = "";
  let soyad = "";
  const girisAd = fold(fileName).replace(/sigortali\s*/g, "").replace(/ise\s*giris\s*bildirgesi/g, "").replace(/ise\s*giris/g, "").replace(/bildirge(si)?/g, "").replace(/_?ayrilis.*/g, "").replace(/_+/g, " ").replace(/\s+/g, " ").trim();
  if (girisAd && !/^\d+$/.test(girisAd) && girisAd.split(/\s+/).length >= 2 && yon !== "cikis") {
    const split = splitAdSoyad(girisAd);
    ad = split.ad;
    soyad = split.soyad;
  }
  let firmaAdi = "";
  if (caption) {
    const firmaRaw = caption.replace(/\b(i[sş]e\s*giri[sş]|i[sş]ten\s*[cç][ıi]k[ıi][sş]|giri[sş]|[cç][ıi]k[ıi][sş]|ayr[ıi]l[ıi][sş])\b/gi, "").replace(/\s+/g, " ").trim();
    if (firmaRaw && !/^\d{11}$/.test(digitsTc(firmaRaw))) {
      firmaAdi = firmaRaw.toLocaleUpperCase("tr-TR");
    }
  }
  return {
    yon,
    ad: ad || void 0,
    soyad: soyad || void 0,
    firmaAdi: firmaAdi || void 0,
    tcNo: tcNo || void 0
  };
}
function firstChunk(raw) {
  return String(raw || "").replace(/\s{2,}.*$/, "").replace(/\s+/g, " ").trim();
}
function escapeRe(label) {
  return label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function fieldAfterLabel(text, label) {
  const escaped = escapeRe(label);
  const numbered = new RegExp(`(?:^|\\n)\\s*\\d{1,2}[ \\t]+${escaped}[ \\t]+([^\\n]+)`, "i");
  const standalone = new RegExp(`(?:^|\\n)\\s*${escaped}[ \\t]+([^\\n]+)`, "i");
  const m = String(text || "").match(numbered) || String(text || "").match(standalone);
  if (!m?.[1]) return "";
  return firstChunk(m[1]);
}
function valueAboveLabel(text, label) {
  const escaped = escapeRe(label);
  const numbered = new RegExp(`^\\s*\\d{1,2}[ \\t]+${escaped}(?:[ \\t]|$)`, "i");
  const standalone = new RegExp(`^\\s*${escaped}\\s*$`, "i");
  const lines = String(text || "").split(/\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!numbered.test(lines[i]) && !standalone.test(lines[i])) continue;
    const nextImmediate = (lines[i + 1] || "").trim();
    const ilFollows = /^(İl|Il)\s*$/i.test(nextImmediate);
    let skippedGeo = false;
    for (let j = i - 1; j >= 0 && j >= i - 4; j--) {
      const rawPrev = lines[j];
      const prev = firstChunk(rawPrev.replace(/^\s*\d{1,2}\s*$/, "").trim());
      if (!prev || /^\d+$/.test(prev)) continue;
      if (/bildirge|sosyal g[uü]venlik|kimlik\/adres|hizmet bilgileri/i.test(prev)) continue;
      if (/^\d{1,2}[ \t]+\S/.test(prev)) continue;
      const hadTwoCols = /\s{2,}\S/.test(rawPrev);
      if (ilFollows && !skippedGeo && !hadTwoCols && /^[A-ZÇĞİÖŞÜÂÎÛ]{3,14}$/i.test(prev)) {
        skippedGeo = true;
        continue;
      }
      return prev;
    }
  }
  return "";
}
function dateAfterLabels(text, labels) {
  const lines = String(text || "").split(/\n/);
  const fold = (s) => s.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c");
  for (let i = 0; i < lines.length; i++) {
    const folded = fold(lines[i]);
    if (!labels.some((lb) => folded.includes(fold(lb)))) continue;
    const here = parseIsoOrTrDate(lines[i]);
    if (here) return here;
    for (const j of [i - 1, i + 1, i - 2]) {
      if (j < 0 || j >= lines.length) continue;
      const d = parseIsoOrTrDate(lines[j]);
      if (d) return d;
    }
  }
  return "";
}
function extractEBildirgeTc(text) {
  const src = String(text || "");
  const afterKimlik = src.split(/K[İI]ML[İI]K NUMARASI/i)[1]?.slice(0, 600) || "";
  const spacedLine = (chunk) => chunk.match(/(?:^|\n)[ \t]*(\d(?:[ \t]+\d){10})(?:[ \t]+[A-ZX])?[ \t]*(?:\n|$)/i) || chunk.match(/(\d(?:[ \t]{2,}\d){10})/);
  const boxed = spacedLine(afterKimlik) || spacedLine(src);
  const packed = afterKimlik.match(/\b\d{11}\b/) || src.match(/\b\d{11}\b/);
  const tcNo = digitsTc((boxed?.[1] || packed?.[0] || "").replace(/\s+/g, ""));
  return tcNo.length === 11 ? tcNo : "";
}
function extractEBildirgeFirma(text) {
  const isAddr = (s) => /adresi|mahalle|cadde|sokak|bulvar|osb\b|blok|[iı]stanbul|ankara|no:\s*\d/i.test(s);
  const isCo = (s) => /in[sş]aat|elektr|taahh[uü]t|ticaret|ltd|l[iı]mited|[sş]irket|m[uü]hendisl/i.test(s);
  const label = /Ad[ıi]-Soyad[ıi]\/[ÜU]nv\.?[^\n]*/i.exec(String(text || ""));
  if (label && label.index != null) {
    const following = String(text || "").slice(label.index + label[0].length).split(/\n/).map((ln) => ln.trim()).filter(Boolean);
    for (const ln of following.slice(0, 6)) {
      if (/^\d{1,2}$/.test(ln)) continue;
      if (/adresi|ünv\.?/i.test(ln) && !isCo(ln)) continue;
      const cleaned = ln.replace(/^\s*\d{1,2}\s+/, "").split(/\s{2,}/)[0].trim();
      if (cleaned.length < 6 || /^\d+$/.test(cleaned)) continue;
      if (isAddr(cleaned) && !isCo(cleaned)) continue;
      return isCo(cleaned) ? cleaned : cleaned.replace(/\s+(MAHALLE|MAHALLES[İI]|CADDE|SOKAK|BULVAR|[İI]STANBUL|ANKARA).*$/i, "").trim();
    }
  }
  const caps = String(text || "").match(
    /\n\s*\d{0,2}\s*([A-ZÇĞİÖŞÜÂÎÛ][A-ZÇĞİÖŞÜÂÎÛ0-9 /.'-]{10,}(?:İNŞAAT|INSAAT|ELEKTR[İI]K|TAAHH[ÜU]T|M[ÜU]HEND[İI]SL[İI]K|LTD|T[İI]CARET|ŞİRKET[İI]|SIRKETI)[A-ZÇĞİÖŞÜÂÎÛ0-9 /.'-]*)/
  );
  return caps?.[1]?.split(/\s{2,}/)[0]?.trim() || "";
}
function parseSgkEBildirgeText(raw) {
  const text = String(raw || "");
  if (!/SİGORTALI İŞ|SIGORTALI IS|SOSYAL GÜVENLİK KURUMU|SOSYAL GUVENLIK KURUMU/i.test(text)) {
    return {};
  }
  const yon = /İŞTEN AYRILIŞ|ISTEN AYRILIS|İŞTEN ÇIKIŞ|ISTEN CIKIS/i.test(text) ? "cikis" : /İŞE GİRİŞ BİLDİRGESİ|ISE GIRIS BILDIRGESI/i.test(text) ? "giris" : inferTaseronYonFromText(text) || void 0;
  const tcNo = extractEBildirgeTc(text);
  const nameOk = (s) => /^[A-ZÇĞİÖŞÜÂÎÛa-zçğıöşü'-]{2,}$/.test(s);
  const pickName = (...cands) => cands.map((s) => s.trim()).find(nameOk) || "";
  const ad = pickName(
    fieldAfterLabel(text, "Ad\u0131"),
    fieldAfterLabel(text, "Adi"),
    valueAboveLabel(text, "Ad\u0131"),
    valueAboveLabel(text, "Adi")
  );
  const soyad = pickName(
    fieldAfterLabel(text, "Soyad\u0131"),
    fieldAfterLabel(text, "Soyadi"),
    valueAboveLabel(text, "Soyad\u0131"),
    valueAboveLabel(text, "Soyadi")
  );
  const meslekJunk = /bildirge|hizmet bilgileri|kimlik\/adres|n[uü]fusa kay[ıi]tl[ıi]|evet hay[ıi]r/i;
  const stripMeslekCode = (raw2) => String(raw2 || "").replace(/^\d{4}\.\d{2}\s*-?\s*/, "").replace(/\s*-\d{4}\.\d{2}\s*$/, "").trim();
  const pickMeslek = (...cands) => {
    for (const raw2 of cands) {
      const t = stripMeslekCode(raw2);
      if (t.length >= 4 && !meslekJunk.test(t) && !/^\d/.test(t)) return t;
    }
    return "";
  };
  const isGorev = pickMeslek(
    fieldAfterLabel(text, "Meslek Ad\u0131 ve Kodu"),
    fieldAfterLabel(text, "Meslek Adi ve Kodu"),
    valueAboveLabel(text, "Meslek Ad\u0131 ve Kodu"),
    valueAboveLabel(text, "Meslek Adi ve Kodu")
  );
  const tarih = yon === "cikis" ? dateAfterLabels(text, ["\u0130\u015Ften Ayr\u0131l\u0131\u015F Tarihi", "Isten Ayrilis Tarihi", "Sigortal\u0131n\u0131n \u0130\u015Ften Ayr\u0131l\u0131\u015F Tarihi"]) || dateAfterLabels(text, ["\u0130\u015Fe Giri\u015F Tarihi", "Ise Giris Tarihi"]) : dateAfterLabels(text, [
    "\u0130\u015Fe Giri\u015F Tarihi",
    "Ise Giris Tarihi",
    "Sigortal\u0131n\u0131n \u0130\u015Fe Giri\u015F Tarihi",
    "i\u015Fe ba\u015Flad\u0131\u011F\u0131 tarih",
    "ise basladigi tarih",
    "Sigortal\u0131n\u0131n i\u015Fe ba\u015Flad\u0131\u011F\u0131 tarih"
  ]) || dateAfterLabels(text, ["\u0130\u015Ften Ayr\u0131l\u0131\u015F Tarihi", "Isten Ayrilis Tarihi"]);
  const firmaAdi = extractEBildirgeFirma(text);
  return {
    yon,
    ad: nameOk(ad) ? ad.toLocaleUpperCase("tr-TR") : void 0,
    soyad: nameOk(soyad) ? soyad.toLocaleUpperCase("tr-TR") : void 0,
    tcNo: tcNo || void 0,
    isGorev: isGorev ? isGorev.toLocaleUpperCase("tr-TR") : void 0,
    firmaAdi: firmaAdi ? firmaAdi.toLocaleUpperCase("tr-TR") : void 0,
    tarih: tarih || void 0
  };
}
function mergeTaseronGrupParse(...parts) {
  const out = {};
  for (const part of parts) {
    if (!part) continue;
    ["yon", "firmaAdi", "isGorev", "ad", "soyad", "tcNo", "tarih"].forEach((k) => {
      const v = part[k];
      if (v != null && String(v).trim() && (out[k] == null || String(out[k]).trim() === "")) {
        out[k] = v;
      }
    });
  }
  return out;
}
function taseronGrupParseHasIdentity(p) {
  return Boolean(String(p?.ad || "").trim() && String(p?.soyad || "").trim() && p?.yon);
}
var TASERON_GRUP_OTOMASYON = {
  grupAdi: TASERON_GRUP_ADI,
  kaynak: TASERON_GRUP_KAYNAK,
  birim: "tek mesaj = tek PDF = tek ki\u015Fi",
  girisDosya: "AD SOYAD \u0130\u015EE G\u0130R\u0130\u015E B\u0130LD\u0130RGES\u0130.pdf",
  cikisDosya: "11haneliTC_ayrilis.pdf",
  altYaziOrnek: "Yurt mekanik giri\u015F",
  endpoint: "POST /api/taseron-grup-intake",
  whatsappWebhook: "/api/webhooks/whatsapp-taseron-grup",
  kadro: "yaz\u0131lmaz \u2014 Onay kuyru\u011Fu",
  grupDinleme: false
};
function taseronGrupKuyrukHazir(p) {
  return Boolean(
    taseronGrupParseHasIdentity(p) && String(p?.firmaAdi || "").trim() && String(p?.tarih || "").trim()
  );
}
function assembleTaseronGrupFromParts(opts) {
  const fromMsg = parseTaseronGrupMessageMeta({ fileName: opts.fileName, caption: opts.caption });
  const fromCaption = opts.caption ? parseTaseronGrupWhatsAppText(opts.caption) : {};
  const merged = mergeTaseronGrupParse(opts.fromPdf, opts.fromGemini, fromCaption, fromMsg);
  return normalizeTaseronGrupParse(
    {
      ...merged,
      yon: fromMsg.yon || merged.yon,
      firmaAdi: merged.firmaAdi || fromMsg.firmaAdi,
      ad: merged.ad || fromMsg.ad,
      soyad: merged.soyad || fromMsg.soyad,
      tcNo: merged.tcNo || fromMsg.tcNo
    },
    { fileName: opts.fileName, fallbackYon: fromMsg.yon }
  );
}
function parseTaseronGrupWhatsAppText(raw) {
  const text = String(raw || "").trim();
  if (!text) return {};
  const eBildirge = parseSgkEBildirgeText(text);
  const fromMsg = parseTaseronGrupMessageMeta({ caption: text });
  const adSoyad = labeledValue(text, ["Ad Soyad", "Ad\u0131 Soyad\u0131", "Personel", "Isim", "\u0130sim"]);
  const split = splitAdSoyad(adSoyad);
  const ad = eBildirge.ad || labeledValue(text, ["Ad", "Ad\u0131"]) || split.ad || fromMsg.ad || "";
  const soyad = eBildirge.soyad || labeledValue(text, ["Soyad", "Soyad\u0131"]) || split.soyad || fromMsg.soyad || "";
  const firmaAdi = eBildirge.firmaAdi || labeledValue(text, ["Firma", "Ta\u015Feron", "Taseron", "\u0130\u015Fveren", "Unvan", "\xDCnvan", "\u015Eirket"]) || fromMsg.firmaAdi || "";
  const isGorev = eBildirge.isGorev || labeledValue(text, ["Yap\u0131lan i\u015F", "Yapilan is", "\u0130\u015F", "Is", "Nitelik", "Meslek", "G\xF6rev tan\u0131m\u0131"]);
  const tcNo = digitsTc(
    eBildirge.tcNo || labeledValue(text, ["TC Kimlik", "TC", "T.C.", "Kimlik No"]) || text.match(/\b\d{11}\b/)?.[0] || fromMsg.tcNo
  );
  const yon = eBildirge.yon || inferTaseronYonFromText(text) || fromMsg.yon || void 0;
  const tarih = eBildirge.tarih || parseIsoOrTrDate(labeledValue(text, ["Giri\u015F tarihi", "Giris tarihi", "\xC7\u0131k\u0131\u015F tarihi", "Cikis tarihi", "Tarih"])) || parseIsoOrTrDate(text);
  return {
    yon,
    ad: ad ? ad.toLocaleUpperCase("tr-TR") : void 0,
    soyad: soyad ? soyad.toLocaleUpperCase("tr-TR") : void 0,
    firmaAdi: firmaAdi ? firmaAdi.toLocaleUpperCase("tr-TR") : void 0,
    isGorev: isGorev ? isGorev.toLocaleUpperCase("tr-TR") : void 0,
    tcNo: tcNo || void 0,
    tarih: tarih || void 0
  };
}
function normalizeTaseronGrupParse(parsed, opts) {
  const ad = String(parsed?.ad || "").trim().toLocaleUpperCase("tr-TR");
  const soyad = String(parsed?.soyad || "").trim().toLocaleUpperCase("tr-TR");
  const firmaAdi = String(parsed?.firmaAdi || "").trim().toLocaleUpperCase("tr-TR");
  const isGorev = String(parsed?.isGorev || "").trim().toLocaleUpperCase("tr-TR");
  const tcNo = digitsTc(parsed?.tcNo);
  const tarih = parseIsoOrTrDate(parsed?.tarih) || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const yonRaw = String(parsed?.yon || "").toLocaleLowerCase("tr-TR");
  const yonFromParse = yonRaw === "cikis" || yonRaw === "\xE7\u0131k\u0131\u015F" ? "cikis" : yonRaw === "giris" || yonRaw === "giri\u015F" ? "giris" : null;
  const yon = yonFromParse || inferTaseronYonFromText(`${parsed?.isGorev || ""} ${opts?.fileName || ""}`) || opts?.fallbackYon || "giris";
  return {
    yon,
    firmaAdi,
    isGorev,
    ad,
    soyad,
    tcNo: tcNo || void 0,
    tarih
  };
}
function taseronGrupKuruluFirmaAdlari(opts) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (raw) => {
    const u = String(raw || "").trim();
    if (!u) return;
    const key = firmaAnahtar(u).replace(/\s+/g, "");
    if (key.length < 3 || seen.has(key)) return;
    seen.add(key);
    out.push(u);
  };
  for (const c of getTaseronCariKartlar(opts?.cariKartlar || [])) add(c.unvan);
  for (const p of (opts?.personeller || []).filter(isTaseronPersonelRecord)) add(p.firmaAdi);
  return out;
}
function taseronGrupFirmaEslesir(a, b) {
  if (firmaEslesir(a, b)) return true;
  const ca = firmaAnahtar(a).replace(/\s+/g, "");
  const cb = firmaAnahtar(b).replace(/\s+/g, "");
  if (ca.length < 5 || cb.length < 5) return false;
  return ca === cb || ca.includes(cb) || cb.includes(ca);
}
function resolveTaseronGrupFirmaAdi(raw, cariKartlar = [], personeller = []) {
  const name = String(raw || "").trim().toLocaleUpperCase("tr-TR");
  if (!name) return "";
  const kurulu = taseronGrupKuruluFirmaAdlari({ cariKartlar, personeller });
  const hits = kurulu.filter((u) => taseronGrupFirmaEslesir(u, name));
  if (hits.length === 0) return name;
  return hits.slice().sort((a, b) => a.length - b.length || a.localeCompare(b, "tr"))[0];
}
function findTaseronPersonelByTc(personeller = [], tcNo) {
  const tc = digitsTc(tcNo);
  if (tc.length !== 11) return void 0;
  return personeller.filter(isTaseronPersonelRecord).find((p) => digitsTc(p.tcNo) === tc);
}
function buildTaseronGirisTalepDoc(opts) {
  const ad = opts.parsed.ad.trim().toLocaleUpperCase("tr-TR");
  const soyad = opts.parsed.soyad.trim().toLocaleUpperCase("tr-TR");
  const isGorev = opts.parsed.isGorev.trim().toLocaleUpperCase("tr-TR");
  const firmaAdi = opts.parsed.firmaAdi.trim().toLocaleUpperCase("tr-TR");
  const tcNo = digitsTc(opts.parsed.tcNo);
  const evrak = opts.evrakUrl || "";
  return {
    id: opts.id,
    ad,
    soyad,
    personelIsim: `${ad} ${soyad}`.trim(),
    tcNo: tcNo || "",
    firmaAdi,
    firmaTipi: "TASERON",
    gorev: TASERON_PERSONEL_GOREV,
    nitelik: isGorev || void 0,
    taseronIsGorev: isGorev || void 0,
    iseGirisTarihi: opts.parsed.tarih,
    tarih: (/* @__PURE__ */ new Date()).toISOString(),
    durum: "BEKLEMEDE",
    kaynak: TASERON_GRUP_KAYNAK,
    grupBildirildi: true,
    girisEvrakPdfUrl: evrak || void 0,
    taseronGrupEvrakUrl: evrak || void 0,
    gonderenFormen: opts.gonderen
  };
}
function buildTaseronCikisTalepDoc(opts) {
  const ad = opts.parsed.ad.trim().toLocaleUpperCase("tr-TR");
  const soyad = opts.parsed.soyad.trim().toLocaleUpperCase("tr-TR");
  const isGorev = opts.parsed.isGorev.trim().toLocaleUpperCase("tr-TR");
  const firmaAdi = opts.parsed.firmaAdi.trim().toLocaleUpperCase("tr-TR");
  const tcNo = digitsTc(opts.parsed.tcNo);
  const evrak = opts.evrakUrl || "";
  return {
    id: opts.id,
    ad,
    soyad,
    personelIsim: `${ad} ${soyad}`.trim(),
    personelId: opts.personelId || "",
    personelGorev: TASERON_PERSONEL_GOREV,
    personelMaas: 0,
    tcNo: tcNo || "",
    firmaAdi,
    firmaTipi: "TASERON",
    nitelik: isGorev || void 0,
    taseronIsGorev: isGorev || void 0,
    cikisTarihi: opts.parsed.tarih,
    cikisNedeni: "Ta\u015Feron grup \u2014 i\u015Ften \xE7\u0131k\u0131\u015F",
    hedefYoneticiRole: "Y\xD6NET\u0130C\u0130",
    tarih: (/* @__PURE__ */ new Date()).toISOString(),
    durum: "BEKLEMEDE",
    kaynak: TASERON_GRUP_KAYNAK,
    grupBildirildi: true,
    cikisEvrakPdfUrl: evrak || void 0,
    taseronGrupEvrakUrl: evrak || void 0,
    gonderenFormen: opts.gonderen
  };
}
function findOpenTaseronGrupTalep(kuyruk, opts) {
  const pending = kuyruk.filter((x) => isTaseronGrupTalep(x) && isPendingPersonelOnayDurum(x.durum));
  const tc = digitsTc(opts.tcNo);
  if (tc.length === 11) {
    const byTc = pending.find((x) => digitsTc(x.tcNo) === tc);
    if (byTc) return byTc;
  }
  return pending.find((x) => namesMatchExact(x, opts));
}

// src/server/taseronGrupIntake.ts
var GEMINI_PROMPT = `
This is ONE official Turkish SGK e-Bildirge PDF (JasperReports / iText) from the Arnavutk\xF6y \u0130\u015Fe Giri\u015F WhatsApp group.
Titles are exactly:
- "S\u0130GORTALI \u0130\u015EE G\u0130R\u0130\u015E B\u0130LD\u0130RGES\u0130" \u2192 yon=giris. Date = field 16 "Sigortal\u0131n\u0131n i\u015Fe ba\u015Flad\u0131\u011F\u0131 tarih" (DD.MM.YYYY).
- "S\u0130GORTALI \u0130\u015ETEN AYRILI\u015E B\u0130LD\u0130RGES\u0130" \u2192 yon=cikis. Date = field 15 "Sigortal\u0131n\u0131n \u0130\u015Ften Ayr\u0131l\u0131\u015F Tarihi" (DD.MM.YYYY).
Never a weekly roster. Prefer the TITLE if both dates appear.

Extract yon, firmaAdi (i\u015Fveren \xFCnvan\u0131, not address), isGorev (meslek without numeric code),
ad (field 1), soyad (field 2), tcNo (11 digits), tarih (YYYY-MM-DD).
`;
function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== void 0));
}
function intakeSecretOk(headerVal) {
  const expected = String(process.env.TASERON_GRUP_INTAKE_SECRET || "").trim();
  if (!expected) return false;
  const got = String(Array.isArray(headerVal) ? headerVal[0] : headerVal || "").trim();
  if (!got || got.length !== expected.length) return false;
  try {
    return (0, import_node_crypto.timingSafeEqual)(Buffer.from(got), Buffer.from(expected));
  } catch {
    return false;
  }
}
function isTaseronGrupIntakeConfigured() {
  return Boolean(String(process.env.TASERON_GRUP_INTAKE_SECRET || "").trim());
}
function isWhatsAppTaseronWebhookConfigured() {
  return Boolean(
    String(process.env.WHATSAPP_VERIFY_TOKEN || "").trim() && String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim()
  );
}
async function geminiFill(fileBase64, mimeType, fileName) {
  const { text } = await generateGeminiWithFallback({
    contents: [
      { inlineData: { mimeType, data: fileBase64 } },
      `${GEMINI_PROMPT}
File name: ${fileName}`
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: import_genai3.Type.OBJECT,
        properties: {
          yon: { type: import_genai3.Type.STRING },
          firmaAdi: { type: import_genai3.Type.STRING },
          isGorev: { type: import_genai3.Type.STRING },
          ad: { type: import_genai3.Type.STRING },
          soyad: { type: import_genai3.Type.STRING },
          tcNo: { type: import_genai3.Type.STRING },
          tarih: { type: import_genai3.Type.STRING }
        },
        required: ["yon", "ad", "soyad", "tarih"]
      }
    },
    label: "Ta\u015Feron grup evrak analizi"
  });
  return JSON.parse(text);
}
async function parseTaseronGrupUpload(opts) {
  const fileName = String(opts.fileName || "");
  const caption = String(opts.caption || "");
  let fromPdf = {};
  if (/pdf/i.test(opts.mimeType) || /\.pdf$/i.test(fileName)) {
    try {
      fromPdf = parseSgkEBildirgeText(extractPdfTextLayout(Buffer.from(opts.fileBase64, "base64")));
    } catch (e) {
      console.warn("ta\u015Feron grup PDF metin \xE7\u0131karma atland\u0131:", e);
    }
  }
  const textOnly = assembleTaseronGrupFromParts({ fromPdf, fileName, caption });
  const textComplete = taseronGrupParseHasIdentity(textOnly) && Boolean(textOnly.firmaAdi && (textOnly.tcNo || textOnly.tarih));
  if (textComplete) {
    return { parsed: textOnly, source: "pdf-text" };
  }
  try {
    const fromGemini = await geminiFill(opts.fileBase64, opts.mimeType, fileName);
    return {
      parsed: assembleTaseronGrupFromParts({ fromPdf, fromGemini, fileName, caption }),
      source: "pdf-text+gemini"
    };
  } catch (err) {
    if (taseronGrupParseHasIdentity(textOnly) || textOnly.tcNo) {
      return { parsed: textOnly, source: "pdf-text" };
    }
    throw err;
  }
}
async function loadKuruluFromAdmin() {
  if (!isFirebaseAdminConfigured()) return { cariKartlar: [], personeller: [] };
  const db = getFirebaseAdmin().firestore();
  const [cariSnap, persSnap] = await Promise.all([
    db.collection("cariKartlar").get(),
    db.collection("personeller").get()
  ]);
  return {
    cariKartlar: cariSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    personeller: persSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  };
}
async function enqueueTaseronGrupParse(opts) {
  if (!isFirebaseAdminConfigured()) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON yok \u2014 kuyruk sunucudan yaz\u0131lamaz.");
  }
  const { cariKartlar, personeller } = await loadKuruluFromAdmin();
  const parsed = {
    ...opts.parsed,
    firmaAdi: resolveTaseronGrupFirmaAdi(opts.parsed.firmaAdi, cariKartlar, personeller)
  };
  if (!taseronGrupKuyrukHazir(parsed)) {
    return { id: "", skipped: "ad/soyad/firma/tarih eksik" };
  }
  const db = getFirebaseAdmin().firestore();
  const col = parsed.yon === "cikis" ? "personelCikisTalepleri" : "personelGirisTalepleri";
  const pendingSnap = await db.collection(col).get();
  const pending = pendingSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const open = findOpenTaseronGrupTalep(pending, parsed);
  if (open?.id) {
    return { id: String(open.id), duplicate: true };
  }
  const gonderen = opts.gonderen || "otomasyon";
  if (parsed.yon === "cikis") {
    const id2 = `CIKIS-${TASERON_GRUP_KAYNAK}-${Date.now()}`;
    const hit = findTaseronPersonelByTc(personeller, parsed.tcNo);
    const doc2 = stripUndefined(
      buildTaseronCikisTalepDoc({
        id: id2,
        parsed,
        evrakUrl: opts.evrakDataUrl,
        gonderen,
        personelId: hit?.id
      })
    );
    await db.collection(col).doc(id2).set(doc2);
    return { id: id2 };
  }
  const id = `GIRIS-${TASERON_GRUP_KAYNAK}-${Date.now()}`;
  const doc = stripUndefined(
    buildTaseronGirisTalepDoc({ id, parsed, evrakUrl: opts.evrakDataUrl, gonderen })
  );
  await db.collection(col).doc(id).set(doc);
  return { id };
}
function taseronGrupOtomasyonSozlesme() {
  return {
    ...TASERON_GRUP_OTOMASYON,
    intakeSecretConfigured: isTaseronGrupIntakeConfigured(),
    whatsappConfigured: isWhatsAppTaseronWebhookConfigured(),
    adminConfigured: isFirebaseAdminConfigured(),
    not: "Mevcut WhatsApp grubu dinlenmez. Otomasyon bu s\xF6zle\u015Fmeyle PDF g\xF6nderir; kadro Onay\u2019da yaz\u0131l\u0131r."
  };
}
async function downloadWhatsAppMedia(mediaId) {
  const token = String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN yok");
  const metaRes = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(mediaId)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!metaRes.ok) throw new Error(`WhatsApp media meta ${metaRes.status}`);
  const meta = await metaRes.json();
  if (!meta.url) throw new Error("WhatsApp media url yok");
  const binRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!binRes.ok) throw new Error(`WhatsApp media indirilemedi ${binRes.status}`);
  const buf = Buffer.from(await binRes.arrayBuffer());
  return { base64: buf.toString("base64"), mimeType: meta.mime_type || "application/pdf" };
}
async function handleWhatsAppTaseronMessages(messages) {
  let processed = 0;
  let queued = 0;
  let skipped = 0;
  for (const msg of messages) {
    const doc = msg.document;
    const img = msg.type === "image" ? msg.image : void 0;
    const mediaId = doc?.id || img?.id;
    if (!mediaId) {
      skipped += 1;
      continue;
    }
    processed += 1;
    try {
      const media = await downloadWhatsAppMedia(mediaId);
      const fileName = doc?.filename || "";
      const caption = String(doc?.caption || img?.caption || msg.text?.body || "");
      const { parsed } = await parseTaseronGrupUpload({
        fileBase64: media.base64,
        mimeType: media.mimeType || doc?.mime_type || img?.mime_type || "application/pdf",
        fileName,
        caption
      });
      const evrakDataUrl = `data:${media.mimeType};base64,${media.base64}`;
      const result = await enqueueTaseronGrupParse({
        parsed,
        evrakDataUrl,
        gonderen: msg.from ? `wa:${msg.from}` : "whatsapp-otomasyon"
      });
      if (result.id && !result.skipped) queued += 1;
      else skipped += 1;
    } catch (err) {
      console.warn("WhatsApp ta\u015Feron mesaj atland\u0131:", err);
      skipped += 1;
    }
  }
  return { processed, queued, skipped };
}

// src/server/registerApiRoutes.ts
function registerApiRoutes(app2) {
  app2.get("/api/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "kibritci_web",
      host: "vercel",
      firebase: "kibritci-erp"
    });
  });
  app2.get("/api/public/siparis-health", (_req, res) => {
    res.json({
      ok: true,
      form: "/siparis.html",
      note: "\xDCyeliksiz sipari\u015F \u2014 ERP oturumu yok, personel/yoklama yaz\u0131lmaz"
    });
  });
  async function readBearerToken(req) {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) return null;
    return header.slice(7).trim() || null;
  }
  app2.get("/api/auth/claims-status", (_req, res) => {
    res.json({ adminConfigured: isFirebaseAdminConfigured() });
  });
  const PUBLIC_SA_SHARE_COLLECTION = "publicSatinAlmaPaylasimlari";
  function makePublicShareToken() {
    return `po_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}${Math.random().toString(36).slice(2, 10)}`;
  }
  function buildPublicShareUrl(req, token) {
    const host = req.get?.("x-forwarded-host") || req.get?.("host") || req.headers.host || "kibritci-web.vercel.app";
    const proto = (req.get?.("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim() || "https";
    return `${proto}://${host}/?view_po=${encodeURIComponent(token)}`;
  }
  app2.post("/api/public/satin-alma-share", async (req, res) => {
    if (!isFirebaseAdminConfigured()) {
      return res.status(503).json({ error: "Firebase Admin yap\u0131land\u0131r\u0131lmam\u0131\u015F" });
    }
    try {
      const idToken = await readBearerToken(req);
      if (!idToken) return res.status(401).json({ error: "Authorization Bearer token gerekli" });
      const decoded = await verifyIdToken(idToken);
      const shareIn = req.body?.share || req.body || {};
      const saId = String(shareIn.saId || "").trim();
      if (!saId) return res.status(400).json({ error: "saId zorunlu" });
      const token = makePublicShareToken();
      const payload = {
        kind: "satin_alma_po",
        saDocId: String(shareIn.saDocId || ""),
        saId,
        tarih: String(shareIn.tarih || ""),
        talepEden: String(shareIn.talepEden || ""),
        cariFirma: String(shareIn.cariFirma || ""),
        aciklama: String(shareIn.aciklama || ""),
        onayDurumu: String(shareIn.onayDurumu || ""),
        kalemler: Array.isArray(shareIn.kalemler) ? shareIn.kalemler : [],
        eImzalar: Array.isArray(shareIn.eImzalar) ? shareIn.eImzalar : [],
        createdAt: String(shareIn.createdAt || (/* @__PURE__ */ new Date()).toISOString()),
        createdBy: decoded.email || shareIn.createdBy || null
      };
      const admin2 = getFirebaseAdmin();
      await admin2.firestore().collection(PUBLIC_SA_SHARE_COLLECTION).doc(token).set(payload);
      return res.json({
        success: true,
        token,
        url: buildPublicShareUrl(req, token)
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payla\u015F\u0131m olu\u015Fturulamad\u0131";
      return res.status(500).json({ error: message });
    }
  });
  app2.get("/api/public/satin-alma-share/:token", async (req, res) => {
    if (!isFirebaseAdminConfigured()) {
      return res.status(503).json({ error: "Firebase Admin yap\u0131land\u0131r\u0131lmam\u0131\u015F" });
    }
    try {
      const token = String(req.params.token || "").trim();
      if (!token || token.length < 8) {
        return res.status(400).json({ error: "Ge\xE7ersiz payla\u015F\u0131m kodu" });
      }
      const admin2 = getFirebaseAdmin();
      const snap = await admin2.firestore().collection(PUBLIC_SA_SHARE_COLLECTION).doc(token).get();
      if (!snap.exists) {
        return res.status(404).json({ error: "Payla\u015F\u0131m bulunamad\u0131" });
      }
      return res.json({ id: snap.id, ...snap.data() });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payla\u015F\u0131m okunamad\u0131";
      return res.status(500).json({ error: message });
    }
  });
  const SAHA_SIPARIS_COLLECTION = "sahaSiparisleri";
  app2.get("/api/public/siparis-katalog", async (_req, res) => {
    if (!isFirebaseAdminConfigured()) {
      return res.json({ stoklar: [], tedarikciler: [] });
    }
    try {
      const admin2 = getFirebaseAdmin();
      const [stokSnap, cariSnap] = await Promise.all([
        admin2.firestore().collection("stokKartlar").limit(800).get(),
        admin2.firestore().collection("cariKartlar").limit(400).get()
      ]);
      const stoklar = stokSnap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          stokKodu: String(x.stokKodu || ""),
          stokAdi: String(x.stokAdi || ""),
          birim: String(x.birim || "ADET"),
          kategori: String(x.kategori || ""),
          durum: String(x.durum || ""),
          arsivde: Boolean(x.arsivde)
        };
      }).filter((s) => s.stokAdi && s.durum !== "PASIF" && !s.arsivde).map(({ durum: _d, arsivde: _a, ...rest }) => rest).sort((a, b) => a.stokAdi.localeCompare(b.stokAdi, "tr")).slice(0, 500);
      const tedarikciler = cariSnap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          unvan: String(x.unvan || ""),
          kartTipi: String(x.kartTipi || ""),
          durum: String(x.durum || "")
        };
      }).filter(
        (c) => c.unvan && c.durum !== "PASIF" && (c.kartTipi === "TEDARIKCI" || c.kartTipi === "SATICI" || !c.kartTipi)
      ).map(({ kartTipi: _k, durum: _d, ...rest }) => rest).sort((a, b) => a.unvan.localeCompare(b.unvan, "tr")).slice(0, 200);
      return res.json({ stoklar, tedarikciler });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Katalog okunamad\u0131";
      return res.status(500).json({ error: message });
    }
  });
  app2.post("/api/public/saha-siparis", async (req, res) => {
    if (!isFirebaseAdminConfigured()) {
      return res.status(503).json({ error: "Firebase Admin yap\u0131land\u0131r\u0131lmam\u0131\u015F" });
    }
    try {
      const body = req.body || {};
      const personelAdSoyad = String(body.personelAdSoyad || "").trim();
      const kullanilacakYer = String(body.kullanilacakYer || "").trim();
      const kalemlerIn = Array.isArray(body.kalemler) ? body.kalemler : [];
      const kalemler = kalemlerIn.map((k, i) => ({
        id: String(k.id || `sipk_${Date.now()}_${i}`),
        urunAdi: String(k.urunAdi || "").trim(),
        miktar: Number(k.miktar) || 0,
        birim: String(k.birim || "ADET"),
        marka: String(k.marka || ""),
        kullanilacakYer: String(k.kullanilacakYer || kullanilacakYer),
        aciklama: String(k.aciklama || ""),
        stokKartId: String(k.stokKartId || "")
      })).filter((k) => k.urunAdi && k.miktar > 0);
      if (personelAdSoyad.length < 3) {
        return res.status(400).json({ error: "Personel ad\u0131 soyad\u0131 zorunlu" });
      }
      if (kullanilacakYer.length < 3) {
        return res.status(400).json({ error: "Kullan\u0131lacak yer zorunlu" });
      }
      if (kalemler.length === 0) {
        return res.status(400).json({ error: "En az bir malzeme kalemi gerekli" });
      }
      if (kalemler.length > 40) {
        return res.status(400).json({ error: "En fazla 40 kalem" });
      }
      const tarih = String(body.tarih || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)).slice(0, 10);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const id = String(body.id || `sip_${Date.now()}`).slice(0, 64);
      const siparisNo = String(
        body.siparisNo || `SP-${tarih.replace(/-/g, "")}-${Date.now().toString(36).slice(-4).toUpperCase()}`
      );
      const payload = {
        id,
        siparisNo,
        tarih,
        personelAdSoyad: personelAdSoyad.slice(0, 80),
        personelGorev: String(body.personelGorev || "").slice(0, 80),
        telefon: String(body.telefon || "").slice(0, 40),
        kullanilacakYer: kullanilacakYer.slice(0, 400),
        cariFirma: String(body.cariFirma || "").slice(0, 160),
        cariKartId: String(body.cariKartId || ""),
        aciklama: String(body.aciklama || "").slice(0, 500),
        kalemler,
        durum: "ONAY_BEKLIYOR",
        kaynak: "SIPARIS_FORMU",
        olusturanEmail: "siparis-link@kibritci.com",
        olusturulma: now
      };
      const admin2 = getFirebaseAdmin();
      await admin2.firestore().collection(SAHA_SIPARIS_COLLECTION).doc(id).set(payload);
      return res.json({ success: true, siparis: payload });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sipari\u015F kaydedilemedi";
      return res.status(500).json({ error: message });
    }
  });
  const PUBLIC_KASA_RAPOR_COLLECTION = "publicKasaRaporPaylasimlari";
  const KASA_RAPOR_STORAGE_BUCKET = "kibritci-erp.firebasestorage.app";
  function makeKasaRaporShareToken() {
    return `kr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}${Math.random().toString(36).slice(2, 10)}`;
  }
  function buildKasaRaporViewUrl(req, token) {
    const host = req.get?.("x-forwarded-host") || req.get?.("host") || req.headers.host || "kibritci-web.vercel.app";
    const proto = (req.get?.("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim() || "https";
    return `${proto}://${host}/?view_kasa_rapor=${encodeURIComponent(token)}`;
  }
  async function uploadKasaRaporFile(admin2, token, fileName, buffer, contentType) {
    const bucket = admin2.storage().bucket(KASA_RAPOR_STORAGE_BUCKET);
    const objectPath = `kasa-raporlari/${token}/${fileName}`;
    const file = bucket.file(objectPath);
    await file.save(buffer, {
      contentType,
      metadata: { cacheControl: "public, max-age=604800" }
    });
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 90 * 24 * 60 * 60 * 1e3
    });
    return signedUrl;
  }
  app2.post("/api/public/kasa-rapor-share", async (req, res) => {
    if (!isFirebaseAdminConfigured()) {
      return res.status(503).json({ error: "Firebase Admin yap\u0131land\u0131r\u0131lmam\u0131\u015F" });
    }
    try {
      const idToken = await readBearerToken(req);
      if (!idToken) return res.status(401).json({ error: "Authorization Bearer token gerekli" });
      const decoded = await verifyIdToken(idToken);
      const html = String(req.body?.html || "");
      if (!html || html.length < 40) {
        return res.status(400).json({ error: "html zorunlu" });
      }
      const meta = req.body?.meta || {};
      const startDate = String(meta.startDate || "");
      const endDate = String(meta.endDate || "");
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate ve endDate zorunlu" });
      }
      const token = makeKasaRaporShareToken();
      const admin2 = getFirebaseAdmin();
      const htmlUrl = await uploadKasaRaporFile(
        admin2,
        token,
        "report.html",
        Buffer.from(html, "utf8"),
        "text/html; charset=utf-8"
      );
      let excelUrl = "";
      const excelBase64 = String(req.body?.excelBase64 || "").trim();
      if (excelBase64) {
        excelUrl = await uploadKasaRaporFile(
          admin2,
          token,
          "report.xlsx",
          Buffer.from(excelBase64, "base64"),
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
      }
      const viewUrl = buildKasaRaporViewUrl(req, token);
      const payload = {
        kind: "kasa_harcama",
        startDate,
        endDate,
        kalemCount: Number(meta.kalemCount) || 0,
        genelToplam: Number(meta.genelToplam) || 0,
        htmlUrl,
        excelUrl: excelUrl || null,
        viewUrl,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        createdBy: decoded.email || meta.createdBy || null
      };
      await admin2.firestore().collection(PUBLIC_KASA_RAPOR_COLLECTION).doc(token).set(payload);
      return res.json({
        success: true,
        token,
        viewUrl,
        htmlUrl,
        excelUrl: excelUrl || void 0
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kasa rapor payla\u015F\u0131m\u0131 olu\u015Fturulamad\u0131";
      return res.status(500).json({ error: message });
    }
  });
  app2.get("/api/public/kasa-rapor-share/:token", async (req, res) => {
    if (!isFirebaseAdminConfigured()) {
      return res.status(503).json({ error: "Firebase Admin yap\u0131land\u0131r\u0131lmam\u0131\u015F" });
    }
    try {
      const token = String(req.params.token || "").trim();
      if (!token || token.length < 8) {
        return res.status(400).json({ error: "Ge\xE7ersiz payla\u015F\u0131m kodu" });
      }
      const admin2 = getFirebaseAdmin();
      const snap = await admin2.firestore().collection(PUBLIC_KASA_RAPOR_COLLECTION).doc(token).get();
      if (!snap.exists) {
        return res.status(404).json({ error: "Payla\u015F\u0131m bulunamad\u0131" });
      }
      return res.json({ id: snap.id, ...snap.data() });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payla\u015F\u0131m okunamad\u0131";
      return res.status(500).json({ error: message });
    }
  });
  app2.post("/api/auth/founder-bootstrap", async (req, res) => {
    if (!isFirebaseAdminConfigured()) {
      return res.status(503).json({
        error: "Sunucu yap\u0131land\u0131rmas\u0131 eksik (FIREBASE_SERVICE_ACCOUNT_JSON). Vercel ortam de\u011Fi\u015Fkenine service account JSON ekleyin."
      });
    }
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");
      if (!email || !password) {
        return res.status(400).json({ error: "email ve password zorunlu" });
      }
      const claims = await bootstrapFounderAccount(email, password);
      return res.json({ success: true, claims });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kurucu bootstrap ba\u015Far\u0131s\u0131z";
      const status = message.includes("Ge\xE7ersiz kurucu") ? 403 : 500;
      return res.status(status).json({ error: message });
    }
  });
  app2.post("/api/auth/prepare-password-reset", async (req, res) => {
    if (!isFirebaseAdminConfigured()) {
      return res.status(503).json({
        error: "\u015Eifre s\u0131f\u0131rlama i\xE7in sunucu yap\u0131land\u0131rmas\u0131 eksik (FIREBASE_SERVICE_ACCOUNT_JSON). Vercel ortam de\u011Fi\u015Fkenine service account JSON ekleyin."
      });
    }
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      if (!email) return res.status(400).json({ error: "email zorunlu" });
      const result = await preparePasswordReset(email);
      return res.json({ success: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "\u015Eifre s\u0131f\u0131rlama haz\u0131rl\u0131\u011F\u0131 ba\u015Far\u0131s\u0131z";
      return res.status(500).json({ error: message });
    }
  });
  app2.post("/api/auth/admin/delete-user", async (req, res) => {
    if (!isFirebaseAdminConfigured()) {
      return res.status(503).json({ error: "Firebase Admin yap\u0131land\u0131r\u0131lmam\u0131\u015F" });
    }
    try {
      const idToken = await readBearerToken(req);
      if (!idToken) return res.status(401).json({ error: "Authorization Bearer token gerekli" });
      const decoded = await verifyIdToken(idToken);
      if (!callerIsYonetici(decoded)) {
        return res.status(403).json({ error: "Yaln\u0131zca y\xF6netici kullan\u0131c\u0131 silebilir" });
      }
      const email = String(req.body?.email || "").trim().toLowerCase();
      if (!email) return res.status(400).json({ error: "email zorunlu" });
      const callerEmail = String(decoded.email || "").trim().toLowerCase();
      if (email === callerEmail) {
        return res.status(400).json({ error: "Kendi hesab\u0131n\u0131z\u0131 bu u\xE7 noktadan silemezsiniz" });
      }
      await deletePortalAuthUser(email);
      return res.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kullan\u0131c\u0131 silme ba\u015Far\u0131s\u0131z";
      return res.status(500).json({ error: message });
    }
  });
  app2.post("/api/auth/provision-user", async (req, res) => {
    if (!isFirebaseAdminConfigured()) {
      return res.status(503).json({ error: "Firebase Admin yap\u0131land\u0131r\u0131lmam\u0131\u015F" });
    }
    try {
      const idToken = await readBearerToken(req);
      if (!idToken) return res.status(401).json({ error: "Authorization Bearer token gerekli" });
      const decoded = await verifyIdToken(idToken);
      if (!callerIsYonetici(decoded)) {
        return res.status(403).json({ error: "Yaln\u0131zca Y\xD6NET\u0130C\u0130 kullan\u0131c\u0131 olu\u015Fturabilir" });
      }
      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");
      if (!email || password.length < 6) {
        return res.status(400).json({ error: "email ve password (min 6) zorunlu" });
      }
      const claims = await syncClaimsForEmail(email, password);
      return res.json({ success: true, claims });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kullan\u0131c\u0131 provision ba\u015Far\u0131s\u0131z";
      return res.status(500).json({ error: message });
    }
  });
  app2.post("/api/auth/admin/update-user", async (req, res) => {
    if (!isFirebaseAdminConfigured()) {
      return res.status(503).json({ error: "Firebase Admin yap\u0131land\u0131r\u0131lmam\u0131\u015F" });
    }
    try {
      const idToken = await readBearerToken(req);
      if (!idToken) return res.status(401).json({ error: "Authorization Bearer token gerekli" });
      const decoded = await verifyIdToken(idToken);
      const callerEmail = String(decoded.email || "").trim().toLowerCase();
      if (callerEmail !== "sametatak9@gmail.com") {
        return res.status(403).json({ error: "Yaln\u0131zca sametatak9@gmail.com bu i\u015Flemi yapabilir" });
      }
      const targetEmail = String(req.body?.email || "").trim().toLowerCase();
      const newPassword = String(req.body?.password || "").trim();
      if (!targetEmail) {
        return res.status(400).json({ error: "hedef e-posta (email) zorunludur" });
      }
      if (!newPassword) {
        return res.status(400).json({ error: "Yeni \u015Fifre zorunludur" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Yeni \u015Fifre en az 6 karakter olmal\u0131d\u0131r" });
      }
      const admin2 = getFirebaseAdmin();
      const emailKey = targetEmail;
      let created = false;
      try {
        const existing = await admin2.auth().getUserByEmail(emailKey);
        await admin2.auth().updateUser(existing.uid, {
          password: newPassword,
          emailVerified: true
        });
      } catch (err) {
        const code = err?.code;
        if (code !== "auth/user-not-found") throw err;
        const kullaniciSnap = await admin2.firestore().collection("kullanicilar").doc(emailKey).get();
        if (!kullaniciSnap.exists) {
          return res.status(404).json({
            error: `${emailKey} i\xE7in ERP kullan\u0131c\u0131 kayd\u0131 bulunamad\u0131. \xD6nce Admin panelden kullan\u0131c\u0131 olu\u015Fturun.`
          });
        }
        await admin2.auth().createUser({
          email: emailKey,
          password: newPassword,
          emailVerified: true
        });
        created = true;
      }
      await syncClaimsForEmail(emailKey);
      await admin2.firestore().collection("portalKullanicilar").doc(emailKey).set(
        {
          email: emailKey,
          password: newPassword,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        { merge: true }
      );
      return res.json({
        success: true,
        created,
        message: created ? "Firebase giri\u015F hesab\u0131 olu\u015Fturuldu ve \u015Fifre atand\u0131" : "Kullan\u0131c\u0131 \u015Fifresi ba\u015Far\u0131yla g\xFCncellendi"
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kullan\u0131c\u0131 g\xFCncelleme ba\u015Far\u0131s\u0131z";
      return res.status(500).json({ error: message });
    }
  });
  app2.post("/api/auth/sync-claims", async (req, res) => {
    if (!isFirebaseAdminConfigured()) {
      return res.status(503).json({
        error: "Firebase Admin yap\u0131land\u0131r\u0131lmam\u0131\u015F. FIREBASE_SERVICE_ACCOUNT_JSON Vercel ortam de\u011Fi\u015Fkenine eklenmeli."
      });
    }
    try {
      const idToken = await readBearerToken(req);
      if (!idToken) return res.status(401).json({ error: "Authorization Bearer token gerekli" });
      const decoded = await verifyIdToken(idToken);
      const callerEmail = String(decoded.email || "").trim().toLowerCase();
      const targetEmail = String(req.body?.email || callerEmail).trim().toLowerCase();
      if (!targetEmail) return res.status(400).json({ error: "E-posta bulunamad\u0131" });
      if (targetEmail !== callerEmail && !callerIsYonetici(decoded)) {
        return res.status(403).json({ error: "Ba\u015Fka kullan\u0131c\u0131 i\xE7in claim yaln\u0131zca Y\xD6NET\u0130C\u0130 yapabilir" });
      }
      const claims = await syncClaimsForEmail(targetEmail);
      return res.json({ success: true, claims });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Claim senkronizasyonu ba\u015Far\u0131s\u0131z";
      return res.status(500).json({ error: message });
    }
  });
  app2.post("/api/auth/admin/bootstrap-all-claims", async (req, res) => {
    if (!isFirebaseAdminConfigured()) {
      return res.status(503).json({ error: "Firebase Admin yap\u0131land\u0131r\u0131lmam\u0131\u015F" });
    }
    try {
      const idToken = await readBearerToken(req);
      if (!idToken) return res.status(401).json({ error: "Authorization Bearer token gerekli" });
      const decoded = await verifyIdToken(idToken);
      if (!callerIsYonetici(decoded)) {
        return res.status(403).json({ error: "Yaln\u0131zca Y\xD6NET\u0130C\u0130 t\xFCm claimleri senkronize edebilir" });
      }
      const admin2 = (await import("firebase-admin")).default;
      const snap = await admin2.firestore().collection("kullanicilar").get();
      const results = [];
      for (const docSnap of snap.docs) {
        const email = String(docSnap.data()?.email || docSnap.id).trim().toLowerCase();
        if (!email) continue;
        try {
          await syncClaimsForEmail(email);
          results.push({ email, ok: true });
        } catch (e) {
          results.push({
            email,
            ok: false,
            error: e instanceof Error ? e.message : "hata"
          });
        }
      }
      return res.json({ success: true, count: results.length, results });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Toplu claim senkronizasyonu ba\u015Far\u0131s\u0131z";
      return res.status(500).json({ error: message });
    }
  });
  app2.post("/api/pending-signup", (req, res) => {
    try {
      const { email, password, ad, soyad, tcNo } = req.body || {};
      if (!email || !password || !ad || !soyad || !tcNo) {
        return res.status(400).json({ error: "email, password, ad, soyad, tcNo zorunludur" });
      }
      const emailKey = String(email).trim().toLowerCase();
      const saved = upsertPendingSignup({
        id: emailKey,
        email: emailKey,
        password: String(password),
        ad: String(ad).trim(),
        soyad: String(soyad).trim(),
        tcNo: String(tcNo).trim(),
        imzaText: req.body.imzaText,
        imzaStyle: req.body.imzaStyle,
        matchedPersonelId: req.body.matchedPersonelId ?? null,
        kaynak: req.body.kaynak || "kayit_formu",
        durum: "BEKLEMEDE",
        olusturulma: req.body.olusturulma || (/* @__PURE__ */ new Date()).toISOString(),
        hataSebebi: req.body.hataSebebi || "quota",
        apiYedek: true
      });
      return res.json({ success: true, item: saved });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kay\u0131t kuyru\u011Funa al\u0131namad\u0131";
      return res.status(500).json({ error: message });
    }
  });
  app2.get("/api/pending-signups", (_req, res) => {
    try {
      return res.json({ success: true, items: listPendingSignups() });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Liste okunamad\u0131";
      return res.status(500).json({ error: message });
    }
  });
  app2.delete("/api/pending-signups/:email", (req, res) => {
    try {
      const deleted = deletePendingSignup(req.params.email);
      if (!deleted) return res.status(404).json({ error: "Kay\u0131t bulunamad\u0131" });
      return res.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Silinemedi";
      return res.status(500).json({ error: message });
    }
  });
  app2.get("/api/gemini-health", async (_req, res) => {
    const result = await testGeminiConnection();
    if (result.ok) {
      return res.json({
        success: true,
        keyFormat: result.keyInfo.format,
        keyPreview: result.keyInfo.preview,
        keyHint: formatGeminiKeyHint(result.keyInfo.format),
        modelResponse: result.modelResponse,
        message: "Gemini API ba\u011Flant\u0131s\u0131 \xE7al\u0131\u015F\u0131yor."
      });
    }
    return res.status(200).json({
      success: false,
      keyFormat: result.keyInfo.format,
      keyPreview: result.keyInfo.preview,
      keyHint: formatGeminiKeyHint(result.keyInfo.format),
      error: result.error
    });
  });
  app2.post("/api/send-verification-email", (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    console.log(`
======================================================`);
    console.log(`[MAIL SIMULATION] Verification email successfully sent to: ${email}`);
    console.log(`[MAIL SIMULATION] Code: ${Math.floor(1e5 + Math.random() * 9e5)}`);
    console.log(`======================================================
`);
    res.json({ success: true, message: `Verification email simulated and sent to ${email}` });
  });
  app2.post("/api/parse-daily-yoklama", async (req, res) => {
    try {
      const { fileBase64, mimeType } = req.body;
      if (!fileBase64 || !mimeType) {
        return res.status(400).json({ error: "Missing fileBase64 or mimeType" });
      }
      const imagePart = {
        inlineData: {
          mimeType,
          data: fileBase64
        }
      };
      const promptText = `
You are an expert HR and timesheet auditing assistant.
Analyze this uploaded Daily Puantaj (Daily Attendance) Sheet.
It contains columns for employee names (Ad\u0131 Soyad\u0131), role (G\xF6revi), attendance status (Yoklama - Geldi/Yok/\u0130zinli), overtime hours (Fazla Mesai), and signature (\u0130mza).

Please extract:
1. "tarih": The date of the attendance sheet in YYYY-MM-DD format. If missing, default to the current date.
2. "yoklamaKayitlari": An array of all workers listed on the sheet with fields:
   - "adSoyad": Full name.
   - "gorev": Job title/role (e.g. \u0130\u015E\xC7\u0130, FORMEN, USTA, G\xDCVENL\u0130K, DEPOCU, etc.).
   - "durum": The attendance status mapped to one of: "Geldi", "Yok", "\u0130zinli", "Raporlu", "Pazar", "Tatil".
   - "mesaiSaati": Varsa fazla mesai saati (number, default to 0).

Provide the output strictly conforming to the response schema.
`;
      const responseSchema = {
        type: import_genai4.Type.OBJECT,
        properties: {
          tarih: { type: import_genai4.Type.STRING, description: "YYYY-MM-DD format\u0131nda yoklama tarihi" },
          yoklamaKayitlari: {
            type: import_genai4.Type.ARRAY,
            items: {
              type: import_genai4.Type.OBJECT,
              properties: {
                adSoyad: { type: import_genai4.Type.STRING },
                gorev: { type: import_genai4.Type.STRING },
                durum: { type: import_genai4.Type.STRING, description: "'Geldi', 'Yok', '\u0130zinli', 'Raporlu', 'Pazar', 'Tatil'" },
                mesaiSaati: { type: import_genai4.Type.NUMBER }
              },
              required: ["adSoyad", "durum"]
            }
          }
        },
        required: ["tarih", "yoklamaKayitlari"]
      };
      const { text } = await generateGeminiWithFallback({
        contents: [promptText, imagePart],
        config: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.1
        },
        label: "G\xFCnl\xFCk yoklama analizi"
      });
      const parsedData = JSON.parse(text);
      res.json({ success: true, data: parsedData });
    } catch (error) {
      console.error("Error in parse-daily-yoklama:", error);
      const msg = error.message || "Failed to parse daily yoklama sheet";
      const status = /zaman aşımı|timeout|504/i.test(msg) ? 504 : 500;
      res.status(status).json({ error: msg });
    }
  });
  app2.post("/api/parse-monthly-excel-yoklama", async (req, res) => {
    try {
      const { fileBase64, mimeType } = req.body;
      if (!fileBase64 || !mimeType) {
        return res.status(400).json({ error: "Missing fileBase64 or mimeType" });
      }
      const imagePart = {
        inlineData: { mimeType, data: fileBase64 }
      };
      const promptText = `
You are an expert HR timesheet auditor for Turkish construction sites.
Analyze this MONTHLY Excel puantaj sheet. Each employee occupies a block of rows:
- Row 1: ID number, full name (AD SOYAD), status, exit date, days worked count, job title, salary
- Row 2: "TAR\u0130H" label followed by day numbers like 1.2, 2.2, ... 28.2 (day.month format)
- Row 3: "\xC7ALI\u015EMA" label followed by "X" marks under days the employee worked
- Row 4 (optional): "MESA\u0130" row with overtime hours

Extract:
1. "yil": 4-digit year (infer from dates, default 2026)
2. "ay": month number 1-12 (infer from date row like ".2" = February = 2)
3. "personelKayitlari": array of each employee block:
   - "excelId": the numeric ID in column 1 (unique per person on this sheet)
   - "adSoyad": full name exactly as written
   - "gorev": job title (default "D\xDCZ \u0130\u015E\xC7\u0130")
   - "calismaGunleri": array of day numbers (1-31) where X appears in \xC7ALI\u015EMA row
   - "mesaiGunleri": optional object mapping day number to overtime hours
   - "istenCikisTarihi": exit date as YYYY-MM-DD if visible (e.g. \xC7IKI\u015E 10.03 \u2192 2026-03-10)

Be precise with Turkish names (\u0130, \u015E, \u011E, \xDC, \xD6, \xC7). Each excelId is a distinct person even if names are similar.
`;
      const responseSchema = {
        type: import_genai4.Type.OBJECT,
        properties: {
          yil: { type: import_genai4.Type.NUMBER },
          ay: { type: import_genai4.Type.NUMBER },
          personelKayitlari: {
            type: import_genai4.Type.ARRAY,
            items: {
              type: import_genai4.Type.OBJECT,
              properties: {
                excelId: { type: import_genai4.Type.NUMBER },
                adSoyad: { type: import_genai4.Type.STRING },
                gorev: { type: import_genai4.Type.STRING },
                calismaGunleri: { type: import_genai4.Type.ARRAY, items: { type: import_genai4.Type.NUMBER } },
                mesaiGunleri: { type: import_genai4.Type.OBJECT, additionalProperties: { type: import_genai4.Type.NUMBER } },
                istenCikisTarihi: { type: import_genai4.Type.STRING }
              },
              required: ["excelId", "adSoyad", "calismaGunleri"]
            }
          }
        },
        required: ["yil", "ay", "personelKayitlari"]
      };
      const { text } = await generateGeminiWithFallback({
        contents: [promptText, imagePart],
        config: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.1
        },
        label: "Ayl\u0131k Excel yoklama analizi"
      });
      res.json({ success: true, data: JSON.parse(text) });
    } catch (error) {
      console.error("Error in parse-monthly-excel-yoklama:", error);
      const msg = error.message || "Failed to parse monthly excel yoklama";
      const status = /zaman aşımı|timeout|504/i.test(msg) ? 504 : 500;
      res.status(status).json({ error: msg });
    }
  });
  app2.post("/api/parse-sgk", async (req, res) => {
    try {
      const { fileBase64, mimeType } = req.body;
      if (!fileBase64 || !mimeType) {
        return res.status(400).json({ error: "Missing fileBase64 or mimeType in request body" });
      }
      const imagePart = {
        inlineData: {
          mimeType,
          data: fileBase64
        }
      };
      const promptText = `
You are an expert HR and financial assistant.
Analyze this document. It could be either:
1. A Turkish SGK Job Entry Declaration ("S\u0130GORTALI \u0130\u015EE G\u0130R\u0130\u015E B\u0130LD\u0130RGES\u0130")
2. A Bank Transfer/Payment Receipt ("DEKONT" / "\xD6DEME DEKONTU" / "EFT / HAVALE DEKONTU")

Please extract the following fields and map them to our personnel database structure:

If it is a SGK Job Entry Declaration:
- "tcNo": SOSYAL G\xDCVENL\u0130K S\u0130C\u0130L NUMARASI (T.C. K\u0130ML\u0130K NUMARASI) (11-digit string).
- "ad": Employee name ("Ad\u0131").
- "soyad": Employee surname ("Soyad\u0131").
- "babaAdi": "Baba Ad\u0131".
- "dogumTarihi": Birth date in "YYYY-MM-DD" format.
- "iseGirisTarihi": Employment start date in "YYYY-MM-DD" format.
- "cinsiyet": Gender ("Erkek" or "Kad\u0131n").
- "adres": "\u0130KAMETGAH ADRES\u0130" combining details.
- "il" & "ilce": Province & District of residence.
- "gorev": Infer role based on "Meslek Ad\u0131" (one of "\u0130\u015E\xC7\u0130", "FORMEN", "USTA", "M\xDCHEND\u0130S", "M\u0130MAR", "\u015EEF", "G\xDCVENL\u0130K", "DEPOCU").

If it is a DEKONT (Payment/Transfer Receipt):
- "ad" and "soyad": Extract from "Al\u0131c\u0131 Ad\u0131 Soyad\u0131" or "Al\u0131c\u0131" field (the receiver of the money).
- "ibanNo": Extract the Al\u0131c\u0131 IBAN number (starting with TR). Remove spaces.
- "bankaAdi": Extract the Al\u0131c\u0131 Bank name (the bank receiving the payment, e.g., "GARANT\u0130 BBVA", "Z\u0130RAAT BANKASI", "VAKIFBANK", etc.).
- "tcNo": Extract the Al\u0131c\u0131 TC Kimlik No if visible, otherwise leave blank.
- "iseGirisTarihi": Use the transaction date / transfer date of the Dekont in "YYYY-MM-DD" format.
- "gorev": Default to "\u0130\u015E\xC7\u0130" or infer if possible.

Provide the output strictly conforming to the response schema.
`;
      const sgkResponseSchema = {
        type: import_genai4.Type.OBJECT,
        properties: {
          tcNo: { type: import_genai4.Type.STRING, description: "11-digit Turkish TC Identification Number or receiver's TC" },
          ad: { type: import_genai4.Type.STRING, description: "First name" },
          soyad: { type: import_genai4.Type.STRING, description: "Last name" },
          babaAdi: { type: import_genai4.Type.STRING, description: "Father's name" },
          dogumTarihi: { type: import_genai4.Type.STRING, description: "Birthdate in YYYY-MM-DD format" },
          iseGirisTarihi: { type: import_genai4.Type.STRING, description: "Employment start date or transfer date in YYYY-MM-DD format" },
          cinsiyet: { type: import_genai4.Type.STRING, description: "Gender: 'Erkek' or 'Kad\u0131n'" },
          adres: { type: import_genai4.Type.STRING, description: "Full residential address" },
          il: { type: import_genai4.Type.STRING, description: "Residence province" },
          ilce: { type: import_genai4.Type.STRING, description: "Residence district" },
          gorev: { type: import_genai4.Type.STRING, description: "Role: '\u0130\u015E\xC7\u0130', 'FORMEN', 'USTA', 'M\u0130MAR', 'M\xDCHEND\u0130S', '\u015EEF', 'G\xDCVENL\u0130K', or 'DEPOCU'" },
          ibanNo: { type: import_genai4.Type.STRING, description: "Al\u0131c\u0131 IBAN number starting with TR" },
          bankaAdi: { type: import_genai4.Type.STRING, description: "Al\u0131c\u0131 Bank name" }
        },
        required: ["ad", "soyad"]
      };
      const { text } = await generateGeminiWithFallback({
        contents: [imagePart, promptText],
        config: {
          responseMimeType: "application/json",
          responseSchema: sgkResponseSchema
        },
        label: "SGK/Dekont analizi"
      });
      const parsedData = JSON.parse(text);
      res.json({ success: true, data: parsedData });
    } catch (error) {
      console.error("Error parsing SGK PDF/Image via Gemini:", error);
      const msg = error.message || "Failed to parse SGK document";
      const status = /zaman aşımı|timeout|504/i.test(msg) ? 504 : 500;
      res.status(status).json({ error: msg });
    }
  });
  app2.post("/api/parse-taseron-grup", async (req, res) => {
    try {
      const { fileBase64, mimeType, fileName, caption } = req.body;
      if (!fileBase64 || !mimeType) {
        return res.status(400).json({ error: "Missing fileBase64 or mimeType in request body" });
      }
      const { parsed, source } = await parseTaseronGrupUpload({
        fileBase64: String(fileBase64),
        mimeType: String(mimeType),
        fileName: String(fileName || ""),
        caption: String(caption || "")
      });
      res.json({ success: true, data: parsed, source });
    } catch (error) {
      console.error("Error parsing ta\u015Feron grup PDF/Image:", error);
      const msg = error.message || "Failed to parse ta\u015Feron group document";
      const status = /zaman aşımı|timeout|504/i.test(msg) ? 504 : 500;
      res.status(status).json({ error: msg });
    }
  });
  app2.get("/api/taseron-grup-intake", (_req, res) => {
    res.json({ success: true, sozlesme: taseronGrupOtomasyonSozlesme() });
  });
  app2.post("/api/taseron-grup-intake", async (req, res) => {
    try {
      const { fileBase64, mimeType, fileName, caption, writeQueue, gonderen } = req.body || {};
      if (!fileBase64 || !mimeType) {
        return res.status(400).json({ error: "Missing fileBase64 or mimeType" });
      }
      const { parsed, source } = await parseTaseronGrupUpload({
        fileBase64: String(fileBase64),
        mimeType: String(mimeType),
        fileName: String(fileName || ""),
        caption: String(caption || "")
      });
      if (!writeQueue) {
        return res.json({ success: true, data: parsed, source, queued: false });
      }
      if (!isTaseronGrupIntakeConfigured() || !intakeSecretOk(req.headers["x-intake-secret"])) {
        return res.status(401).json({ error: "Intake secret gerekli (X-Intake-Secret)." });
      }
      const queue = await enqueueTaseronGrupParse({
        parsed,
        gonderen: String(gonderen || "otomasyon"),
        evrakDataUrl: `data:${mimeType};base64,${fileBase64}`
      });
      res.json({ success: true, data: parsed, source, queued: Boolean(queue.id), ...queue });
    } catch (error) {
      console.error("ta\u015Feron grup intake:", error);
      const msg = error.message || "Intake ba\u015Far\u0131s\u0131z";
      const status = /zaman aşımı|timeout|504/i.test(msg) ? 504 : 500;
      res.status(status).json({ error: msg });
    }
  });
  app2.get("/api/webhooks/whatsapp-taseron-grup", (req, res) => {
    const mode = String(req.query["hub.mode"] || "");
    const token = String(req.query["hub.verify_token"] || "");
    const challenge = String(req.query["hub.challenge"] || "");
    const expected = String(process.env.WHATSAPP_VERIFY_TOKEN || "").trim();
    if (mode === "subscribe" && expected && token === expected) {
      return res.status(200).send(challenge);
    }
    res.status(403).json({ error: "WhatsApp verify token uyu\u015Fmad\u0131 veya tan\u0131ml\u0131 de\u011Fil." });
  });
  app2.post("/api/webhooks/whatsapp-taseron-grup", async (req, res) => {
    if (!isWhatsAppTaseronWebhookConfigured()) {
      return res.status(503).json({
        error: "WhatsApp otomasyonu yap\u0131land\u0131r\u0131lmam\u0131\u015F. Mevcut grup dinlenemez; WHATSAPP_ACCESS_TOKEN + WHATSAPP_VERIFY_TOKEN gerekir."
      });
    }
    try {
      const messages = [];
      const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
      for (const entry of entries) {
        const changes = Array.isArray(entry?.changes) ? entry.changes : [];
        for (const change of changes) {
          const batch = change?.value?.messages;
          if (Array.isArray(batch)) messages.push(...batch);
        }
      }
      const result = await handleWhatsAppTaseronMessages(messages);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error("WhatsApp ta\u015Feron webhook:", error);
      res.status(200).json({ success: false, error: error.message || "webhook hata" });
    }
  });
  app2.post("/api/parse-kimlik", async (req, res) => {
    try {
      const { onYuzBase64, arkaYuzBase64, mimeType } = req.body;
      if (!onYuzBase64) {
        return res.status(400).json({ error: "Kimlik \xF6n y\xFCz (onYuzBase64) zorunludur." });
      }
      const parts = [
        {
          inlineData: {
            mimeType: mimeType || "image/jpeg",
            data: onYuzBase64
          }
        }
      ];
      if (arkaYuzBase64) {
        parts.push({
          inlineData: {
            mimeType: mimeType || "image/jpeg",
            data: arkaYuzBase64
          }
        });
      }
      const promptText = `
Analyze the uploaded image(s) of a Turkish Republic Identity Card (T.C. Kimlik Kart\u0131).
The first image is the FRONT side. If a second image exists, it is the BACK side.

Rules:
1. Confirm whether the images show a valid Turkish ID card (not a random photo, selfie, or unrelated document).
2. Extract readable fields from front: TC Kimlik No (11 digits), Ad, Soyad, Baba Ad\u0131, Do\u011Fum Tarihi (YYYY-MM-DD), Cinsiyet (Erkek/Kad\u0131n).
3. If back side provided, use it to improve validation.
4. Set kimlikGecerli=false if images are blurry, not an ID card, or missing critical front data.
5. List missing field keys in eksikAlanlar (e.g. tcNo, ad, soyad, babaAdi, dogumTarihi, cinsiyet).
6. Provide a short Turkish uyari message when kimlikGecerli is false.

Output strictly as JSON per schema.
`;
      const kimlikSchema = {
        type: import_genai4.Type.OBJECT,
        properties: {
          tcNo: { type: import_genai4.Type.STRING },
          ad: { type: import_genai4.Type.STRING },
          soyad: { type: import_genai4.Type.STRING },
          babaAdi: { type: import_genai4.Type.STRING },
          dogumTarihi: { type: import_genai4.Type.STRING },
          cinsiyet: { type: import_genai4.Type.STRING },
          seriNo: { type: import_genai4.Type.STRING },
          kimlikGecerli: { type: import_genai4.Type.BOOLEAN },
          kimlikTipi: { type: import_genai4.Type.STRING },
          eksikAlanlar: { type: import_genai4.Type.ARRAY, items: { type: import_genai4.Type.STRING } },
          uyari: { type: import_genai4.Type.STRING }
        },
        required: ["kimlikGecerli", "eksikAlanlar"]
      };
      const { text } = await generateGeminiWithFallback({
        contents: [...parts, promptText],
        config: {
          responseMimeType: "application/json",
          responseSchema: kimlikSchema
        },
        label: "Kimlik kart\u0131 analizi"
      });
      res.json({ success: true, data: JSON.parse(text) });
    } catch (error) {
      console.error("Error parsing kimlik:", error);
      const msg = error.message || "Kimlik analizi ba\u015Far\u0131s\u0131z";
      res.status(500).json({ error: msg });
    }
  });
  app2.post("/api/parse-irsaliye", async (req, res) => {
    try {
      const { fileBase64, mimeType } = req.body;
      if (!fileBase64 || !mimeType) {
        return res.status(400).json({ error: "Missing fileBase64 or mimeType in request body" });
      }
      const imagePart = {
        inlineData: {
          mimeType,
          data: fileBase64
        }
      };
      const responseSchema = {
        type: import_genai4.Type.OBJECT,
        properties: {
          irsaliyeNo: { type: import_genai4.Type.STRING },
          tarih: { type: import_genai4.Type.STRING },
          firma: { type: import_genai4.Type.STRING },
          kalemler: {
            type: import_genai4.Type.ARRAY,
            items: {
              type: import_genai4.Type.OBJECT,
              properties: {
                urunAdi: { type: import_genai4.Type.STRING },
                miktar: { type: import_genai4.Type.NUMBER },
                birim: { type: import_genai4.Type.STRING }
              },
              required: ["urunAdi", "miktar", "birim"]
            }
          }
        },
        required: ["irsaliyeNo", "tarih", "firma", "kalemler"]
      };
      const userPrompt = "L\xFCtfen ekteki teslimat irsaliyesi (waybill / delivery note) belgesini analiz et. \u0130rsaliye numaras\u0131n\u0131 (irsaliyeNo), tarihini (tarih) (YYYY-MM-DD format\u0131nda), g\xF6nderen / sat\u0131c\u0131 firma ad\u0131n\u0131 (firma) ve teslim edilen t\xFCm malzeme kalemlerini (kalemler listesi alt\u0131nda urunAdi, miktar ve birim olarak) \xE7\u0131kar.";
      const { text } = await generateGeminiWithFallback({
        contents: [userPrompt, imagePart],
        config: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.1
        },
        label: "\u0130rsaliye analizi"
      });
      const parsedData = JSON.parse(text);
      res.json({ success: true, data: parsedData });
    } catch (error) {
      console.error("Error parsing \u0130rsaliye PDF/Image via Gemini:", error);
      const msg = error.message || "Failed to parse waybill document";
      const status = /zaman aşımı|timeout|504/i.test(msg) ? 504 : 500;
      res.status(status).json({ error: msg });
    }
  });
  app2.post("/api/parse-fatura", async (req, res) => {
    try {
      const { fileBase64, mimeType } = req.body;
      if (!fileBase64 || !mimeType) {
        return res.status(400).json({ error: "Missing fileBase64 or mimeType in request body" });
      }
      const imagePart = {
        inlineData: {
          mimeType,
          data: fileBase64
        }
      };
      const responseSchema = {
        type: import_genai4.Type.OBJECT,
        properties: {
          faturaNo: { type: import_genai4.Type.STRING },
          tarih: { type: import_genai4.Type.STRING },
          firma: { type: import_genai4.Type.STRING },
          kalemler: {
            type: import_genai4.Type.ARRAY,
            items: {
              type: import_genai4.Type.OBJECT,
              properties: {
                urunAdi: { type: import_genai4.Type.STRING },
                miktar: { type: import_genai4.Type.NUMBER },
                birim: { type: import_genai4.Type.STRING },
                birimFiyat: { type: import_genai4.Type.NUMBER },
                kdvOran: { type: import_genai4.Type.NUMBER },
                toplam: { type: import_genai4.Type.NUMBER }
              },
              required: ["urunAdi", "miktar", "birim", "birimFiyat", "kdvOran", "toplam"]
            }
          },
          toplamTutar: { type: import_genai4.Type.NUMBER },
          kdvTutar: { type: import_genai4.Type.NUMBER },
          genelToplam: { type: import_genai4.Type.NUMBER }
        },
        required: ["faturaNo", "tarih", "firma", "kalemler", "toplamTutar", "kdvTutar", "genelToplam"]
      };
      const userPrompt = "L\xFCtfen ekteki faturay\u0131 (invoice) analiz et. Fatura numaras\u0131n\u0131 (faturaNo), faturan\u0131n kesildi\u011Fi tarihi (tarih) (YYYY-MM-DD format\u0131nda), sat\u0131c\u0131 firma ad\u0131n\u0131 (firma), faturadaki t\xFCm mal veya hizmet kalemlerini (kalemler listesi alt\u0131nda urunAdi, miktar, birim, birimFiyat, kdvOran y\xFCzde olarak \xF6rn. 20, ve toplam tutar\u0131) \xE7\u0131kar. Ayr\u0131ca toplam matrah\u0131 (toplamTutar), KDV tutar\u0131n\u0131 (kdvTutar) ve \xF6denecek genel toplam\u0131 (genelToplam) \xE7\u0131kar.";
      const { text } = await generateGeminiWithFallback({
        contents: [userPrompt, imagePart],
        config: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.1
        },
        label: "Fatura analizi"
      });
      const parsedData = JSON.parse(text);
      res.json({ success: true, data: parsedData });
    } catch (error) {
      console.error("Error parsing Fatura PDF/Image via Gemini:", error);
      const msg = error.message || "Failed to parse invoice document";
      const status = /zaman aşımı|timeout|504/i.test(msg) ? 504 : 500;
      res.status(status).json({ error: msg });
    }
  });
  app2.post("/api/compare-3way", async (req, res) => {
    try {
      const { saTalebi, irsaliyeler, fatura, compareFocus, customInstructions, userEdits } = req.body;
      if (!fatura) {
        return res.status(400).json({ error: "Missing fatura data in request body" });
      }
      const responseSchema = {
        type: import_genai4.Type.OBJECT,
        properties: {
          status: { type: import_genai4.Type.STRING, description: "Must be either 'SORUNSUZ ONAY' or 'SORUNLU'" },
          discrepancies: {
            type: import_genai4.Type.ARRAY,
            items: { type: import_genai4.Type.STRING },
            description: "List of found differences or discrepancies, empty if none"
          },
          reportText: { type: import_genai4.Type.STRING, description: "A detailed Turkish summary comparing PO vs Waybills vs Invoice" }
        },
        required: ["status", "discrepancies", "reportText"]
      };
      const focusList = Array.isArray(compareFocus) && compareFocus.length ? compareFocus.join(", ") : "miktar, \xFCr\xFCn ad\u0131, birim, firma, fiyat, kg-ton d\xF6n\xFC\u015F\xFCm\xFC";
      const editsBlock = Array.isArray(userEdits) && userEdits.length ? `

KULLANICI KAR\u015EILA\u015ETIRMA \xD6NCES\u0130 MANUEL D\xDCZENLEMELER (raporun EN ALTINDA ayr\u0131 b\xF6l\xFCmde listele):
${JSON.stringify(userEdits, null, 2)}` : "";
      const customBlock = customInstructions?.trim() ? `

KULLANICI TAL\u0130MATI (\xF6ncelikli): ${customInstructions.trim()}` : "";
      const promptText = `
You are an expert construction auditor and accountant.
Perform a strict 3-way match audit between:
1. Sat\u0131n Alma Sipari\u015Fi (Purchase Order):
${JSON.stringify(saTalebi || "No PO linked", null, 2)}

2. Ba\u011Fl\u0131 \u0130rsaliyeler (Delivery Waybills):
${JSON.stringify(irsaliyeler || "No waybills linked", null, 2)}

3. Gelen Fatura (Invoice):
${JSON.stringify(fatura, null, 2)}

KULLANICI SADECE \u015EUNLARI KAR\u015EILA\u015ETIRMANI \u0130ST\u0130YOR: ${focusList}
${customBlock}
${editsBlock}

Perform a comparison of:
- Item names / categories (normalize differences like typo variants, e.g. "Stablize" vs "Stabilize", "M\u0131c\u0131r", "Grovak", "Ta\u015F Tozu").
- Quantities ordered in PO vs quantities delivered in waybills vs quantities billed in invoice.
- Any price discrepancies if unit prices are specified.

CRITICAL UNIT CONVERSION RULE:
- For construction bulk materials like "M\u0131c\u0131r", "Stabilize" (or "Stablize"), "Grovak", and "Ta\u015F Tozu":
  - The PO might specify quantity in "TIR" (Trucks) (e.g., 2 TIR).
  - The Waybills specify weight in "KG" (e.g., 50000 KG total).
  - The Invoice specifies weight in "TON" (e.g., 50 TON).
  - Standard shantiye conversion rate: 1 TIR is approximately 25 TON (25,000 KG).
  - Add up the Waybill weights (in KG) and convert to TON (KG / 1000). Compare it with the TON billed in the Invoice, and ensure they match the TIR ordered in the PO (allowing a +/- 5% scale tolerance).
  - If the math matches within tolerance, treat this as a perfect match ("SORUNSUZ ONAY") and detail the math clearly in your report.

Audit Rules:
- If all quantities and items match perfectly (meaning what was ordered matches what was delivered, which in turn matches what was billed), return status as "SORUNSUZ ONAY".
- If there is any discrepancy (e.g., delivered quantity is different from billed quantity, or items on invoice don't exist in waybills or PO), list them in 'discrepancies' and return status as "SORUNLU".
- Write a beautifully styled Turkish markdown report summary in 'reportText'. Explain details clearly to a site manager.
- If userEdits were provided, add a final section "Kullan\u0131c\u0131 D\xFCzenlemeleri" listing each change.

Provide the response strictly conforming to the requested schema.
`;
      const { text } = await generateGeminiWithFallback({
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.1
        },
        label: "3-way kar\u015F\u0131la\u015Ft\u0131rma"
      });
      const parsedData = JSON.parse(text);
      res.json({ success: true, data: parsedData });
    } catch (error) {
      console.error("Error in AI 3-Way Match:", error);
      const msg = error.message || "Failed to perform 3-way comparison";
      const status = /zaman aşımı|timeout|504/i.test(msg) ? 504 : 500;
      res.status(status).json({ error: msg });
    }
  });
  app2.post("/api/analyze-linked-evrak", async (req, res) => {
    try {
      const { saTalebi, irsaliyeler, fatura, kalemBaglantilari, analizOdak, ozelTalimat } = req.body;
      const responseSchema = {
        type: import_genai4.Type.OBJECT,
        properties: {
          status: { type: import_genai4.Type.STRING, description: "Must be either 'SORUNSUZ ONAY' or 'SORUNLU'" },
          discrepancies: {
            type: import_genai4.Type.ARRAY,
            items: { type: import_genai4.Type.STRING },
            description: "List of found differences or discrepancies, empty if none"
          },
          reportText: { type: import_genai4.Type.STRING, description: "Detailed Turkish markdown analysis report" }
        },
        required: ["status", "discrepancies", "reportText"]
      };
      const focusList = Array.isArray(analizOdak) && analizOdak.length ? analizOdak.join(", ") : "miktar, firma, tarih, tutar, \xFCr\xFCn ad\u0131, birim, fiyat";
      const customBlock = ozelTalimat?.trim() ? `

KULLANICI TAL\u0130MATI (\xF6ncelikli): ${ozelTalimat.trim()}` : "";
      const kalemBlock = Array.isArray(kalemBaglantilari) && kalemBaglantilari.length ? `

KULLANICI ONAYLI KALEM BA\u011ELANTILARI (bu e\u015Fle\u015Ftirmelere g\xF6re analiz yap):
${JSON.stringify(kalemBaglantilari, null, 2)}` : "";
      const promptText = `
You are an expert construction auditor and accountant for a Turkish construction site ERP.
Analyze the following linked documents as a group. The user has explicitly linked line items between documents.

1. Sat\u0131n Alma Sipari\u015Fi (Purchase Order):
${JSON.stringify(saTalebi || "Ba\u011Fl\u0131 PO yok", null, 2)}

2. Ba\u011Fl\u0131 \u0130rsaliyeler (Delivery Waybills):
${JSON.stringify(irsaliyeler || [], null, 2)}

3. Fatura (Invoice):
${JSON.stringify(fatura || "Ba\u011Fl\u0131 fatura yok", null, 2)}
${kalemBlock}

KULLANICI ANAL\u0130Z ODA\u011EI: ${focusList}
${customBlock}

Rules:
- Focus your analysis primarily on the user's selected focus areas (${focusList}).
- Respect the kalem ba\u011Flant\u0131lar\u0131 \u2014 compare linked line items across SA \u2192 \u0130rsaliye \u2192 Fatura.
- For bulk materials (M\u0131c\u0131r, Stabilize, Grovak, Ta\u015F Tozu): apply 1 TIR \u2248 25 TON conversion with \xB15% tolerance when comparing TIR/KG/TON.
- If quantities, amounts, dates, and firms align within tolerance, status = "SORUNSUZ ONAY".
- Otherwise status = "SORUNLU" and list discrepancies.
- Write a professional Turkish markdown report in reportText for a site manager. Include summary, detail per focus area, and recommendations.

Provide the response strictly conforming to the requested schema.
`;
      const { text } = await generateGeminiWithFallback({
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.1
        },
        label: "Ba\u011Fl\u0131 evrak analizi"
      });
      const parsedData = JSON.parse(text);
      res.json({ success: true, data: parsedData });
    } catch (error) {
      console.error("Error in AI linked evrak analysis:", error);
      const msg = error.message || "Failed to analyze linked evrak";
      const status = /zaman aşımı|timeout|504/i.test(msg) ? 504 : 500;
      res.status(status).json({ error: msg });
    }
  });
  app2.post("/api/generate-tutanak", async (req, res) => {
    try {
      const { konu, detaylar, muhatap } = req.body;
      if (!konu || !detaylar) {
        return res.status(400).json({ error: "Missing konu or detaylar in request body" });
      }
      const prompt = `
L\xFCtfen \u015Fantiye y\xF6netimi i\xE7in resmi ve hukuki a\xE7\u0131dan ge\xE7erli T\xFCrk\xE7e bir tutanak tasla\u011F\u0131 haz\u0131rla.
- Tutanak Konusu: ${konu}
- Olay / Durum Detaylar\u0131: ${detaylar}
- Muhatap / \u0130lgili Taraf: ${muhatap || "Belirtilmemi\u015F"}

Tutanak i\xE7eri\u011Fini resmi, a\u011F\u0131rba\u015Fl\u0131 ve \u015Fantiye mevzuatlar\u0131na uygun hukuk diliyle yaz. En altta "Haz\u0131rlayan / \u015Eantiye \u015Eefi" ve "Muhatap / Teslim Alan" imza b\xF6l\xFCmleri olsun. HTML veya Markdown format\u0131nda yazma, d\xFCz metin olsun.
`;
      const { text } = await generateGeminiWithFallback({
        contents: prompt,
        label: "Tutanak olu\u015Fturma"
      });
      res.json({ success: true, text });
    } catch (error) {
      console.error("Error in generate-tutanak:", error);
      res.status(500).json({ error: error.message || "Failed to generate tutanak" });
    }
  });
  app2.post("/api/parse-legacy-document", async (req, res) => {
    try {
      const { fileBase64, mimeType, docType } = req.body;
      if (!fileBase64 || !mimeType || !docType) {
        return res.status(400).json({ error: "Missing fileBase64, mimeType or docType in request body" });
      }
      const imagePart = {
        inlineData: {
          mimeType,
          data: fileBase64
        }
      };
      let responseSchema;
      let userPrompt = "";
      if (docType === "fatura") {
        responseSchema = {
          type: import_genai4.Type.OBJECT,
          properties: {
            faturaNo: { type: import_genai4.Type.STRING },
            tarih: { type: import_genai4.Type.STRING, description: "YYYY-MM-DD format\u0131nda tarih" },
            cariUnvan: { type: import_genai4.Type.STRING, description: "Faturay\u0131 kesen / satan sat\u0131c\u0131 firma ad\u0131 (cari \xFCnvan)" },
            toplamTutar: { type: import_genai4.Type.NUMBER, description: "Toplam matrah tutar\u0131 (KDV hari\xE7)" },
            kdvTutar: { type: import_genai4.Type.NUMBER, description: "Toplam hesaplanan KDV tutar\u0131" },
            genelToplam: { type: import_genai4.Type.NUMBER, description: "\xD6denecek genel toplam tutar (KDV dahil)" },
            kalemler: {
              type: import_genai4.Type.ARRAY,
              items: {
                type: import_genai4.Type.OBJECT,
                properties: {
                  urunAdi: { type: import_genai4.Type.STRING, description: "\xDCr\xFCn veya hizmet ad\u0131" },
                  miktar: { type: import_genai4.Type.NUMBER, description: "Miktar" },
                  birim: { type: import_genai4.Type.STRING, description: "Birim (ADET, KG, TON, M3 vb.)" },
                  birimFiyat: { type: import_genai4.Type.NUMBER, description: "Birim fiyat\u0131" },
                  kdvOran: { type: import_genai4.Type.NUMBER, description: "KDV oran\u0131 y\xFCzde olarak (\xF6rn: 20)" },
                  toplam: { type: import_genai4.Type.NUMBER, description: "Kalem toplam\u0131" }
                },
                required: ["urunAdi", "miktar", "birim", "birimFiyat", "kdvOran", "toplam"]
              }
            }
          },
          required: ["faturaNo", "tarih", "cariUnvan", "toplamTutar", "kdvTutar", "genelToplam", "kalemler"]
        };
        userPrompt = "L\xFCtfen ekteki faturay\u0131 (invoice) analiz et. Fatura numaras\u0131n\u0131, tarihini (YYYY-MM-DD format\u0131nda), faturay\u0131 kesen firma \xFCnvan\u0131n\u0131, toplam matrah\u0131, KDV tutar\u0131n\u0131, genel toplam\u0131 ve kalem listesini (urunAdi, miktar, birim, birimFiyat, kdvOran, toplam) \xE7\u0131kar.";
      } else if (docType === "irsaliye") {
        responseSchema = {
          type: import_genai4.Type.OBJECT,
          properties: {
            irsaliyeNo: { type: import_genai4.Type.STRING },
            tarih: { type: import_genai4.Type.STRING, description: "YYYY-MM-DD format\u0131nda tarih" },
            firma: { type: import_genai4.Type.STRING, description: "Sevk eden / g\xF6nderen firma ad\u0131" },
            kalemler: {
              type: import_genai4.Type.ARRAY,
              items: {
                type: import_genai4.Type.OBJECT,
                properties: {
                  urunAdi: { type: import_genai4.Type.STRING, description: "Malzeme ad\u0131" },
                  miktar: { type: import_genai4.Type.NUMBER, description: "Miktar" },
                  birim: { type: import_genai4.Type.STRING, description: "Birim (ADET, KG, TON vb.)" }
                },
                required: ["urunAdi", "miktar", "birim"]
              }
            }
          },
          required: ["irsaliyeNo", "tarih", "firma", "kalemler"]
        };
        userPrompt = "L\xFCtfen ekteki irsaliyeyi (waybill / sevk irsaliyesi) analiz et. \u0130rsaliye numaras\u0131n\u0131, tarihini (YYYY-MM-DD format\u0131nda), sevk eden firma \xFCnvan\u0131n\u0131 ve sevk edilen malzeme listesini (urunAdi, miktar, birim) \xE7\u0131kar.";
      } else if (docType === "makbuz") {
        responseSchema = {
          type: import_genai4.Type.OBJECT,
          properties: {
            referansId: { type: import_genai4.Type.STRING, description: "Makbuz numaras\u0131, i\u015Flem no veya dekont referans no" },
            tarih: { type: import_genai4.Type.STRING, description: "YYYY-MM-DD format\u0131nda i\u015Flem tarihi" },
            aciklama: { type: import_genai4.Type.STRING, description: "\xD6deme a\xE7\u0131klamas\u0131 veya makbuz i\xE7eri\u011Fi" },
            tutar: { type: import_genai4.Type.NUMBER, description: "\xD6denen / tahsil edilen toplam tutar" },
            firma: { type: import_genai4.Type.STRING, description: "\xD6demeyi yapan ya da alan muhatap firma/ki\u015Fi ad\u0131" },
            hareketTipi: { type: import_genai4.Type.STRING, description: "\u0130\u015Flem tipine g\xF6re '\xC7IKI\u015E' (\xF6deme yap\u0131ld\u0131ysa) veya 'G\u0130R\u0130\u015E' (tahsilat/para al\u0131nd\u0131ysa)" }
          },
          required: ["referansId", "tarih", "aciklama", "tutar", "firma", "hareketTipi"]
        };
        userPrompt = "L\xFCtfen ekteki makbuzu, tediye fi\u015Fini, gider makbuzunu veya banka dekontunu analiz et. Referans numaras\u0131n\u0131/makbuz no, tarihini (YYYY-MM-DD), a\xE7\u0131klamas\u0131n\u0131, \xF6denen/al\u0131nan net tutar\u0131, muhatap firma veya ki\u015Fi ad\u0131n\u0131 ve para \xE7\u0131k\u0131\u015F\u0131 ise '\xC7IKI\u015E', para giri\u015Fi ise 'G\u0130R\u0130\u015E' olacak \u015Fekilde hareketTipi alan\u0131n\u0131 \xE7\u0131kar.";
      } else if (docType === "hakedis") {
        responseSchema = {
          type: import_genai4.Type.OBJECT,
          properties: {
            faturaNo: { type: import_genai4.Type.STRING, description: "Hakedi\u015F kapa\u011F\u0131 no, fatura no veya hakedi\u015F no" },
            donem: { type: import_genai4.Type.STRING, description: "Hangi d\xF6neme ait oldu\u011Fu (\xF6rn: Haziran 2026, Hakedi\u015F No: 3 vb.)" },
            tarih: { type: import_genai4.Type.STRING, description: "YYYY-MM-DD format\u0131nda hakedi\u015F onay veya d\xFCzenleme tarihi" },
            cariUnvan: { type: import_genai4.Type.STRING, description: "Hakedi\u015F sahibi y\xFCklenici / ta\u015Feron / ana firma ad\u0131" },
            toplamTutar: { type: import_genai4.Type.NUMBER, description: "KDV hari\xE7 hakedi\u015F tutar\u0131 (ara toplam)" },
            kdvTutar: { type: import_genai4.Type.NUMBER, description: "Hakedi\u015F KDV tutar\u0131" },
            genelToplam: { type: import_genai4.Type.NUMBER, description: "KDV dahil \xF6denecek hakedi\u015F toplam tutar\u0131" },
            aciklama: { type: import_genai4.Type.STRING, description: "Hakedi\u015F a\xE7\u0131klamas\u0131, yap\u0131lan i\u015Fler vb. detaylar" }
          },
          required: ["faturaNo", "donem", "tarih", "cariUnvan", "toplamTutar", "kdvTutar", "genelToplam", "aciklama"]
        };
        userPrompt = "L\xFCtfen ekteki hakedi\u015F belgesini, hakedi\u015F kapa\u011F\u0131n\u0131 veya hakedi\u015F raporunu analiz et. Hakedi\u015F/fatura numaras\u0131n\u0131, d\xF6nemini (donem), tarihini (YYYY-MM-DD), y\xFCklenici/ta\u015Feron firma \xFCnvan\u0131n\u0131, KDV hari\xE7 toplam\u0131 (toplamTutar), KDV tutar\u0131n\u0131, genel toplam\u0131 ve k\u0131sa i\u015F a\xE7\u0131klamas\u0131n\u0131 \xE7\u0131kar.";
      } else if (docType === "yoklama") {
        responseSchema = {
          type: import_genai4.Type.OBJECT,
          properties: {
            tarih: { type: import_genai4.Type.STRING, description: "\u0130lgili ay, d\xF6nem veya tarih (\xF6rn: Haziran 2026 veya 2026-06-15)" },
            yoklamaKayitlari: {
              type: import_genai4.Type.ARRAY,
              items: {
                type: import_genai4.Type.OBJECT,
                properties: {
                  adSoyad: { type: import_genai4.Type.STRING, description: "Personel ad\u0131 soyad\u0131 (\xF6rn: 'Ahmet Y\u0131lmaz')" },
                  durum: { type: import_genai4.Type.STRING, description: "'Geldi', 'Yok', '\u0130zinli', 'Raporlu', 'Pazar', 'Tatil' durumlar\u0131ndan biri" },
                  gunNo: { type: import_genai4.Type.NUMBER, description: "Hangi g\xFCn oldu\u011Fu (1-31 aras\u0131 tamsay\u0131, \xF6rn: 15. g\xFCn ise 15)" },
                  mesaiSaati: { type: import_genai4.Type.NUMBER, description: "Varsa fazla mesai saati" }
                },
                required: ["adSoyad", "durum"]
              }
            }
          },
          required: ["yoklamaKayitlari"]
        };
        userPrompt = "L\xFCtfen ekteki personel yoklama listesini, puantaj tablosunu veya \u015Fantiye yoklama tutana\u011F\u0131n\u0131 analiz et. \u0130lgili ay\u0131 veya tarihi tespit et, listedeki t\xFCm personellerin isimlerini ve yoklama/puantaj durumlar\u0131n\u0131 ('Geldi', 'Yok', '\u0130zinli', 'Raporlu', 'Pazar', 'Tatil') yoklamaKayitlari dizisinde \xE7\u0131kar.";
      } else if (docType === "saha_faaliyet") {
        responseSchema = {
          type: import_genai4.Type.OBJECT,
          properties: {
            tarih: { type: import_genai4.Type.STRING, description: "YYYY-MM-DD format\u0131nda rapor tarihi" },
            isNiteligi: { type: import_genai4.Type.STRING, description: "\u0130\u015Fin niteli\u011Fi, t\xFCr\xFC (\xF6rn: 'Beton D\xF6k\xFCm\xFC', 'Kal\u0131p \xC7ak\u0131m\u0131', 'Hafriyat ve Kaz\u0131')" },
            parsel: { type: import_genai4.Type.STRING, description: "Parsel no (\xF6rn: 'Parsel A' veya 'Parsel 3')" },
            blok: { type: import_genai4.Type.STRING, description: "Blok no (\xF6rn: 'Blok 1' veya 'Blok B')" },
            aciklama: { type: import_genai4.Type.STRING, description: "G\xFCnl\xFCk \u015Fantiyede yap\u0131lan faaliyet a\xE7\u0131klamalar\u0131 ve detaylar\u0131" },
            aktifPersonelListesi: {
              type: import_genai4.Type.ARRAY,
              items: { type: import_genai4.Type.STRING },
              description: "\u015Eantiye sahas\u0131nda aktif g\xF6rev alan personellerin isim listesi"
            }
          },
          required: ["tarih", "isNiteligi", "aciklama"]
        };
        userPrompt = "L\xFCtfen ekteki G\xFCnl\xFCk Saha Faaliyet Raporunu veya \u015Fantiye g\xFCnl\xFCk faaliyet logunu analiz et. Rapor tarihini (YYYY-MM-DD), yap\u0131lan i\u015Flerin niteli\u011Fini (isNiteligi), parsel ve blok bilgilerini, g\xFCnl\xFCk \xF6zet faaliyet detaylar\u0131n\u0131 ve sahada \xE7al\u0131\u015Fan aktif personellerin isim listesini \xE7\u0131kar.";
      } else if (docType === "auto") {
        responseSchema = {
          type: import_genai4.Type.OBJECT,
          properties: {
            detectedType: { type: import_genai4.Type.STRING, description: "Tespit edilen d\xF6k\xFCman t\xFCr\xFC: 'fatura', 'irsaliye', 'makbuz', 'hakedis', 'yoklama', or 'saha_faaliyet'" },
            faturaNo: { type: import_genai4.Type.STRING },
            irsaliyeNo: { type: import_genai4.Type.STRING },
            referansId: { type: import_genai4.Type.STRING },
            tarih: { type: import_genai4.Type.STRING, description: "YYYY-MM-DD format\u0131nda tarih" },
            donem: { type: import_genai4.Type.STRING, description: "D\xF6nem (\xF6rn: Haziran 2026)" },
            firma: { type: import_genai4.Type.STRING, description: "Firma / \u015Eah\u0131s / Al\u0131c\u0131 / Sat\u0131c\u0131 / Cari ad\u0131" },
            cariUnvan: { type: import_genai4.Type.STRING, description: "Cari \xFCnvan veya firma \xFCnvan\u0131" },
            toplamTutar: { type: import_genai4.Type.NUMBER },
            kdvTutar: { type: import_genai4.Type.NUMBER },
            genelToplam: { type: import_genai4.Type.NUMBER },
            tutar: { type: import_genai4.Type.NUMBER },
            aciklama: { type: import_genai4.Type.STRING },
            hareketTipi: { type: import_genai4.Type.STRING, description: "'G\u0130R\u0130\u015E' veya '\xC7IKI\u015E'" },
            kalemler: {
              type: import_genai4.Type.ARRAY,
              items: {
                type: import_genai4.Type.OBJECT,
                properties: {
                  urunAdi: { type: import_genai4.Type.STRING },
                  miktar: { type: import_genai4.Type.NUMBER },
                  birim: { type: import_genai4.Type.STRING },
                  birimFiyat: { type: import_genai4.Type.NUMBER },
                  kdvOran: { type: import_genai4.Type.NUMBER },
                  toplam: { type: import_genai4.Type.NUMBER }
                }
              }
            },
            yoklamaKayitlari: {
              type: import_genai4.Type.ARRAY,
              items: {
                type: import_genai4.Type.OBJECT,
                properties: {
                  adSoyad: { type: import_genai4.Type.STRING, description: "Personel ad\u0131 soyad\u0131 (\xF6rn: 'Ahmet Y\u0131lmaz')" },
                  durum: { type: import_genai4.Type.STRING, description: "'Geldi', 'Yok', '\u0130zinli', 'Raporlu', 'Pazar', 'Tatil' durumlar\u0131ndan biri" },
                  gunNo: { type: import_genai4.Type.NUMBER, description: "Ay\u0131n hangi g\xFCn\xFC oldu\u011Fu (1-31 aras\u0131 say\u0131, \xF6rn: 15)" },
                  mesaiSaati: { type: import_genai4.Type.NUMBER, description: "Fazla mesai saati" }
                },
                required: ["adSoyad", "durum"]
              }
            },
            isNiteligi: { type: import_genai4.Type.STRING, description: "\u0130\u015Fin niteli\u011Fi (\xF6rn: 'Beton D\xF6k\xFCm\xFC')" },
            parsel: { type: import_genai4.Type.STRING, description: "\u015Eantiye parseli (\xF6rn: 'Parsel A')" },
            blok: { type: import_genai4.Type.STRING, description: "\u015Eantiye blok bilgisi (\xF6rn: 'Blok 1')" },
            aktifPersonelListesi: {
              type: import_genai4.Type.ARRAY,
              items: { type: import_genai4.Type.STRING },
              description: "Sahada g\xF6rev alan personellerin isimleri"
            },
            records: {
              type: import_genai4.Type.ARRAY,
              description: "Ayn\u0131 belgede birden fazla sat\u0131n alma kayd\u0131 varsa, her bir talep i\xE7in ayr\u0131 kay\u0131t dizisi",
              items: {
                type: import_genai4.Type.OBJECT,
                properties: {
                  tarih: { type: import_genai4.Type.STRING, description: "YYYY-MM-DD format\u0131nda tarih" },
                  firma: { type: import_genai4.Type.STRING, description: "Tedarik\xE7i / cari firma" },
                  cariUnvan: { type: import_genai4.Type.STRING, description: "Firma \xFCnvan\u0131" },
                  aciklama: { type: import_genai4.Type.STRING, description: "Talep a\xE7\u0131klamas\u0131 veya not" },
                  onayDurumu: { type: import_genai4.Type.STRING, description: "ONAYLANDI veya B\u0130L\u0130NM\u0130YOR" },
                  kalemler: {
                    type: import_genai4.Type.ARRAY,
                    items: {
                      type: import_genai4.Type.OBJECT,
                      properties: {
                        urunAdi: { type: import_genai4.Type.STRING },
                        miktar: { type: import_genai4.Type.NUMBER },
                        birim: { type: import_genai4.Type.STRING },
                        birimFiyat: { type: import_genai4.Type.NUMBER },
                        kdvOran: { type: import_genai4.Type.NUMBER },
                        toplam: { type: import_genai4.Type.NUMBER }
                      }
                    }
                  }
                }
              }
            }
          },
          required: ["detectedType"]
        };
        userPrompt = `L\xFCtfen ekteki d\xF6k\xFCman\u0131 analiz et ve tipini otomatik tespit et.
D\xF6k\xFCman tipleri \u015Funlar olabilir:
1. 'fatura' (Fatura / Gider Faturas\u0131) - Fatura numaras\u0131, tarih, sat\u0131c\u0131 firma, tutarlar, KDV, kalemler varsa buraya girer.
2. 'irsaliye' (Sevk \u0130rsaliyesi / Teslimat Evrak\u0131) - \xDCr\xFCn teslimat d\xF6k\xFCmleri, irsaliye numaras\u0131, g\xF6nderici, miktarlar buraya girer.
3. 'makbuz' (Dekont / Makbuz / Gider Pusulas\u0131) - \xD6deme dekontu, tediye fi\u015Fi, banka havalesi, tutar ve hareketTipi ('\xC7IKI\u015E' veya 'G\u0130R\u0130\u015E') buraya girer.
4. 'hakedis' (Hakedi\u015F Kapa\u011F\u0131 / Ta\u015Feron Hakedi\u015Fi) - Ta\u015Feron hakedi\u015F raporlar\u0131, d\xF6nemler, hakedi\u015F bedeli, i\u015F a\xE7\u0131klamalar\u0131 buraya girer.
5. 'yoklama' (Yoklama / Puantaj Listesi) - Personel yoklama listesi, puantaj tablosu, g\xFCnl\xFCk/ayl\u0131k yoklama durumlar\u0131 buraya girer.
6. 'saha_faaliyet' (G\xFCnl\xFCk Saha Faaliyet Raporu) - \u015Eantiyede yap\u0131lan i\u015Fler, beton d\xF6k\xFCm\xFC, kal\u0131p i\u015Fleri, parsel, blok ve sahada \xE7al\u0131\u015Fan aktif personellerin adlar\u0131 buraya girer.

E\u011Fer belge \xE7ok sayfal\u0131 ve birden fazla sat\u0131n alma talebi i\xE7eriyorsa, her talebi records dizisinde ayr\u0131 bir kay\u0131t olarak ver.
Geriye d\xF6n\xFCk uyumluluk i\xE7in \xFCst seviyedeki alanlar\u0131 ilk kayda g\xF6re de doldur.

L\xFCtfen en uygun kategoriyi 'detectedType' alan\u0131na atay\u0131p d\xF6k\xFCmandaki ilgili t\xFCm alanlar\u0131 b\xFCy\xFCk bir titizlikle \xE7\u0131kar.`;
      } else {
        return res.status(400).json({ error: "Invalid docType specified" });
      }
      const { text } = await generateGeminiWithFallback({
        contents: [userPrompt, imagePart],
        config: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.1
        },
        label: `Legacy d\xF6k\xFCman analizi (${docType})`
      });
      const parsedData = JSON.parse(text);
      res.json({ success: true, data: parsedData });
    } catch (error) {
      console.error("Error in parse-legacy-document endpoint:", error);
      const msg = error.message || "Failed to parse legacy document";
      const status = /zaman aşımı|timeout|504/i.test(msg) ? 504 : 500;
      res.status(status).json({ error: msg });
    }
  });
  app2.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }
      const { text } = await generateGeminiWithFallback({
        contents: `Sen Kibrit\xE7i \u0130n\u015Faat ERP sisteminin ak\u0131ll\u0131 yapay zeka \u015Fantiye asistan\u0131s\u0131n. Kullan\u0131c\u0131ya \u015Fantiye y\xF6netimi, personel, stok ve genel in\u015Faat ERP s\xFCre\xE7leri hakk\u0131nda yard\u0131mc\u0131 oluyorsun. L\xFCtfen k\u0131sa, anla\u015F\u0131l\u0131r, kibar ve \xE7\xF6z\xFCm odakl\u0131 bir yan\u0131t ver. Kullan\u0131c\u0131 mesaj\u0131: ${message}`,
        label: "Asistan sohbeti"
      });
      res.json({ text });
    } catch (error) {
      console.error("Error in chat assistant endpoint:", error);
      res.status(500).json({ error: error.message || "Failed to process message" });
    }
  });
  async function handleAkvizyonNobetCron(req, res) {
    const expected = String(process.env.CRON_SECRET || "").trim();
    const headerSecret = String(req.headers["x-cron-secret"] || "").trim();
    const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
    const isVercelCron = String(req.headers["x-vercel-cron"] || "") === "1";
    if (expected) {
      if (headerSecret !== expected && bearer !== expected && !isVercelCron) {
        return res.status(401).json({ error: "Yetkisiz cron iste\u011Fi" });
      }
    } else if (!isVercelCron) {
      return res.status(503).json({ error: "CRON_SECRET tan\u0131ml\u0131 de\u011Fil" });
    }
    if (!isFirebaseAdminConfigured()) {
      return res.status(503).json({ error: "Firebase Admin yap\u0131land\u0131r\u0131lmam\u0131\u015F" });
    }
    try {
      const {
        buildAkvizyonOtomatikKapanisPayload: buildAkvizyonOtomatikKapanisPayload2,
        collectAkvizyonPersonelForDate: collectAkvizyonPersonelForDate2,
        istanbulTodayKey: istanbulTodayKey2,
        shouldAutoCloseAkvizyonNobet: shouldAutoCloseAkvizyonNobet2,
        AKVIZYON_NOBET_KAPANIS_SAAT: AKVIZYON_NOBET_KAPANIS_SAAT2
      } = await Promise.resolve().then(() => (init_akvizyonNobetAutoArchive(), akvizyonNobetAutoArchive_exports));
      const force = Boolean(req.body?.force || req.query?.force);
      const tarih = String(req.body?.tarih || req.query?.tarih || istanbulTodayKey2()).slice(0, 10);
      const admin2 = getFirebaseAdmin();
      const db = admin2.firestore();
      const existingSnap = await db.collection("akvizyonYoklamalari").doc(tarih).get();
      const existing = existingSnap.exists ? { id: existingSnap.id, ...existingSnap.data() } : null;
      if (!force && !shouldAutoCloseAkvizyonNobet2(tarih, existing)) {
        return res.json({
          success: true,
          skipped: true,
          reason: existing?.kilitli ? "already_locked" : "before_close_time",
          tarih,
          closeHour: AKVIZYON_NOBET_KAPANIS_SAAT2
        });
      }
      const personelSnap = await db.collection("personeller").get();
      const personeller = personelSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const akvizyonList = collectAkvizyonPersonelForDate2(personeller, tarih);
      const payload = buildAkvizyonOtomatikKapanisPayload2({
        tarih,
        personelIds: akvizyonList.map((p) => p.id),
        existing,
        kaydeden: "sistem_otomatik_cron"
      });
      await db.collection("akvizyonYoklamalari").doc(tarih).set(payload, { merge: true });
      await db.collection("akvizyonNobetArsivleri").doc(tarih).set(
        {
          ...payload,
          arsivTipi: "AKVIZYON_GRUP_NOBET",
          personelSayisi: akvizyonList.length,
          geldiSayisi: Object.values(payload.yoklama || {}).filter((v) => v === "Geldi").length,
          gelmediSayisi: Object.values(payload.yoklama || {}).filter((v) => v === "Gelmedi").length
        },
        { merge: true }
      );
      return res.json({
        success: true,
        archived: true,
        tarih,
        personelSayisi: akvizyonList.length,
        kapanisZamani: payload.kapanisZamani
      });
    } catch (error) {
      console.error("Akvizyon n\xF6bet otomatik kapan\u0131\u015F hatas\u0131:", error);
      return res.status(500).json({ error: error.message || "Otomatik kapan\u0131\u015F ba\u015Far\u0131s\u0131z" });
    }
  }
  app2.get("/api/cron/akvizyon-nobet-kapat", handleAkvizyonNobetCron);
  app2.post("/api/cron/akvizyon-nobet-kapat", handleAkvizyonNobetCron);
}

// api/handler.ts
var app = (0, import_express.default)();
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ limit: "50mb", extended: true }));
registerApiRoutes(app);
var serverlessHttp = require("serverless-http");
var slsHandler = typeof serverlessHttp === "function" ? serverlessHttp(app, {
  binary: ["image/*", "application/pdf", "application/octet-stream"]
}) : serverlessHttp.default(app, {
  binary: ["image/*", "application/pdf", "application/octet-stream"]
});
async function vercelHandler(req, res) {
  try {
    return await slsHandler(req, res);
  } catch (err) {
    console.error("Vercel API crash:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: message });
    }
  }
}
var vercelConfig = {
  api: { bodyParser: false },
  maxDuration: 60
};
module.exports = vercelHandler;
module.exports.config = vercelConfig;
//# sourceMappingURL=%5B...path%5D.js.map
