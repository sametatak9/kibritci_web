var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/server/whatsappTaseronWebhookHttp.ts
var whatsappTaseronWebhookHttp_exports = {};
__export(whatsappTaseronWebhookHttp_exports, {
  default: () => whatsappTaseronWebhookHandler
});
module.exports = __toCommonJS(whatsappTaseronWebhookHttp_exports);

// src/server/taseronGrupIntake.ts
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

// src/lib/yoklamaUtils.ts
function normalizeCompanyName(name) {
  return String(name || "").toLocaleUpperCase("tr-TR").replace(/İ/g, "I").replace(/Ş/g, "S").replace(/Ğ/g, "G").replace(/Ü/g, "U").replace(/Ö/g, "O").replace(/Ç/g, "C").replace(/\s+/g, " ").trim();
}
var CANONICAL_ANA_FIRMA_ADI = "K\u0130BR\u0130T\xC7\u0130 \u0130N\u015EAAT";
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
function evrakBekliyorMu(x) {
  const d = String(x.durum || "");
  return d === "WP_G\xD6NDER\u0130LD\u0130" || d === "GRUP_BILDIRILDI";
}
function rankBildirim(x) {
  if (evrakBekliyorMu(x)) return 0;
  if (isPendingPersonelOnayDurum(x.durum)) return 1;
  return 2;
}
function findSgkGrupBildirimi(kuyruk, opts) {
  const pending = kuyruk.filter((x) => isPendingPersonelOnayDurum(x.durum));
  const pool = pending.length ? pending : kuyruk;
  const pick = (hits) => hits.length ? [...hits].sort((a, b) => rankBildirim(a) - rankBildirim(b))[0] : void 0;
  const tc = digitsTc(opts.tcNo);
  if (tc.length === 11) {
    const byTc = pick(pool.filter((x) => digitsTc(x.tcNo) === tc));
    if (byTc) return byTc;
  }
  const needle = fullNameOf(opts);
  if (!needle || needle.split(" ").filter(Boolean).length < 2) return void 0;
  return pick(pool.filter((x) => namesMatchExact(x, opts)));
}
function isPendingPersonelOnayDurum(durum) {
  const d = String(durum || "");
  return d === "BEKLEMEDE" || d === "WP_G\xD6NDER\u0130LD\u0130" || d === "GRUP_BILDIRILDI";
}
function buildSgkTalepPatchFromParse(parsed, evrakUrl, kind, bildirim) {
  const ad = String(parsed.ad || bildirim?.ad || "").toLocaleUpperCase("tr-TR");
  const soyad = String(parsed.soyad || bildirim?.soyad || "").toLocaleUpperCase("tr-TR");
  const tcNo = digitsTc(parsed.tcNo || bildirim?.tcNo);
  const evrakTarihi = String(
    kind === "giris" ? parsed.iseGirisTarihi || bildirim?.iseGirisTarihi || "" : parsed.cikisTarihi || parsed.iseGirisTarihi || bildirim?.cikisTarihi || ""
  ).slice(0, 10);
  const gorev = String(bildirim?.gorev || "").toLocaleUpperCase("tr-TR");
  const nitelik = String(bildirim?.nitelik || parsed.nitelik || parsed.isGorev || "").toLocaleUpperCase(
    "tr-TR"
  );
  return {
    durum: "BEKLEMEDE",
    kaynak: "SGK_GRUP",
    grupBildirildi: true,
    firmaTipi: "ANA_FIRMA",
    sgkEvrakGeldi: true,
    sgkEvrakUrl: evrakUrl,
    ad: ad || void 0,
    soyad: soyad || void 0,
    personelIsim: `${ad} ${soyad}`.trim() || bildirim?.personelIsim || void 0,
    tcNo: tcNo || void 0,
    babaAdi: parsed.babaAdi || void 0,
    dogumTarihi: parsed.dogumTarihi || void 0,
    adres: parsed.adres || void 0,
    il: parsed.il || void 0,
    ilce: parsed.ilce || void 0,
    cinsiyet: parsed.cinsiyet || void 0,
    bankaAdi: parsed.bankaAdi || void 0,
    ibanNo: parsed.ibanNo || void 0,
    gorev: gorev || void 0,
    nitelik: nitelik || void 0,
    onayaDusmeTarihi: (/* @__PURE__ */ new Date()).toISOString(),
    ...kind === "giris" ? { girisEvrakPdfUrl: evrakUrl, iseGirisTarihi: evrakTarihi || void 0 } : { cikisEvrakPdfUrl: evrakUrl, cikisTarihi: evrakTarihi || void 0, sgkCikisTarihi: evrakTarihi || void 0 }
  };
}

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

