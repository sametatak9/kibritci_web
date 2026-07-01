var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// api/handler.ts
var import_express = __toESM(require("express"));

// src/server/registerApiRoutes.ts
var import_genai2 = require("@google/genai");

// src/server/gemini.ts
var import_genai = require("@google/genai");
var aiClient = null;
function resolveGeminiApiKey() {
  const raw = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!raw) return void 0;
  return raw.trim().replace(/^['"]|['"]$/g, "");
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
  const msg = error instanceof Error ? error.message : String(error);
  if (/API key not valid|invalid.?api.?key|401|403|PERMISSION_DENIED/i.test(msg)) {
    return [
      "Gemini API anahtar\u0131 reddedildi.",
      "\u2022 AI Studio'dan yeni Auth key (AQ.\u2026) olu\u015Fturun: https://aistudio.google.com/apikey",
      "\u2022 Vercel: Settings \u2192 Environment Variables \u2192 GEMINI_API_KEY (t\u0131rnaks\u0131z, bo\u015Fluksuz)",
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
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Reply with exactly: OK",
      config: { maxOutputTokens: 16, temperature: 0 }
    });
    return { ok: true, keyInfo, modelResponse: response.text?.trim() };
  } catch (err) {
    return { ok: false, keyInfo, error: parseGeminiError(err) };
  }
}

