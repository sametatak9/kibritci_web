import fs from "fs";

const filePath = "c:/Users/DELL/Desktop/Yeni klasör (2)/src/components/IdariScreen.tsx";
const content = fs.readFileSync(filePath, "utf-8");
const lines = content.split("\n");

lines.forEach((line, idx) => {
  if (line.includes("setEditingCariId") || line.includes("setEditingStokId")) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
