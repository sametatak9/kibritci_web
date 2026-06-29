const fs = require('fs');
const lines = fs.readFileSync('server.ts', 'utf8').split('\n');
const header = [
  "import { Express } from 'express';",
  "import { Type } from '@google/genai';",
  "import { getGeminiClient } from './gemini';",
  '',
  'export function registerApiRoutes(app: Express): void {',
].join('\n');
const start = lines.findIndex((l) => l.includes('app.post("/api/send-verification-email"'));
const end = lines.findIndex((l) => l.includes('// Vite & Static file handler'));
const body = lines.slice(start, end).join('\n');
fs.mkdirSync('src/server', { recursive: true });
fs.writeFileSync('src/server/registerApiRoutes.ts', header + '\n' + body + '\n}\n');
console.log('Written', end - start, 'lines to src/server/registerApiRoutes.ts');
