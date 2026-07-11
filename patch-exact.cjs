const fs = require('fs');
let text = fs.readFileSync('src/components/IdariScreen.tsx', 'utf8');
let lines = text.split(/\r?\n/);

function replaceLines(start, end, newLinesStr) {
    const newLines = newLinesStr.split('\n');
    lines.splice(start - 1, end - start + 1, ...newLines);
}

// 4. Floor (2881-2890) -> Do it first so line numbers don't shift!
replaceLines(2881, 2890, `                      <div key={\`\${campusNode.campus}_\${floorNode.floor}\`} className="space-y-2">
                        {(() => {
                          const floorRoomIds = floorNode.rooms.map(r => r.id);
                          const floorOccupants = kampKayitlari.filter(cr => cr.durum === 'AKTIF' && (floorRoomIds.includes(cr.roomId || '') || floorRoomIds.includes(cr.odaId || '')));
                          
                          const roomFirmMap = new Map();
                          floorOccupants.forEach(cr => {
                            const rid = cr.roomId || cr.odaId || '';
                            let firmaAdi = cr.calistigiFirma?.trim() || '';
                            if (!firmaAdi) {
                                const p = personeller.find(p => p.id === cr.personelId);
                                firmaAdi = p?.firmaAdi?.trim() || (cr.firmaTipi === 'TASERON' || p?.firmaTipi === 'TASERON' ? 'Taşeron' : 'KİBRİTÇİ İNŞAAT');
                            }
                            if (firmaAdi.length > 15) firmaAdi = firmaAdi.substring(0, 15) + '..';
                            
                            const firms = roomFirmMap.get(rid) || new Set();
                            firms.add(firmaAdi);
                            roomFirmMap.set(rid, firms);
                          });

                          return (
                            <div className="flex flex-col gap-1 bg-slate-100 p-2 rounded-lg border-l-4 border-amber-500 shadow-sm">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-800 text-xs tracking-tight uppercase flex items-center">
                                  🏢 {floorNode.floor}
                                </span>
                                <span className="text-[10px] text-slate-500 font-semibold text-right">
                                  Kayıtlı {floorNode.rooms.length} Oda • <strong className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">{floorOccupants.length} Personel</strong>
                                </span>
                              </div>
                              {floorOccupants.length > 0 && (
                                <div className="mt-1 pt-1.5 border-t border-slate-200/60">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">🦅 Kuşbakışı Firma Dağılımı:</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {floorNode.rooms.filter(r => roomFirmMap.has(r.id)).map(r => (
                                      <span key={r.id} className="text-[9px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                                        <strong className="text-slate-800">Oda {r.odaNo}</strong>: <span className="italic">{Array.from(roomFirmMap.get(r.id) || []).join(', ')}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}`);

// 3. Stats (2811-2817)
replaceLines(2811, 2817, `                <div className="flex justify-between">
                  <span>Toplam Yatak Kapasitesi:</span>
                  <strong className="text-slate-800">
                    {kampOdalari.reduce((acc, current) => acc + current.kapasite, 0)} Yatak
                  </strong>
                </div>

                <div className="pt-2 border-t mt-2 pb-1">
                  <span className="font-bold text-[10px] text-slate-500 uppercase block mb-1">Firma Özeti (Aktif Konaklama)</span>
                  {(() => {
                    const activeKampKayitlari = kampKayitlari.filter(k => k.durum === 'AKTIF');
                    const countsByFirm = new Map();
                    
                    activeKampKayitlari.forEach(k => {
                      let firmaAdi = k.calistigiFirma?.trim() || '';
                      if (!firmaAdi) {
                        const p = personeller.find(p => p.id === k.personelId);
                        firmaAdi = p?.firmaAdi?.trim() || (k.firmaTipi === 'TASERON' || p?.firmaTipi === 'TASERON' ? 'Taşeron (Belirtilmemiş)' : 'KİBRİTÇİ İNŞAAT');
                      }
                      
                      const current = countsByFirm.get(firmaAdi) || { personnel: 0, rooms: new Set() };
                      current.personnel++;
                      if (k.odaId || k.roomId) {
                        current.rooms.add(k.odaId || k.roomId || '');
                      }
                      countsByFirm.set(firmaAdi, current);
                    });
                    
                    return Array.from(countsByFirm.entries()).sort((a,b) => b[1].personnel - a[1].personnel).map(([firma, data]) => (
                      <div key={firma} className="flex justify-between text-[10px] py-0.5 items-center">
                        <span className="truncate w-36 font-semibold" title={firma}>{firma}</span>
                        <strong className="text-slate-700 bg-slate-100 px-1.5 rounded">{data.personnel} Kişi ({data.rooms.size} Oda)</strong>
                      </div>
                    ));
                  })()}
                </div>`);

