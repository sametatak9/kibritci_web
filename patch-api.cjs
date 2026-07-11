const fs = require('fs');
let code = fs.readFileSync('src/server/registerApiRoutes.ts', 'utf8');

const parseBelge = `  app.post("/api/parse-belge", async (req, res) => {
    try {
      const { fileBase64, mimeType } = req.body;
      if (!fileBase64 || !mimeType) {
        return res.status(400).json({ error: "Missing fileBase64 or mimeType in request body" });
      }

      const imagePart = {
        inlineData: { mimeType: mimeType, data: fileBase64 },
      };

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          evrakTuru: { type: Type.STRING, description: "FATURA, İRSALİYE, MAKBUZ veya GENEL_EVRAK" },
          evrakNo: { type: Type.STRING },
          tarih: { type: Type.STRING },
          firma: { type: Type.STRING },
          kalemler: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                urunAdi: { type: Type.STRING },
                miktar: { type: Type.NUMBER },
                birim: { type: Type.STRING }
              },
              required: ["urunAdi", "miktar", "birim"]
            }
          }
        },
        required: ["evrakTuru", "evrakNo", "tarih", "firma", "kalemler"]
      };

      const userPrompt = \`Lütfen ekteki evrakı (belgeyi) analiz et.
Öncelikle bu belgenin türünü belirle:
- Fatura ise evrakTuru 'FATURA' olmalı.
- İrsaliye veya Sevk İrsaliyesi ise evrakTuru 'İRSALİYE' olmalı.
- Makbuz veya Tahsilat Makbuzu ise evrakTuru 'MAKBUZ' olmalı.
- Bunların hiçbiri değilse evrakTuru 'GENEL_EVRAK' olmalı.

Sonra şu bilgileri çıkar:
- Belge numarası (evrakNo) (Fatura No, İrsaliye No, vb.)
- Belgenin tarihi (tarih) (YYYY-MM-DD formatında)
- Gönderici/Satıcı/Firma adı (firma)
- Belgedeki tüm malzeme veya hizmet kalemlerini (urunAdi, miktar, birim)\`;

      const { text } = await generateGeminiWithFallback({
        contents: [userPrompt, imagePart],
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.1,
        },
      });

      res.status(200).json({ success: true, data: JSON.parse(text) });
    } catch (error: any) {
      console.error("AI Belge Ayrıştırma Hatası:", error);
      res.status(500).json({ error: error.message || "Belge okunamadı." });
    }
  });

  // API endpoint to parse Invoice (Fatura) (PDF or Image)
  app.post("/api/parse-fatura", async (req, res) => {`;

code = code.replace(
  '  // API endpoint to parse Invoice (Fatura) (PDF or Image)\n  app.post("/api/parse-fatura", async (req, res) => {',
  parseBelge
);

fs.writeFileSync('src/server/registerApiRoutes.ts', code);
console.log('Done');
