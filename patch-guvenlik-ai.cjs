const fs = require('fs');
let code = fs.readFileSync('src/components/GuvenlikScreen.tsx', 'utf8');

const newAILogic = `          // Use the smart endpoint that auto-detects document type
          const endpoint = '/api/parse-belge';
          
          const resData = await fetchApiJson<{ success: boolean; data?: any; error?: string }>(
            endpoint,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileBase64: base64Data, mimeType: file.type }),
            }
          );
          if (!resData.success) {
            throw new Error(resData.error || 'Evrak yapay zeka tarafından çözümlenirken bir sorun oluştu.');
          }
  
          const parsed = resData.data;
  
          // Populate fields
          setEvrakTuru(parsed.evrakTuru || 'GENEL_EVRAK');
          setIrsaliyeNo(parsed.evrakNo || parsed.irsaliyeNo || parsed.faturaNo || "");
          if (parsed.firma) setFirma(parsed.firma);`;

code = code.replace(
  `          // Use parse-fatura or parse-irsaliye based on selected type
          const endpoint = (evrakTuru === 'FATURA') ? '/api/parse-fatura' : '/api/parse-irsaliye';
          
          const resData = await fetchApiJson<{ success: boolean; data?: any; error?: string }>(
            endpoint,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileBase64: base64Data, mimeType: file.type }),
            }
          );
          if (!resData.success) {
            throw new Error(resData.error || 'Evrak yapay zeka tarafından çözümlenirken bir sorun oluştu.');
          }
  
          const parsed = resData.data;
  
          // Populate fields
          setIrsaliyeNo(parsed.irsaliyeNo || parsed.faturaNo || "");
          if (parsed.firma) setFirma(parsed.firma);`,
  newAILogic
);

fs.writeFileSync('src/components/GuvenlikScreen.tsx', code);
console.log('Done');
