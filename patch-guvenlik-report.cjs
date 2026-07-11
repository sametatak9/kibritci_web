const fs = require('fs');
let code = fs.readFileSync('src/components/GuvenlikScreen.tsx', 'utf8');

const importStatement = `import html2canvas from 'html2canvas';\nimport { jsPDF } from 'jspdf';\nimport { generateGuvenlikReportHtml } from '../lib/guvenlikReportHtml';\n`;

code = code.replace(
  "import React, { useState, useEffect, useRef } from 'react';",
  "import React, { useState, useEffect, useRef } from 'react';\n" + importStatement
);

const handleNobetRaporuAlLogic = `  const handleNobetRaporuAl = async () => {
    try {
      showStatus('success', 'Rapor oluşturuluyor, lütfen bekleyin...');
      
      const todayLogs = personelLoglar.filter(l => l.zaman && l.zaman.startsWith(islemTarihi));
      const todayAraclar = [...iceridekiAraclar, ...aracGecmisLoglar].filter(a => a.girisZamani && a.girisZamani.startsWith(islemTarihi));
      const todayZiyaretciler = [...aktifZiyaretciler, ...ziyaretciGecmisLoglar].filter(z => z.girisZamani && z.girisZamani.startsWith(islemTarihi));
      const todayEvraklar = gelenEvraklar.filter(e => e.tarih === islemTarihi);

      const htmlContent = generateGuvenlikReportHtml(
        islemTarihi,
        todayLogs,
        todayAraclar,
        todayZiyaretciler,
        todayEvraklar
      );

      const container = document.createElement('div');
      container.innerHTML = htmlContent;
      container.style.position = 'absolute';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '1000px'; 
      document.body.appendChild(container);

      const canvas = await html2canvas(container, { scale: 2, useCORS: true });
      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      pdf.save(\`Kibritci_Guvenlik_Raporu_\${islemTarihi}.pdf\`);
      showStatus('success', 'Rapor başarıyla indirildi.');
    } catch (error) {
      console.error("PDF oluşturma hatası:", error);
      showStatus('error', 'Rapor oluşturulurken bir hata oluştu.');
    }
  };`;

code = code.replace(
  '  const handleNobetRaporuAl = () => { /* to be implemented */ };',
  handleNobetRaporuAlLogic
);

fs.writeFileSync('src/components/GuvenlikScreen.tsx', code);
console.log('Done');
