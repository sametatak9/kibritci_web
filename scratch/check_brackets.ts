import fs from "fs";

const content = fs.readFileSync("c:/Users/DELL/Desktop/Yeni klasör (2)/src/components/SatinAlmaScreen.tsx", "utf-8");
let balance = 0;
const lines = content.split("\n");

lines.forEach((line, idx) => {
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "{") balance++;
    if (line[i] === "}") balance--;
  }
  if (balance < 0) {
    console.log(`LINE ${idx + 1} has negative balance: ${balance}. Content: ${line.trim()}`);
  }
});

console.log("Final Brackets balance:", balance);
