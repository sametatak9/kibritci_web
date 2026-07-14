import fs from 'fs';

const path = 'src/components/KasaScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add Excel import
if (!content.includes("exportKasaExcel")) {
  content = content.replace("import { CorporateReportLayout } from './CorporateReportLayout';", 
    "import { CorporateReportLayout } from './CorporateReportLayout';\nimport { exportKasaExcel } from '../lib/kasaExcelExport';");
}

// 2. Add Excel Button
const printButton = `<button 
                      onClick={() => setShowWeeklyReportModal(true)}
                      className="px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded hover:bg-slate-900 transition flex items-center space-x-1"
                    >
                      <Printer size={12} />
                      <span>YAZDIR</span>
                    </button>`;
const excelButton = `<button 
                      onClick={() => exportKasaExcel(filteredHareketler, appliedStartDate, appliedEndDate)}
                      className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 transition flex items-center space-x-1"
                    >
                      <Printer size={12} />
                      <span>EXCEL</span>
                    </button>`;

if (!content.includes("EXCEL")) {
  content = content.replace(printButton, `${printButton}\n                    ${excelButton}`);
}

// 3. Change GİRİŞ and ÇIKIŞ texts
content = content.replace(/📈 GİRİŞ \(Gelir \/ Hakediş\)/g, "📈 GİRİŞ");
content = content.replace(/📉 ÇIKIŞ \(Fişli Gider \/ Avans\)/g, "📉 ÇIKIŞ");
content = content.replace(/<span className="font-bold text-emerald-700">GİRİŞ \(Firma Hesabına Giren\)<\/span>/g, '<span className="font-bold text-emerald-700">GİRİŞ</span>');
content = content.replace(/<span className="font-bold text-rose-700">ÇIKIŞ \(Fişli Gider \/ Avans\)<\/span>/g, '<span className="font-bold text-rose-700">ÇIKIŞ</span>');

// 4. Remove Referans Tipi and ID inputs
const refInputsRegex = /\{\/\* Referans Tipi \*\/\}[\s\S]*?\{\/\* Referans ID \*\/\}[\s\S]*?<\/div>\s*<\/div>/g;
// Actually I'll just remove them manually using replace
content = content.replace(/\{\/\* Referans Tipi \*\/\}[\s\S]*?<\/div>/, '');
content = content.replace(/\{\/\* Referans ID \*\/\}[\s\S]*?<\/div>/, '');

// Fix handleSaveKasaHareketi to ignore newRefType/newRefId dependencies where we just deleted inputs
// Wait, the state `newRefType` and `newRefId` still exist and default to "DİĞER" and "", which is fine.

// 5. Remove "ŞANTİYE MERKEZ VE MUHASEBE VE FİNANSAL HAKEDİŞ DAİRESİ"
content = content.replace(/<p className="text-\[10px\] text-slate-500 font-bold uppercase tracking-wider">ŞANTİYE MERKEZ VE MUHASEBE VE FİNANSAL HAKEDİŞ DAİRESİ<\/p>/g, "");

// 6. Remove unvan alt yazıları
content = content.replace(/<span className="text-\[10px\] text-slate-500 block mb-6">Finansal hakediş ve kasa girişi<\/span>/g, "");
content = content.replace(/<span className="text-\[10px\] text-slate-500 block mb-6">Şantiye Şefliği<\/span>/g, "");
content = content.replace(/<span className="text-\[10px\] text-slate-500 block mb-6">Saha organizasyonu fiili kontrol<\/span>/g, "");
content = content.replace(/<span className="text-\[10px\] text-slate-500 block mb-6">Müteahhit ve Nihai Onaycı Müdür<\/span>/g, "");

// 7. Remove Referans from table headers and columns
content = content.replace(/<div className="col-span-2">Açıklama &amp; Referans &amp; İşlem Barları<\/div>/g, '<div className="col-span-2">Açıklama &amp; İşlem Barları</div>');
content = content.replace(/<div className="text-\[10px\] text-slate-500 mt-1">Ref: \{kh\.referansTipi\} \{kh\.referansId \? `- \$\{kh\.referansId\}` : ''\}<\/div>/g, "");
content = content.replace(/<th className="p-2 border-r border-slate-300 w-32 text-left">Referans \/ Evrak No<\/th>/g, "");
content = content.replace(/<td className="p-2 border-r border-slate-300 w-32">\s*<div className="font-semibold text-slate-700">\{kh\.referansTipi\}<\/div>\s*<div className="text-slate-500 truncate">\{kh\.referansId || '-'}<\/div>\s*<\/td>/g, "");

fs.writeFileSync(path, content, 'utf8');
console.log("KasaScreen patched successfully.");
