const fs = require('fs');
let code = fs.readFileSync('src/components/GuvenlikScreen.tsx', 'utf8');

code = code.replace(
  'const [statusMsg, setStatusMsg] = useState<{ type: \'success\' | \'error\', text: string } | null>(null);',
  'const [statusMsg, setStatusMsg] = useState<{ type: \'success\' | \'error\', text: string } | null>(null);\n  const [islemTarihi, setIslemTarihi] = useState(new Date().toISOString().slice(0, 10));\n  const getIslemZamani = () => { const timeStr = new Date().toISOString().split(\'T\')[1]; return `${islemTarihi}T${timeStr}`; };\n\n  const handleNobetRaporuAl = () => { /* to be implemented */ };'
);

code = code.replace(
  '<h2 className="font-display font-black text-sm text-slate-800 uppercase tracking-widest">Güvenlik & Kapı Kontrol</h2>',
  '<h2 className="font-display font-black text-sm text-slate-800 uppercase tracking-widest">Güvenlik & Kapı Kontrol</h2>\n          <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">\n            <label className="text-[9px] font-bold text-slate-500 uppercase">İşlem Tarihi:</label>\n            <input type="date" value={islemTarihi} onChange={(e) => setIslemTarihi(e.target.value)} className="bg-transparent text-xs font-bold text-slate-800 outline-none" />\n          </div>'
);

code = code.replace(/new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/g, 'islemTarihi');
code = code.replace(/new Date\(\)\.toISOString\(\)\.slice\(0,10\)/g, 'islemTarihi');
code = code.replace(/new Date\(\)\.toISOString\(\)/g, 'getIslemZamani()');

code = code.replace(
  '<button onClick={handleNobetKapat} disabled={isArchiving}',
  '<button onClick={handleNobetRaporuAl} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-2xl transition cursor-pointer text-xs uppercase tracking-widest shadow-md shadow-amber-500/20">Günlük Rapor Al</button>\n                    <button onClick={handleNobetKapat} disabled={isArchiving}'
);

fs.writeFileSync('src/components/GuvenlikScreen.tsx', code);
console.log('Done');
