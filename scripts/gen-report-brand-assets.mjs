import fs from 'fs';
import path from 'path';

const header = fs.readFileSync('src/assets/kibritci-report-header.png').toString('base64');
const wm = fs.readFileSync('src/assets/kibritci-report-watermark.png').toString('base64');

const out = `/** Antetli Word sablonundan kirpilmis rapor gorselleri (base64) */
export const KIBRITCI_REPORT_HEADER_DATA_URL = 'data:image/png;base64,${header}';
export const KIBRITCI_REPORT_WATERMARK_DATA_URL = 'data:image/png;base64,${wm}';
`;

fs.writeFileSync('src/lib/reportBrandAssets.ts', out);
console.log('written', out.length, 'chars');