// src/lib/firmaCanonicalUtils.ts
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
var TASERON_GRUP_KAYNAK = "TASERON_GRUP";
var TASERON_GRUP_WP_HAT = "0501 683 3400";
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

// src/server/geminiGenerate.ts
var import_genai2 = require("@google/genai");

// src/server/gemini.ts
var import_genai = require("@google/genai");
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

// src/server/geminiGenerate.ts
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

// src/server/firebaseAdmin.ts
var import_firebase_admin = __toESM(require("firebase-admin"), 1);
var initialized = false;
function isFirebaseAdminConfigured() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}
function getFirebaseAdmin() {
  if (initialized || import_firebase_admin.default.apps.length) {
    initialized = true;
    return import_firebase_admin.default;
  }
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

// src/lib/sgkAnaFirmaIntake.ts
var ANA_FIRMA_SGK_KAYNAK = "SGK_GRUP";
function foldFirma(name) {
  return String(name || "").toLocaleUpperCase("tr-TR").replace(/İ/g, "I").replace(/Ş/g, "S").replace(/Ğ/g, "G").replace(/Ü/g, "U").replace(/Ö/g, "O").replace(/Ç/g, "C").replace(/\s+/g, " ").trim();
}
function isKibritciSgkIsveren(firmaAdi) {
  const n = foldFirma(String(firmaAdi || ""));
  return n.includes("KIBRITCI");
}
function findAnaFirmaPersonelByTc(personeller, tcRaw) {
  const tc = digitsTc(tcRaw);
  if (tc.length !== 11) return void 0;
  return (personeller || []).find(
    (p) => !isTaseronPersonelRecord(p) && digitsTc(p.tcNo) === tc
  );
}
function anaFirmaWpGirisKuyrukHazir(p) {
  return Boolean(
    String(p?.ad || "").trim() && String(p?.soyad || "").trim() && p?.yon === "giris" && String(p?.tarih || "").trim() && isKibritciSgkIsveren(p?.firmaAdi)
  );
}
function anaFirmaWpCikisKuyrukHazir(p) {
  return Boolean(
    p?.yon === "cikis" && digitsTc(p?.tcNo).length === 11 && String(p?.tarih || "").trim() && isKibritciSgkIsveren(p?.firmaAdi)
  );
}
function buildAnaFirmaWpGirisTalepDoc(opts) {
  const ad = opts.parsed.ad.trim().toLocaleUpperCase("tr-TR");
  const soyad = opts.parsed.soyad.trim().toLocaleUpperCase("tr-TR");
  const meslek = String(opts.parsed.isGorev || "").trim().toLocaleUpperCase("tr-TR");
  const gorev = String(opts.bildirimGorev || "").trim().toLocaleUpperCase("tr-TR");
  const evrak = opts.evrakUrl || "";
  const arafta = !gorev;
  return {
    id: opts.id,
    ad,
    soyad,
    personelIsim: `${ad} ${soyad}`.trim(),
    tcNo: digitsTc(opts.parsed.tcNo) || "",
    gorev: gorev || void 0,
    nitelik: meslek || void 0,
    iseGirisTarihi: opts.parsed.tarih,
    tarih: (/* @__PURE__ */ new Date()).toISOString(),
    durum: "BEKLEMEDE",
    kaynak: ANA_FIRMA_SGK_KAYNAK,
    firmaTipi: "ANA_FIRMA",
    firmaAdi: CANONICAL_ANA_FIRMA_ADI,
    grupBildirildi: true,
    sgkEvrakGeldi: Boolean(evrak),
    sgkEvrakUrl: evrak || void 0,
    girisEvrakPdfUrl: evrak || void 0,
    gonderenFormen: opts.gonderen,
    wpHat: TASERON_GRUP_WP_HAT,
    gorevBosArafta: arafta,
    personelId: opts.mevcut?.id || void 0,
    yoklamaKilit: "Mevcut yoklama g\xF6revi ezilmez. Yeni kart g\xF6rev bo\u015F (arafta); meslek niteliktir. Kadro Onay\u2019da."
  };
}
function buildAnaFirmaWpCikisTalepDoc(opts) {
  const ad = (opts.parsed.ad || opts.mevcut?.ad || "").trim().toLocaleUpperCase("tr-TR");
  const soyad = (opts.parsed.soyad || opts.mevcut?.soyad || "").trim().toLocaleUpperCase("tr-TR");
  const evrak = opts.evrakUrl || "";
  const tcNo = digitsTc(opts.parsed.tcNo) || digitsTc(opts.mevcut?.tcNo);
  return {
    id: opts.id,
    ad,
    soyad,
    personelIsim: `${ad} ${soyad}`.trim() || opts.mevcut?.ad,
    personelId: opts.mevcut?.id || "",
    personelGorev: opts.mevcut?.gorev || "",
    personelMaas: opts.mevcut?.maas ?? 0,
    tcNo: tcNo || "",
    firmaTipi: "ANA_FIRMA",
    firmaAdi: CANONICAL_ANA_FIRMA_ADI,
    cikisTarihi: opts.parsed.tarih,
    sgkCikisTarihi: opts.parsed.tarih,
    cikisNedeni: "Ana Firma SGK \u2014 i\u015Ften \xE7\u0131k\u0131\u015F (WhatsApp hatt\u0131)",
    hedefYoneticiRole: "Y\xD6NET\u0130C\u0130",
    tarih: (/* @__PURE__ */ new Date()).toISOString(),
    durum: "BEKLEMEDE",
    kaynak: ANA_FIRMA_SGK_KAYNAK,
    grupBildirildi: true,
    sgkEvrakGeldi: Boolean(evrak),
    sgkEvrakUrl: evrak || void 0,
    cikisEvrakPdfUrl: evrak || void 0,
    gonderenFormen: opts.gonderen,
    wpHat: TASERON_GRUP_WP_HAT,
    yoklamaKilit: "\xC7\u0131k\u0131\u015F Onay\u2019da kart\u0131 pasife al\u0131r; yoklama g\xFCnleri silinmez / ta\u015F\u0131nmaz."
  };
}
function findOpenAnaFirmaSgkTalep(kuyruk, parsed) {
  return findSgkGrupBildirimi(kuyruk, {
    ad: parsed.ad,
    soyad: parsed.soyad,
    tcNo: parsed.tcNo,
    personelIsim: `${parsed.ad || ""} ${parsed.soyad || ""}`.trim()
  });
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
async function enqueueAnaFirmaSgkParse(opts) {
  if (!isFirebaseAdminConfigured()) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON yok \u2014 kuyruk sunucudan yaz\u0131lamaz.");
  }
  const parsed = opts.parsed;
  if (!isKibritciSgkIsveren(parsed.firmaAdi)) {
    return { id: "", skipped: "i\u015Fveren Kibrit\xE7i de\u011Fil" };
  }
  const { personeller } = await loadKuruluFromAdmin();
  const db = getFirebaseAdmin().firestore();
  const col = parsed.yon === "cikis" ? "personelCikisTalepleri" : "personelGirisTalepleri";
  const pendingSnap = await db.collection(col).get();
  const pending = pendingSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const open = findOpenAnaFirmaSgkTalep(pending, parsed);
  const gonderen = opts.gonderen || "otomasyon";
  if (open?.id) {
    const patch = stripUndefined(
      buildSgkTalepPatchFromParse(
        {
          ad: parsed.ad,
          soyad: parsed.soyad,
          tcNo: parsed.tcNo,
          iseGirisTarihi: parsed.tarih,
          cikisTarihi: parsed.tarih,
          nitelik: parsed.isGorev
        },
        opts.evrakDataUrl || "",
        parsed.yon === "cikis" ? "cikis" : "giris",
        open
      )
    );
    await db.collection(col).doc(String(open.id)).update(patch);
    return { id: String(open.id), duplicate: true, kanal: "ANA_FIRMA" };
  }
  if (parsed.yon === "cikis") {
    if (!anaFirmaWpCikisKuyrukHazir(parsed)) {
      return { id: "", skipped: "Ana Firma \xE7\u0131k\u0131\u015F i\xE7in 11 haneli TC + tarih gerekli", kanal: "ANA_FIRMA" };
    }
    const mevcut2 = findAnaFirmaPersonelByTc(personeller, parsed.tcNo);
    const id2 = `CIKIS-SGK-WP-${Date.now()}`;
    const doc2 = stripUndefined(
      buildAnaFirmaWpCikisTalepDoc({
        id: id2,
        parsed,
        evrakUrl: opts.evrakDataUrl,
        gonderen,
        mevcut: mevcut2
      })
    );
    await db.collection(col).doc(id2).set(doc2);
    return { id: id2, kanal: "ANA_FIRMA" };
  }
  if (!anaFirmaWpGirisKuyrukHazir(parsed)) {
    return { id: "", skipped: "Ana Firma giri\u015F i\xE7in ad/soyad/tarih/Kibrit\xE7i i\u015Fveren gerekli", kanal: "ANA_FIRMA" };
  }
  const mevcut = findAnaFirmaPersonelByTc(personeller, parsed.tcNo);
  const id = `GIRIS-SGK-WP-${Date.now()}`;
  const doc = stripUndefined(
    buildAnaFirmaWpGirisTalepDoc({
      id,
      parsed,
      evrakUrl: opts.evrakDataUrl,
      gonderen,
      mevcut,
      bildirimGorev: mevcut?.gorev
    })
  );
  await db.collection(col).doc(id).set(doc);
  return { id, kanal: "ANA_FIRMA" };
}
async function enqueueTaseronGrupParse(opts) {
  if (isKibritciSgkIsveren(opts.parsed.firmaAdi)) {
    return enqueueAnaFirmaSgkParse(opts);
  }
  if (!isFirebaseAdminConfigured()) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON yok \u2014 kuyruk sunucudan yaz\u0131lamaz.");
  }
  const { cariKartlar, personeller } = await loadKuruluFromAdmin();
  const parsed = {
    ...opts.parsed,
    firmaAdi: resolveTaseronGrupFirmaAdi(opts.parsed.firmaAdi, cariKartlar, personeller)
  };
  if (isKibritciSgkIsveren(parsed.firmaAdi)) {
    return enqueueAnaFirmaSgkParse({ ...opts, parsed: { ...opts.parsed, firmaAdi: parsed.firmaAdi } });
  }
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

// src/server/nodeHttpUtil.ts
function sendJson(res, status, body) {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
function sendText(res, status, text) {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(text);
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
function collectWhatsAppMessages(body) {
  const messages = [];
  const entries = Array.isArray(body.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const batch = change?.value?.messages;
      if (Array.isArray(batch)) messages.push(...batch);
    }
  }
  return messages;
}

// src/server/whatsappTaseronWebhookHttp.ts
async function whatsappTaseronWebhookHandler(req, res) {
  const method = String(req.method || "GET").toUpperCase();
  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (method === "GET" || method === "HEAD") {
    const host = String(req.headers.host || "localhost");
    const url = new URL(req.url || "/", `http://${host}`);
    const mode = String(url.searchParams.get("hub.mode") || "");
    const token = String(url.searchParams.get("hub.verify_token") || "");
    const challenge = String(url.searchParams.get("hub.challenge") || "");
    const expected = String(process.env.WHATSAPP_VERIFY_TOKEN || "").trim();
    if (mode === "subscribe" && expected && token === expected) {
      sendText(res, 200, challenge);
      return;
    }
    sendJson(res, 403, { error: "WhatsApp verify token uyu\u015Fmad\u0131 veya tan\u0131ml\u0131 de\u011Fil." });
    return;
  }
  if (method !== "POST") {
    sendJson(res, 405, { error: "Yaln\u0131zca GET/POST" });
    return;
  }
  if (!isWhatsAppTaseronWebhookConfigured()) {
    sendJson(res, 503, {
      error: "WhatsApp otomasyonu yap\u0131land\u0131r\u0131lmam\u0131\u015F. WHATSAPP_ACCESS_TOKEN + WHATSAPP_VERIFY_TOKEN gerekir."
    });
    return;
  }
  try {
    const body = await readJsonBody(req, 8e3);
    const messages = collectWhatsAppMessages(body);
    const result = await handleWhatsAppTaseronMessages(messages);
    sendJson(res, 200, { success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "webhook hata";
    console.error("WhatsApp ta\u015Feron webhook:", error);
    sendJson(res, 200, { success: false, error: message });
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
//# sourceMappingURL=whatsapp-taseron-grup.js.map