// src/server/geminiGenerate.ts
var IS_VERCEL = Boolean(process.env.VERCEL);
var MODELS = IS_VERCEL ? ["gemini-2.5-flash", "gemini-2.0-flash"] : ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
var MAX_RETRIES_PER_MODEL = IS_VERCEL ? 1 : 2;
var RETRY_DELAY_MS = IS_VERCEL ? 350 : 1200;
var ATTEMPT_TIMEOUT_MS = IS_VERCEL ? 9e3 : 45e3;
function isTemporaryGeminiError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  const status = err?.status;
  return status === 503 || status === 429 || /503|429|UNAVAILABLE|high demand|Resource exhausted/i.test(msg);
}
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(
        new Error(
          `${label} ${Math.round(ms / 1e3)} sn i\xE7inde tamamlanamad\u0131. Vercel Hobby planda limit ~10 sn; Pro plan veya daha k\xFC\xE7\xFCk dosya deneyin.`
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
  const ai = getGeminiClient();
  const label = options.label || "Gemini iste\u011Fi";
  let lastError = null;
  for (const model of MODELS) {
    for (let attempt = 0; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
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
        throw new Error("Gemini bo\u015F yan\u0131t d\xF6nd\xFCrd\xFC");
      } catch (err) {
        lastError = err;
        const canRetry = attempt < MAX_RETRIES_PER_MODEL && isTemporaryGeminiError(err);
        if (!canRetry && !isTemporaryGeminiError(err)) {
          break;
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

// src/server/registerApiRoutes.ts
function registerApiRoutes(app2) {
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
    return res.status(503).json({
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
        type: import_genai2.Type.OBJECT,
        properties: {
          tarih: { type: import_genai2.Type.STRING, description: "YYYY-MM-DD format\u0131nda yoklama tarihi" },
          yoklamaKayitlari: {
            type: import_genai2.Type.ARRAY,
            items: {
              type: import_genai2.Type.OBJECT,
              properties: {
                adSoyad: { type: import_genai2.Type.STRING },
                gorev: { type: import_genai2.Type.STRING },
                durum: { type: import_genai2.Type.STRING, description: "'Geldi', 'Yok', '\u0130zinli', 'Raporlu', 'Pazar', 'Tatil'" },
                mesaiSaati: { type: import_genai2.Type.NUMBER }
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
      const ai = getGeminiClient();
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
        type: import_genai2.Type.OBJECT,
        properties: {
          yil: { type: import_genai2.Type.NUMBER },
          ay: { type: import_genai2.Type.NUMBER },
          personelKayitlari: {
            type: import_genai2.Type.ARRAY,
            items: {
              type: import_genai2.Type.OBJECT,
              properties: {
                excelId: { type: import_genai2.Type.NUMBER },
                adSoyad: { type: import_genai2.Type.STRING },
                gorev: { type: import_genai2.Type.STRING },
                calismaGunleri: { type: import_genai2.Type.ARRAY, items: { type: import_genai2.Type.NUMBER } },
                mesaiGunleri: { type: import_genai2.Type.OBJECT, additionalProperties: { type: import_genai2.Type.NUMBER } },
                istenCikisTarihi: { type: import_genai2.Type.STRING }
              },
              required: ["excelId", "adSoyad", "calismaGunleri"]
            }
          }
        },
        required: ["yil", "ay", "personelKayitlari"]
      };
      const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
      let response;
      let lastError;
      for (const model of models) {
        try {
          console.log(`Parsing monthly excel yoklama with model: ${model}...`);
          response = await ai.models.generateContent({
            model,
            contents: [promptText, imagePart],
            config: {
              responseMimeType: "application/json",
              responseSchema,
              temperature: 0.1
            }
          });
          if (response?.text) break;
        } catch (err) {
          lastError = err;
          console.warn(`Model ${model} failed for monthly excel yoklama:`, err);
        }
      }
      if (!response?.text) {
        throw lastError || new Error("All models failed to parse monthly excel yoklama");
      }
      res.json({ success: true, data: JSON.parse(response.text) });
    } catch (error) {
      console.error("Error in parse-monthly-excel-yoklama:", error);
      res.status(500).json({ error: error.message || "Failed to parse monthly excel yoklama" });
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
        type: import_genai2.Type.OBJECT,
        properties: {
          tcNo: { type: import_genai2.Type.STRING, description: "11-digit Turkish TC Identification Number or receiver's TC" },
          ad: { type: import_genai2.Type.STRING, description: "First name" },
          soyad: { type: import_genai2.Type.STRING, description: "Last name" },
          babaAdi: { type: import_genai2.Type.STRING, description: "Father's name" },
          dogumTarihi: { type: import_genai2.Type.STRING, description: "Birthdate in YYYY-MM-DD format" },
          iseGirisTarihi: { type: import_genai2.Type.STRING, description: "Employment start date or transfer date in YYYY-MM-DD format" },
          cinsiyet: { type: import_genai2.Type.STRING, description: "Gender: 'Erkek' or 'Kad\u0131n'" },
          adres: { type: import_genai2.Type.STRING, description: "Full residential address" },
          il: { type: import_genai2.Type.STRING, description: "Residence province" },
          ilce: { type: import_genai2.Type.STRING, description: "Residence district" },
          gorev: { type: import_genai2.Type.STRING, description: "Role: '\u0130\u015E\xC7\u0130', 'FORMEN', 'USTA', 'M\u0130MAR', 'M\xDCHEND\u0130S', '\u015EEF', 'G\xDCVENL\u0130K', or 'DEPOCU'" },
          ibanNo: { type: import_genai2.Type.STRING, description: "Al\u0131c\u0131 IBAN number starting with TR" },
          bankaAdi: { type: import_genai2.Type.STRING, description: "Al\u0131c\u0131 Bank name" }
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
  app2.post("/api/parse-irsaliye", async (req, res) => {
    try {
      const { fileBase64, mimeType } = req.body;
      if (!fileBase64 || !mimeType) {
        return res.status(400).json({ error: "Missing fileBase64 or mimeType in request body" });
      }
      const ai = getGeminiClient();
      const imagePart = {
        inlineData: {
          mimeType,
          data: fileBase64
        }
      };
      const responseSchema = {
        type: import_genai2.Type.OBJECT,
        properties: {
          irsaliyeNo: { type: import_genai2.Type.STRING },
          tarih: { type: import_genai2.Type.STRING },
          firma: { type: import_genai2.Type.STRING },
          kalemler: {
            type: import_genai2.Type.ARRAY,
            items: {
              type: import_genai2.Type.OBJECT,
              properties: {
                urunAdi: { type: import_genai2.Type.STRING },
                miktar: { type: import_genai2.Type.NUMBER },
                birim: { type: import_genai2.Type.STRING }
              },
              required: ["urunAdi", "miktar", "birim"]
            }
          }
        },
        required: ["irsaliyeNo", "tarih", "firma", "kalemler"]
      };
      const userPrompt = "L\xFCtfen ekteki teslimat irsaliyesi (waybill / delivery note) belgesini analiz et. \u0130rsaliye numaras\u0131n\u0131 (irsaliyeNo), tarihini (tarih) (YYYY-MM-DD format\u0131nda), g\xF6nderen / sat\u0131c\u0131 firma ad\u0131n\u0131 (firma) ve teslim edilen t\xFCm malzeme kalemlerini (kalemler listesi alt\u0131nda urunAdi, miktar ve birim olarak) \xE7\u0131kar.";
      const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
      let response;
      let lastError;
      for (const model of models) {
        try {
          console.log(`Parsing irsaliye with model: ${model}...`);
          response = await ai.models.generateContent({
            model,
            contents: [userPrompt, imagePart],
            config: {
              responseMimeType: "application/json",
              responseSchema,
              temperature: 0.1
            }
          });
          if (response?.text) break;
        } catch (err) {
          lastError = err;
          console.warn(`Model ${model} failed for irsaliye, trying next:`, err);
        }
      }
      if (!response || !response.text) {
        throw lastError || new Error("All models failed or returned empty response from Gemini API");
      }
      const parsedData = JSON.parse(response.text);
      res.json({ success: true, data: parsedData });
    } catch (error) {
      console.error("Error parsing \u0130rsaliye PDF/Image via Gemini:", error);
      res.status(500).json({ error: error.message || "Failed to parse waybill document" });
    }
  });
  app2.post("/api/parse-fatura", async (req, res) => {
    try {
      const { fileBase64, mimeType } = req.body;
      if (!fileBase64 || !mimeType) {
        return res.status(400).json({ error: "Missing fileBase64 or mimeType in request body" });
      }
      const ai = getGeminiClient();
      const imagePart = {
        inlineData: {
          mimeType,
          data: fileBase64
        }
      };
      const responseSchema = {
        type: import_genai2.Type.OBJECT,
        properties: {
          faturaNo: { type: import_genai2.Type.STRING },
          tarih: { type: import_genai2.Type.STRING },
          firma: { type: import_genai2.Type.STRING },
          kalemler: {
            type: import_genai2.Type.ARRAY,
            items: {
              type: import_genai2.Type.OBJECT,
              properties: {
                urunAdi: { type: import_genai2.Type.STRING },
                miktar: { type: import_genai2.Type.NUMBER },
                birim: { type: import_genai2.Type.STRING },
                birimFiyat: { type: import_genai2.Type.NUMBER },
                kdvOran: { type: import_genai2.Type.NUMBER },
                toplam: { type: import_genai2.Type.NUMBER }
              },
              required: ["urunAdi", "miktar", "birim", "birimFiyat", "kdvOran", "toplam"]
            }
          },
          toplamTutar: { type: import_genai2.Type.NUMBER },
          kdvTutar: { type: import_genai2.Type.NUMBER },
          genelToplam: { type: import_genai2.Type.NUMBER }
        },
        required: ["faturaNo", "tarih", "firma", "kalemler", "toplamTutar", "kdvTutar", "genelToplam"]
      };
      const userPrompt = "L\xFCtfen ekteki faturay\u0131 (invoice) analiz et. Fatura numaras\u0131n\u0131 (faturaNo), faturan\u0131n kesildi\u011Fi tarihi (tarih) (YYYY-MM-DD format\u0131nda), sat\u0131c\u0131 firma ad\u0131n\u0131 (firma), faturadaki t\xFCm mal veya hizmet kalemlerini (kalemler listesi alt\u0131nda urunAdi, miktar, birim, birimFiyat, kdvOran y\xFCzde olarak \xF6rn. 20, ve toplam tutar\u0131) \xE7\u0131kar. Ayr\u0131ca toplam matrah\u0131 (toplamTutar), KDV tutar\u0131n\u0131 (kdvTutar) ve \xF6denecek genel toplam\u0131 (genelToplam) \xE7\u0131kar.";
      const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
      let response;
      let lastError;
      for (const model of models) {
        try {
          console.log(`Parsing fatura with model: ${model}...`);
          response = await ai.models.generateContent({
            model,
            contents: [userPrompt, imagePart],
            config: {
              responseMimeType: "application/json",
              responseSchema,
              temperature: 0.1
            }
          });
          if (response?.text) break;
        } catch (err) {
          lastError = err;
          console.warn(`Model ${model} failed for fatura, trying next:`, err);
        }
      }
      if (!response || !response.text) {
        throw lastError || new Error("All models failed or returned empty response from Gemini API");
      }
      const parsedData = JSON.parse(response.text);
      res.json({ success: true, data: parsedData });
    } catch (error) {
      console.error("Error parsing Fatura PDF/Image via Gemini:", error);
      res.status(500).json({ error: error.message || "Failed to parse invoice document" });
    }
  });
  app2.post("/api/compare-3way", async (req, res) => {
    try {
      const { saTalebi, irsaliyeler, fatura } = req.body;
      if (!fatura) {
        return res.status(400).json({ error: "Missing fatura data in request body" });
      }
      const ai = getGeminiClient();
      const responseSchema = {
        type: import_genai2.Type.OBJECT,
        properties: {
          status: { type: import_genai2.Type.STRING, description: "Must be either 'SORUNSUZ ONAY' or 'SORUNLU'" },
          discrepancies: {
            type: import_genai2.Type.ARRAY,
            items: { type: import_genai2.Type.STRING },
            description: "List of found differences or discrepancies, empty if none"
          },
          reportText: { type: import_genai2.Type.STRING, description: "A detailed Turkish summary comparing PO vs Waybills vs Invoice" }
        },
        required: ["status", "discrepancies", "reportText"]
      };
      const promptText = `
You are an expert construction auditor and accountant.
Perform a strict 3-way match audit between:
1. Sat\u0131n Alma Sipari\u015Fi (Purchase Order):
${JSON.stringify(saTalebi || "No PO linked", null, 2)}

2. Ba\u011Fl\u0131 \u0130rsaliyeler (Delivery Waybills):
${JSON.stringify(irsaliyeler || "No waybills linked", null, 2)}

3. Gelen Fatura (Invoice):
${JSON.stringify(fatura, null, 2)}

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

Provide the response strictly conforming to the requested schema.
`;
      const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
      let response;
      let lastError;
      for (const model of models) {
        try {
          console.log(`Comparing 3-way with model: ${model}...`);
          response = await ai.models.generateContent({
            model,
            contents: promptText,
            config: {
              responseMimeType: "application/json",
              responseSchema,
              temperature: 0.1
            }
          });
          if (response?.text) break;
        } catch (err) {
          lastError = err;
          console.warn(`Model ${model} failed for 3-way comparison, trying next:`, err);
        }
      }
      if (!response || !response.text) {
        throw lastError || new Error("All models failed or returned empty response from Gemini API for 3-way match");
      }
      const parsedData = JSON.parse(response.text);
      res.json({ success: true, data: parsedData });
    } catch (error) {
      console.error("Error in AI 3-Way Match:", error);
      res.status(500).json({ error: error.message || "Failed to perform 3-way comparison" });
    }
  });
  app2.post("/api/generate-tutanak", async (req, res) => {
    try {
      const { konu, detaylar, muhatap } = req.body;
      if (!konu || !detaylar) {
        return res.status(400).json({ error: "Missing konu or detaylar in request body" });
      }
      const ai = getGeminiClient();
      const prompt = `
L\xFCtfen \u015Fantiye y\xF6netimi i\xE7in resmi ve hukuki a\xE7\u0131dan ge\xE7erli T\xFCrk\xE7e bir tutanak tasla\u011F\u0131 haz\u0131rla.
- Tutanak Konusu: ${konu}
- Olay / Durum Detaylar\u0131: ${detaylar}
- Muhatap / \u0130lgili Taraf: ${muhatap || "Belirtilmemi\u015F"}

Tutanak i\xE7eri\u011Fini resmi, a\u011F\u0131rba\u015Fl\u0131 ve \u015Fantiye mevzuatlar\u0131na uygun hukuk diliyle yaz. En altta "Haz\u0131rlayan / \u015Eantiye \u015Eefi" ve "Muhatap / Teslim Alan" imza b\xF6l\xFCmleri olsun. HTML veya Markdown format\u0131nda yazma, d\xFCz metin olsun.
`;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });
      res.json({ success: true, text: response.text });
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
      const ai = getGeminiClient();
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
          type: import_genai2.Type.OBJECT,
          properties: {
            faturaNo: { type: import_genai2.Type.STRING },
            tarih: { type: import_genai2.Type.STRING, description: "YYYY-MM-DD format\u0131nda tarih" },
            cariUnvan: { type: import_genai2.Type.STRING, description: "Faturay\u0131 kesen / satan sat\u0131c\u0131 firma ad\u0131 (cari \xFCnvan)" },
            toplamTutar: { type: import_genai2.Type.NUMBER, description: "Toplam matrah tutar\u0131 (KDV hari\xE7)" },
            kdvTutar: { type: import_genai2.Type.NUMBER, description: "Toplam hesaplanan KDV tutar\u0131" },
            genelToplam: { type: import_genai2.Type.NUMBER, description: "\xD6denecek genel toplam tutar (KDV dahil)" },
            kalemler: {
              type: import_genai2.Type.ARRAY,
              items: {
                type: import_genai2.Type.OBJECT,
                properties: {
                  urunAdi: { type: import_genai2.Type.STRING, description: "\xDCr\xFCn veya hizmet ad\u0131" },
                  miktar: { type: import_genai2.Type.NUMBER, description: "Miktar" },
                  birim: { type: import_genai2.Type.STRING, description: "Birim (ADET, KG, TON, M3 vb.)" },
                  birimFiyat: { type: import_genai2.Type.NUMBER, description: "Birim fiyat\u0131" },
                  kdvOran: { type: import_genai2.Type.NUMBER, description: "KDV oran\u0131 y\xFCzde olarak (\xF6rn: 20)" },
                  toplam: { type: import_genai2.Type.NUMBER, description: "Kalem toplam\u0131" }
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
          type: import_genai2.Type.OBJECT,
          properties: {
            irsaliyeNo: { type: import_genai2.Type.STRING },
            tarih: { type: import_genai2.Type.STRING, description: "YYYY-MM-DD format\u0131nda tarih" },
            firma: { type: import_genai2.Type.STRING, description: "Sevk eden / g\xF6nderen firma ad\u0131" },
            kalemler: {
              type: import_genai2.Type.ARRAY,
              items: {
                type: import_genai2.Type.OBJECT,
                properties: {
                  urunAdi: { type: import_genai2.Type.STRING, description: "Malzeme ad\u0131" },
                  miktar: { type: import_genai2.Type.NUMBER, description: "Miktar" },
                  birim: { type: import_genai2.Type.STRING, description: "Birim (ADET, KG, TON vb.)" }
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
          type: import_genai2.Type.OBJECT,
          properties: {
            referansId: { type: import_genai2.Type.STRING, description: "Makbuz numaras\u0131, i\u015Flem no veya dekont referans no" },
            tarih: { type: import_genai2.Type.STRING, description: "YYYY-MM-DD format\u0131nda i\u015Flem tarihi" },
            aciklama: { type: import_genai2.Type.STRING, description: "\xD6deme a\xE7\u0131klamas\u0131 veya makbuz i\xE7eri\u011Fi" },
            tutar: { type: import_genai2.Type.NUMBER, description: "\xD6denen / tahsil edilen toplam tutar" },
            firma: { type: import_genai2.Type.STRING, description: "\xD6demeyi yapan ya da alan muhatap firma/ki\u015Fi ad\u0131" },
            hareketTipi: { type: import_genai2.Type.STRING, description: "\u0130\u015Flem tipine g\xF6re '\xC7IKI\u015E' (\xF6deme yap\u0131ld\u0131ysa) veya 'G\u0130R\u0130\u015E' (tahsilat/para al\u0131nd\u0131ysa)" }
          },
          required: ["referansId", "tarih", "aciklama", "tutar", "firma", "hareketTipi"]
        };
        userPrompt = "L\xFCtfen ekteki makbuzu, tediye fi\u015Fini, gider makbuzunu veya banka dekontunu analiz et. Referans numaras\u0131n\u0131/makbuz no, tarihini (YYYY-MM-DD), a\xE7\u0131klamas\u0131n\u0131, \xF6denen/al\u0131nan net tutar\u0131, muhatap firma veya ki\u015Fi ad\u0131n\u0131 ve para \xE7\u0131k\u0131\u015F\u0131 ise '\xC7IKI\u015E', para giri\u015Fi ise 'G\u0130R\u0130\u015E' olacak \u015Fekilde hareketTipi alan\u0131n\u0131 \xE7\u0131kar.";
      } else if (docType === "hakedis") {
        responseSchema = {
          type: import_genai2.Type.OBJECT,
          properties: {
            faturaNo: { type: import_genai2.Type.STRING, description: "Hakedi\u015F kapa\u011F\u0131 no, fatura no veya hakedi\u015F no" },
            donem: { type: import_genai2.Type.STRING, description: "Hangi d\xF6neme ait oldu\u011Fu (\xF6rn: Haziran 2026, Hakedi\u015F No: 3 vb.)" },
            tarih: { type: import_genai2.Type.STRING, description: "YYYY-MM-DD format\u0131nda hakedi\u015F onay veya d\xFCzenleme tarihi" },
            cariUnvan: { type: import_genai2.Type.STRING, description: "Hakedi\u015F sahibi y\xFCklenici / ta\u015Feron / ana firma ad\u0131" },
            toplamTutar: { type: import_genai2.Type.NUMBER, description: "KDV hari\xE7 hakedi\u015F tutar\u0131 (ara toplam)" },
            kdvTutar: { type: import_genai2.Type.NUMBER, description: "Hakedi\u015F KDV tutar\u0131" },
            genelToplam: { type: import_genai2.Type.NUMBER, description: "KDV dahil \xF6denecek hakedi\u015F toplam tutar\u0131" },
            aciklama: { type: import_genai2.Type.STRING, description: "Hakedi\u015F a\xE7\u0131klamas\u0131, yap\u0131lan i\u015Fler vb. detaylar" }
          },
          required: ["faturaNo", "donem", "tarih", "cariUnvan", "toplamTutar", "kdvTutar", "genelToplam", "aciklama"]
        };
        userPrompt = "L\xFCtfen ekteki hakedi\u015F belgesini, hakedi\u015F kapa\u011F\u0131n\u0131 veya hakedi\u015F raporunu analiz et. Hakedi\u015F/fatura numaras\u0131n\u0131, d\xF6nemini (donem), tarihini (YYYY-MM-DD), y\xFCklenici/ta\u015Feron firma \xFCnvan\u0131n\u0131, KDV hari\xE7 toplam\u0131 (toplamTutar), KDV tutar\u0131n\u0131, genel toplam\u0131 ve k\u0131sa i\u015F a\xE7\u0131klamas\u0131n\u0131 \xE7\u0131kar.";
      } else if (docType === "yoklama") {
        responseSchema = {
          type: import_genai2.Type.OBJECT,
          properties: {
            tarih: { type: import_genai2.Type.STRING, description: "\u0130lgili ay, d\xF6nem veya tarih (\xF6rn: Haziran 2026 veya 2026-06-15)" },
            yoklamaKayitlari: {
              type: import_genai2.Type.ARRAY,
              items: {
                type: import_genai2.Type.OBJECT,
                properties: {
                  adSoyad: { type: import_genai2.Type.STRING, description: "Personel ad\u0131 soyad\u0131 (\xF6rn: 'Ahmet Y\u0131lmaz')" },
                  durum: { type: import_genai2.Type.STRING, description: "'Geldi', 'Yok', '\u0130zinli', 'Raporlu', 'Pazar', 'Tatil' durumlar\u0131ndan biri" },
                  gunNo: { type: import_genai2.Type.NUMBER, description: "Hangi g\xFCn oldu\u011Fu (1-31 aras\u0131 tamsay\u0131, \xF6rn: 15. g\xFCn ise 15)" },
                  mesaiSaati: { type: import_genai2.Type.NUMBER, description: "Varsa fazla mesai saati" }
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
          type: import_genai2.Type.OBJECT,
          properties: {
            tarih: { type: import_genai2.Type.STRING, description: "YYYY-MM-DD format\u0131nda rapor tarihi" },
            isNiteligi: { type: import_genai2.Type.STRING, description: "\u0130\u015Fin niteli\u011Fi, t\xFCr\xFC (\xF6rn: 'Beton D\xF6k\xFCm\xFC', 'Kal\u0131p \xC7ak\u0131m\u0131', 'Hafriyat ve Kaz\u0131')" },
            parsel: { type: import_genai2.Type.STRING, description: "Parsel no (\xF6rn: 'Parsel A' veya 'Parsel 3')" },
            blok: { type: import_genai2.Type.STRING, description: "Blok no (\xF6rn: 'Blok 1' veya 'Blok B')" },
            aciklama: { type: import_genai2.Type.STRING, description: "G\xFCnl\xFCk \u015Fantiyede yap\u0131lan faaliyet a\xE7\u0131klamalar\u0131 ve detaylar\u0131" },
            aktifPersonelListesi: {
              type: import_genai2.Type.ARRAY,
              items: { type: import_genai2.Type.STRING },
              description: "\u015Eantiye sahas\u0131nda aktif g\xF6rev alan personellerin isim listesi"
            }
          },
          required: ["tarih", "isNiteligi", "aciklama"]
        };
        userPrompt = "L\xFCtfen ekteki G\xFCnl\xFCk Saha Faaliyet Raporunu veya \u015Fantiye g\xFCnl\xFCk faaliyet logunu analiz et. Rapor tarihini (YYYY-MM-DD), yap\u0131lan i\u015Flerin niteli\u011Fini (isNiteligi), parsel ve blok bilgilerini, g\xFCnl\xFCk \xF6zet faaliyet detaylar\u0131n\u0131 ve sahada \xE7al\u0131\u015Fan aktif personellerin isim listesini \xE7\u0131kar.";
      } else if (docType === "auto") {
        responseSchema = {
          type: import_genai2.Type.OBJECT,
          properties: {
            detectedType: { type: import_genai2.Type.STRING, description: "Tespit edilen d\xF6k\xFCman t\xFCr\xFC: 'fatura', 'irsaliye', 'makbuz', 'hakedis', 'yoklama', or 'saha_faaliyet'" },
            faturaNo: { type: import_genai2.Type.STRING },
            irsaliyeNo: { type: import_genai2.Type.STRING },
            referansId: { type: import_genai2.Type.STRING },
            tarih: { type: import_genai2.Type.STRING, description: "YYYY-MM-DD format\u0131nda tarih" },
            donem: { type: import_genai2.Type.STRING, description: "D\xF6nem (\xF6rn: Haziran 2026)" },
            firma: { type: import_genai2.Type.STRING, description: "Firma / \u015Eah\u0131s / Al\u0131c\u0131 / Sat\u0131c\u0131 / Cari ad\u0131" },
            cariUnvan: { type: import_genai2.Type.STRING, description: "Cari \xFCnvan veya firma \xFCnvan\u0131" },
            toplamTutar: { type: import_genai2.Type.NUMBER },
            kdvTutar: { type: import_genai2.Type.NUMBER },
            genelToplam: { type: import_genai2.Type.NUMBER },
            tutar: { type: import_genai2.Type.NUMBER },
            aciklama: { type: import_genai2.Type.STRING },
            hareketTipi: { type: import_genai2.Type.STRING, description: "'G\u0130R\u0130\u015E' veya '\xC7IKI\u015E'" },
            kalemler: {
              type: import_genai2.Type.ARRAY,
              items: {
                type: import_genai2.Type.OBJECT,
                properties: {
                  urunAdi: { type: import_genai2.Type.STRING },
                  miktar: { type: import_genai2.Type.NUMBER },
                  birim: { type: import_genai2.Type.STRING },
                  birimFiyat: { type: import_genai2.Type.NUMBER },
                  kdvOran: { type: import_genai2.Type.NUMBER },
                  toplam: { type: import_genai2.Type.NUMBER }
                }
              }
            },
            yoklamaKayitlari: {
              type: import_genai2.Type.ARRAY,
              items: {
                type: import_genai2.Type.OBJECT,
                properties: {
                  adSoyad: { type: import_genai2.Type.STRING, description: "Personel ad\u0131 soyad\u0131 (\xF6rn: 'Ahmet Y\u0131lmaz')" },
                  durum: { type: import_genai2.Type.STRING, description: "'Geldi', 'Yok', '\u0130zinli', 'Raporlu', 'Pazar', 'Tatil' durumlar\u0131ndan biri" },
                  gunNo: { type: import_genai2.Type.NUMBER, description: "Ay\u0131n hangi g\xFCn\xFC oldu\u011Fu (1-31 aras\u0131 say\u0131, \xF6rn: 15)" },
                  mesaiSaati: { type: import_genai2.Type.NUMBER, description: "Fazla mesai saati" }
                },
                required: ["adSoyad", "durum"]
              }
            },
            isNiteligi: { type: import_genai2.Type.STRING, description: "\u0130\u015Fin niteli\u011Fi (\xF6rn: 'Beton D\xF6k\xFCm\xFC')" },
            parsel: { type: import_genai2.Type.STRING, description: "\u015Eantiye parseli (\xF6rn: 'Parsel A')" },
            blok: { type: import_genai2.Type.STRING, description: "\u015Eantiye blok bilgisi (\xF6rn: 'Blok 1')" },
            aktifPersonelListesi: {
              type: import_genai2.Type.ARRAY,
              items: { type: import_genai2.Type.STRING },
              description: "Sahada g\xF6rev alan personellerin isimleri"
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

L\xFCtfen en uygun kategoriyi 'detectedType' alan\u0131na atay\u0131p d\xF6k\xFCmandaki ilgili t\xFCm alanlar\u0131 b\xFCy\xFCk bir titizlikle \xE7\u0131kar.`;
      } else {
        return res.status(400).json({ error: "Invalid docType specified" });
      }
      const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
      let response;
      let lastError;
      for (const model of models) {
        try {
          console.log(`Parsing legacy document type ${docType} with ${model}...`);
          response = await ai.models.generateContent({
            model,
            contents: [userPrompt, imagePart],
            config: {
              responseMimeType: "application/json",
              responseSchema,
              temperature: 0.1
            }
          });
          if (response?.text) break;
        } catch (err) {
          lastError = err;
          console.warn(`Model ${model} failed, trying next:`, err);
        }
      }
      if (!response || !response.text) {
        throw lastError || new Error("All models failed to parse document");
      }
      const parsedData = JSON.parse(response.text);
      res.json({ success: true, data: parsedData });
    } catch (error) {
      console.error("Error in parse-legacy-document endpoint:", error);
      res.status(500).json({ error: error.message || "Failed to parse legacy document" });
    }
  });
  app2.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Sen Kibrit\xE7i \u0130n\u015Faat ERP sisteminin ak\u0131ll\u0131 yapay zeka \u015Fantiye asistan\u0131s\u0131n. Kullan\u0131c\u0131ya \u015Fantiye y\xF6netimi, personel, stok ve genel in\u015Faat ERP s\xFCre\xE7leri hakk\u0131nda yard\u0131mc\u0131 oluyorsun. L\xFCtfen k\u0131sa, anla\u015F\u0131l\u0131r, kibar ve \xE7\xF6z\xFCm odakl\u0131 bir yan\u0131t ver. Kullan\u0131c\u0131 mesaj\u0131: ${message}`
      });
      res.json({ text: response.text });
    } catch (error) {
      console.error("Error in chat assistant endpoint:", error);
      res.status(500).json({ error: error.message || "Failed to process message" });
    }
  });
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