// 2. View (2548-2551)
replaceLines(2548, 2551, `          {kampMainView === 'faaliyet' ? (
            <KampFaaliyetTakipTab />
          ) : kampMainView === 'personel' ? (
            <div className="bg-white border border-[#e2e8f0] rounded-2xl flex flex-col overflow-hidden shadow-sm flex-1">
              <div className="bg-[#2563EB] text-slate-100 p-4 shrink-0 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-slate-300 uppercase">Kamp & Barınma</span>
                  <h3 className="font-display font-semibold text-sm">👤 Kamp Yönetimi Personel Listesi</h3>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="İsim, TC veya Firma Ara..."
                    value={kampPersonelSearch}
                    onChange={(e) => setKampPersonelSearch(e.target.value)}
                    className="w-64 pl-8 py-1.5 text-xs font-semibold rounded-lg bg-white/10 text-white placeholder-slate-300 border border-white/20 focus:outline-none focus:ring-1 focus:ring-white"
                  />
                  <span className="absolute left-2.5 top-2 text-slate-300">🔍</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-0">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="p-3 font-bold text-slate-600">Personel / Kimlik</th>
                      <th className="p-3 font-bold text-slate-600">Bağlı Olduğu Firma</th>
                      <th className="p-3 font-bold text-slate-600">Yerleşke / Oda</th>
                      <th className="p-3 font-bold text-slate-600">Kayıt / Giriş Tarihi</th>
                      <th className="p-3 font-bold text-slate-600">Durum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {kampKayitlari.filter(k => k.durum === 'AKTIF').filter(k => {
                      if (!kampPersonelSearch.trim()) return true;
                      const s = kampPersonelSearch.toLowerCase();
                      const p = personeller.find(p => p.id === k.personelId);
                      const name = (p ? \`\${p.ad} \${p.soyad}\` : (k.isimSoyisim || '')).toLowerCase();
                      const tc = (p?.tcNo || '').toLowerCase();
                      const firm = (k.calistigiFirma || p?.firmaAdi || k.firmaTipi || '').toLowerCase();
                      return name.includes(s) || tc.includes(s) || firm.includes(s);
                    }).map(k => {
                      const p = personeller.find(p => p.id === k.personelId);
                      const name = p ? \`\${p.ad} \${p.soyad}\` : (k.isimSoyisim || 'Bilinmiyor');
                      const tc = p?.tcNo ? \`TC: \${p.tcNo}\` : '';
                      const firm = k.calistigiFirma?.trim() || p?.firmaAdi?.trim() || (k.firmaTipi === 'TASERON' ? 'Taşeron (Bilinmiyor)' : 'KİBRİTÇİ İNŞAAT');
                      const room = kampOdalari.find(r => r.id === (k.odaId || k.roomId));
                      
                      return (
                        <tr key={k.id} className="hover:bg-slate-50 transition">
                          <td className="p-3">
                            <div className="font-bold text-slate-800">{name}</div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">{tc}</div>
                          </td>
                          <td className="p-3 font-medium text-slate-700">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] uppercase border border-slate-200">
                              {firm}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600">
                            {room ? (
                              <div>
                                <strong className="text-slate-800">Oda {room.odaNo}</strong>
                                <span className="text-[10px] block mt-0.5">({room.yerleskeAdi} / {room.katAdi})</span>
                              </div>
                            ) : (
                              <span className="text-red-500 italic">Oda Atanmamış</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-500 font-mono">
                            {k.girisTarihi || k.kayitTarihi || '-'}
                          </td>
                          <td className="p-3">
                            <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded text-[10px]">
                              AKTİF
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
        <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0">`);

// 1. Tabs (2535-2546)
replaceLines(2535, 2546, `            <button
              type="button"
              onClick={() => setKampMainView('faaliyet')}
              className={\`px-4 py-2 text-[10px] font-black rounded-lg transition \${
                kampMainView === 'faaliyet'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }\`}
            >
              📋 Faaliyet Takip
            </button>
            <button
              type="button"
              onClick={() => setKampMainView('personel')}
              className={\`px-4 py-2 text-[10px] font-black rounded-lg transition \${
                kampMainView === 'personel'
                  ? 'bg-white text-indigo-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }\`}
            >
              👤 Personel Listesi
            </button>
          </div>`);

fs.writeFileSync('src/components/IdariScreen.tsx', lines.join('\\n'), 'utf8');
console.log("IdariScreen patched exactly by line numbers.");
