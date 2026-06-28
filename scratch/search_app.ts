import fs from "fs";

const filePath = "c:/Users/DELL/Desktop/Yeni klasör (2)/src/App.tsx";
const content = fs.readFileSync(filePath, "utf-8");
const lines = content.split("\n");

console.log("Searching App.tsx elements...");
lines.forEach((line, idx) => {
  if (line.includes("import") && line.includes("Screen")) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
  if (line.includes("activeTab ===") || line.includes("activeTab === 'satin_alma'")) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
  if (line.includes("operatorFaaliyetleri") || line.includes("taseronKesintiRaporlari") || line.includes("kasaHareketleri")) {
    if (idx < 500) {
      console.log(`Line ${idx + 1} state: ${line.trim()}`);
    }
  }
});
