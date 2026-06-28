import React, { useState, useEffect } from 'react';
import { 
  Building2, HardHat, DollarSign, Wallet, FileText, Send, 
  ChevronRight, ClipboardList, ShieldAlert, Sparkles, RefreshCw, Printer
} from 'lucide-react';
import { CariKart, OperatorFaaliyet, HazirTutanak, TaseronKesintiRaporu } from '../types/erp';
import { db, saveDocument } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

interface TaseronKesintiScreenProps {
  cariKartlar: CariKart[];
  operatorFaaliyetleri: OperatorFaaliyet[];
  hazirTutanaklar: HazirTutanak[];
  taseronKesintiRaporlari: TaseronKesintiRaporu[];
  setTaseronKesintiRaporlari: React.Dispatch<React.SetStateAction<TaseronKesintiRaporu[]>>;
  addNotification?: (mesaj: string) => void;
  currentUser?: any;
}

export const TaseronKesintiScreen: React.FC<TaseronKesintiScreenProps> = ({
  cariKartlar,
  operatorFaaliyetleri,
  hazirTutanaklar,
  taseronKesintiRaporlari,
  setTaseronKesintiRaporlari,
  addNotification,
  currentUser
}) => {
  const taseronlar = cariKartlar.filter(c => c.kartTipi === 'TASERON');
  const [selectedTaseron, setSelectedTaseron] = useState<string>(taseronlar[0]?.unvan || "");
  
  // Meter states
  const [elekIlk, setElekIlk] = useState(0);
  const [elekSon, setElekSon] = useState(0);
  const [elekBirim, setElekBirim] = useState(3.5); // unit cost in TL
  
  const [suIlk, setSuIlk] = useState(0);
  const [suSon, setSuSon] = useState(0);
  const [suBirim, setSuBirim] = useState(12.0);

  const [gazIlk, setGazIlk] = useState(0);
  const [gazSon, setGazSon] = useState(0);
  const [gazBirim, setGazBirim] = useState(8.5);

  const [saatlikUcret, setSaatlikUcret] = useState(1500); // work machine hourly rate
  const [selectedPeriod, setSelectedPeriod] = useState("Haziran 2026");

  // Calculated values
  const elekFark = Math.max(0, elekSon - elekIlk);
  const elekTutar = elekFark * elekBirim;

  const suFark = Math.max(0, suSon - suIlk);
  const suTutar = suFark * suBirim;

  const gazFark = Math.max(0, gazSon - gazIlk);
  const gazTutar = gazFark * gazBirim;

  const toplamEnerjiKesinti = elekTutar + suTutar + gazTutar;

  // Filter operator activities for the selected subcontractor
  const matchingActivities = operatorFaaliyetleri.filter(
    op => op.firmaAdi?.toLowerCase().trim() === selectedTaseron?.toLowerCase().trim()
  );
  const toplamSaat = matchingActivities.reduce((acc, curr) => acc + (curr.calismaSuresi || 0), 0);
  const toplamIsMakinesiKesinti = toplamSaat * saatlikUcret;

  // Filter penalties/fines for the selected subcontractor
  const matchingPenalties = hazirTutanaklar.filter(
    t => t.tutanakTipi === 'CEZA' && 
         (t.taseronAdi?.toLowerCase().trim() === selectedTaseron?.toLowerCase().trim() ||
          t.cariKartId === cariKartlar.find(c => c.unvan === selectedTaseron)?.id)
  );
  const toplamCezaKesinti = matchingPenalties.reduce((acc, curr) => acc + (curr.cezaTutari || 0), 0);

  const genelToplamKesinti = toplamEnerjiKesinti + toplamIsMakinesiKesinti + toplamCezaKesinti;

  // Selected period reports
  const currentPeriodReport = taseronKesintiRaporlari.find(
    r => r.taseronFirmaAdi === selectedTaseron && `${r.donemAy} ${r.donemYil}` === selectedPeriod
  );

  const handleCreateReport = () => {
    if (!selectedTaseron) {
      alert("Lütfen bir taşeron firma seçiniz.");
      return;
    }

    const reportId = `tkr_${Date.now()}`;
    const [ay, yil] = selectedPeriod.split(" ");

    const newReport: TaseronKesintiRaporu = {
      id: reportId,
      taseronFirmaAdi: selectedTaseron,
      taseronFirmaId: cariKartlar.find(c => c.unvan === selectedTaseron)?.id || "",
      donemAy: ay,
      donemYil: yil,
      toplamSaat: toplamSaat,
      saatlikUcret: saatlikUcret,
      kesintiTutari: genelToplamKesinti,
      faaliyetler: matchingActivities,
      onayDurumu: 'TASLAK',
      olusturanKullanici: currentUser?.email || 'admin',
      olusturmaTarihi: new Date().toISOString().split('T')[0],
      epostaKonusu: `${selectedTaseron} - ${selectedPeriod} Taşeron Hakediş Kesinti Bildirimi`,
      epostaIcerik: `Sayın Yetkili,\n\n${selectedPeriod} dönemine ait ${selectedTaseron} firmasının şantiye hakediş kesinti dökümü aşağıdaki gibidir:\n\n1. İş Makinesi Çalışma Bedeli (${toplamSaat} saat * ${saatlikUcret} TL): ${toplamIsMakinesiKesinti.toLocaleString('tr-TR')} TL\n2. Şantiye Enerji Tüketim Bedeli (Elektrik, Su, Doğalgaz): ${toplamEnerjiKesinti.toLocaleString('tr-TR')} TL\n3. İSG ve Saha Cezaları Toplamı: ${toplamCezaKesinti.toLocaleString('tr-TR')} TL\n\nGENEL TOPLAM KESİNTİ: ${genelToplamKesinti.toLocaleString('tr-TR')} TL\n\nDetaylar sistemde kayıt altına alınmıştır. Raporun onaylı hali ekte sunulmuştur.`
    };

    setTaseronKesintiRaporlari(prev => [newReport, ...prev]);
    if (addNotification) {
      addNotification(`${selectedTaseron} firması için ${selectedPeriod} dönemi kesinti raporu oluşturuldu.`);
    }
    alert(`${selectedTaseron} firması için ${selectedPeriod} dönemi kesinti raporu başarıyla oluşturuldu!`);
  };

  const handleSendToCenter = async (report: TaseronKesintiRaporu) => {
    if (window.confirm(`${report.taseronFirmaAdi} firmasının kesinti raporunu merkeze e-posta ile göndermek istediğinize emin misiniz?`)) {
      // Simulate sending email
      const updated = {
        ...report,
        onayDurumu: 'GONDERILDI' as const,
        epostaGonderildi: true,
        gonderimTarihi: new Date().toISOString().split('T')[0]
      };

      setTaseronKesintiRaporlari(prev => prev.map(r => r.id === report.id ? updated : r));
      
      // Save mail queue record
      const mailId = `mail_${Date.now()}`;
      await saveDocument('epostaGonderimleri', {
        id: mailId,
        konu: report.epostaKonusu || "Kesinti Bildirimi",
        alicilar: "merkez-muhasebe@kibritci.com",
        modul: 'RAPOR',
        raporTipi: 'Taşeron Hakediş Kesintisi',
        durum: 'GONDERILDI',
        notlar: `${report.taseronFirmaAdi} - ${report.donemAy} ${report.donemYil} kesinti hakediş dökümü.`,
        tarih: new Date().toISOString().split('T')[0]
      });

      if (addNotification) {
        addNotification(`${report.taseronFirmaAdi} kesinti raporu merkeze e-posta ile iletildi.`);
      }
      alert("Hakediş kesinti raporu merkez e-posta kuyruğuna gönderildi ve arşivlendi!");
    }
  };

  const handlePrintReport = (report: TaseronKesintiRaporu) => {
    const htmlContent = `
      <html>
        <head>
          <meta charset="utf-8">
          <title>${report.taseronFirmaAdi} Kesinti Raporu</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
            .header { text-align: center; border-bottom: 3px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { margin: 0; color: #1e3a8a; font-size: 24px; }
            .header p { margin: 5px 0; color: #64748b; font-size: 13px; font-weight: bold; }
            .summary-table { w-full; border-collapse: collapse; margin-bottom: 30px; }
            .summary-table th, .summary-table td { border: 1px solid #cbd5e1; padding: 12px; text-align: left; font-size: 13px; }
            .summary-table th { bg-color: #f1f5f9; font-weight: bold; }
            .total-row { font-weight: bold; background-color: #e2e8f0; }
            .footer { margin-top: 50px; display: flex; justify-content: space-between; }
            .signature-box { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 10px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>KİBRİTÇİ İNŞAAT TAAHHÜT A.Ş.</h1>
            <p>TAŞERON HAKEDİŞ KESİNTİ REFERANS RAPORU</p>
            <p>Firma: ${report.taseronFirmaAdi} · Dönem: ${report.donemAy} ${report.donemYil}</p>
          </div>
          
          <table class="summary-table" style="width: 100%;">
            <thead>
              <tr>
                <th>Açıklama / Kesinti Detayı</th>
                <th style="text-align: right;">Birim / Miktar</th>
                <th style="text-align: right;">Birim Fiyat (TL)</th>
                <th style="text-align: right;">Toplam Tutar (TL)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>İş Makinesi Çalışma Bedeli (Operatör Raporlarından)</td>
                <td style="text-align: right;">${report.toplamSaat} Saat</td>
                <td style="text-align: right;">${report.saatlikUcret.toLocaleString('tr-TR')} TL</td>
                <td style="text-align: right;">${(report.toplamSaat * report.saatlikUcret).toLocaleString('tr-TR')} TL</td>
              </tr>
              <tr class="total-row">
                <td colspan="3">GENEL KESİNTİ TOPLAMI</td>
                <td style="text-align: right;">${report.kesintiTutari.toLocaleString('tr-TR')} TL</td>
              </tr>
            </tbody>
          </table>

          <p style="font-size: 11px; color: #64748b;">* Bu rapor operatör çalışma föyleri ve şantiye sayaç endeks farkları esas alınarak ERP tarafından üretilmiştir.</p>
          
          <div class="footer">
            <div class="signature-box">Şantiye Şefi / Hazırlayan</div>
            <div class="signature-box">Taşeron Yetkilisi / Teslim Alan</div>
          </div>
        </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.print();
  };

  return (
    <div className="flex-grow p-6 min-h-[calc(100vh-52px)] overflow-y-auto flex flex-col lg:flex-row font-sans gap-6 select-none bg-slate-50/50">
      
      {/* 40% LEFT PANEL: Selector & Meter Index Entry */}
      <div className="w-full lg:w-[420px] shrink-0 bg-white border border-[#e2e8f0] rounded-2xl flex flex-col overflow-hidden shadow-sm">
        
        {/* Header */}
        <div className="bg-[#0F172A] text-slate-100 p-4 shrink-0 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold tracking-widest text-amber-500 uppercase">
              Hakediş Kesinti Hesaplama
            </span>
            <h3 className="font-display font-bold text-sm">
              🏢 Taşeron Cezaları &amp; Enerji Dağıtımı
            </h3>
          </div>
          <span className="text-[10px] bg-slate-800 border border-slate-700 px-2.5 py-0.5 rounded-full font-mono font-bold text-amber-500">
            Hesap Motoru
          </span>
        </div>

        {/* Setup Parameters Form */}
        <div className="flex-grow p-5 space-y-4 overflow-y-auto text-xs text-slate-700">
          
          {/* Subcontractor selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Taşeron Cari Firma</label>
            <select
              value={selectedTaseron}
              onChange={(e) => setSelectedTaseron(e.target.value)}
              className="w-full text-xs font-semibold p-2 bg-slate-50 border border-[#e2e8f0] rounded-lg"
            >
              {taseronlar.length === 0 ? (
                <option value="">Taşeron Cari Kart Bulunmuyor</option>
              ) : (
                taseronlar.map(t => <option key={t.id} value={t.unvan}>{t.unvan}</option>)
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Dönem (Ay/Yıl)</label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full text-xs font-semibold p-2 bg-slate-50 border border-[#e2e8f0] rounded-lg"
              >
                <option value="Haziran 2026">Haziran 2026</option>
                <option value="Temmuz 2026">Temmuz 2026</option>
                <option value="Ağustos 2026">Ağustos 2026</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">İş Makinesi Saat Ücreti</label>
              <input
                type="number"
                value={saatlikUcret}
                onChange={(e) => setSaatlikUcret(Number(e.target.value))}
                className="w-full text-xs font-semibold p-2 bg-slate-50 border border-[#e2e8f0] rounded-lg"
              />
            </div>
          </div>

          {/* Meter Indices section */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">🔌 Şantiye Enerji Sayaç Dağılımı</h4>
            
            {/* Electricity */}
            <div className="space-y-1 bg-slate-50/50 p-2.5 rounded-xl border border-slate-150/50">
              <div className="flex justify-between items-center text-[10px] font-bold text-blue-700">
                <span>⚡ ELEKTRİK SAYACI</span>
                <span>Fark: {elekFark} kWh</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  placeholder="İlk Endeks"
                  value={elekIlk || ""}
                  onChange={(e) => setElekIlk(Number(e.target.value))}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-center"
                />
                <input
                  type="number"
                  placeholder="Son Endeks"
                  value={elekSon || ""}
                  onChange={(e) => setElekSon(Number(e.target.value))}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-center"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Birim Fiyat"
                  value={elekBirim || ""}
                  onChange={(e) => setElekBirim(Number(e.target.value))}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-center"
                />
              </div>
              <p className="text-[9px] text-right text-slate-450 font-bold">Maliyet: {elekTutar.toLocaleString('tr-TR')} TL</p>
            </div>

            {/* Water */}
            <div className="space-y-1 bg-slate-50/50 p-2.5 rounded-xl border border-slate-150/50">
              <div className="flex justify-between items-center text-[10px] font-bold text-cyan-700">
                <span>💧 SU SAYACI</span>
                <span>Fark: {suFark} m³</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  placeholder="İlk Endeks"
                  value={suIlk || ""}
                  onChange={(e) => setSuIlk(Number(e.target.value))}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-center"
                />
                <input
                  type="number"
                  placeholder="Son Endeks"
                  value={suSon || ""}
                  onChange={(e) => setSuSon(Number(e.target.value))}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-center"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Birim Fiyat"
                  value={suBirim || ""}
                  onChange={(e) => setSuBirim(Number(e.target.value))}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-center"
                />
              </div>
              <p className="text-[9px] text-right text-slate-450 font-bold">Maliyet: {suTutar.toLocaleString('tr-TR')} TL</p>
            </div>

            {/* Gas */}
            <div className="space-y-1 bg-slate-50/50 p-2.5 rounded-xl border border-slate-150/50">
              <div className="flex justify-between items-center text-[10px] font-bold text-orange-700">
                <span>🔥 DOĞALGAZ SAYACI</span>
                <span>Fark: {gazFark} m³</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  placeholder="İlk Endeks"
                  value={gazIlk || ""}
                  onChange={(e) => setGazIlk(Number(e.target.value))}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-center"
                />
                <input
                  type="number"
                  placeholder="Son Endeks"
                  value={gazSon || ""}
                  onChange={(e) => setGazSon(Number(e.target.value))}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-center"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Birim Fiyat"
                  value={gazBirim || ""}
                  onChange={(e) => setGazBirim(Number(e.target.value))}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-center"
                />
              </div>
              <p className="text-[9px] text-right text-slate-450 font-bold">Maliyet: {gazTutar.toLocaleString('tr-TR')} TL</p>
            </div>

          </div>

          {/* Sum box */}
          <div className="bg-slate-900 text-white rounded-xl p-3.5 space-y-2 border border-slate-800">
            <div className="flex justify-between text-[10px] font-bold text-slate-450 uppercase">
              <span>Hakediş Kesinti Özeti</span>
              <span>{selectedPeriod}</span>
            </div>
            <div className="space-y-1.5 text-[11px] font-semibold text-slate-300">
              <div className="flex justify-between">
                <span>İş Makinesi ({toplamSaat} sa):</span>
                <span>{toplamIsMakinesiKesinti.toLocaleString('tr-TR')} TL</span>
              </div>
              <div className="flex justify-between">
                <span>Enerji Tüketimi (Sayaç):</span>
                <span>{toplamEnerjiKesinti.toLocaleString('tr-TR')} TL</span>
              </div>
              <div className="flex justify-between">
                <span>İSG / Saha Cezaları ({matchingPenalties.length} adet):</span>
                <span>{toplamCezaKesinti.toLocaleString('tr-TR')} TL</span>
              </div>
            </div>
            <div className="border-t border-slate-800 pt-2.5 flex justify-between items-end text-sm font-black text-amber-400">
              <span>HESAPLANAN KESİNTİ:</span>
              <span>{genelToplamKesinti.toLocaleString('tr-TR')} TL</span>
            </div>
          </div>

        </div>

        {/* Footer save */}
        <div className="p-4 border-t bg-slate-50 shrink-0">
          <button
            onClick={handleCreateReport}
            className="w-full bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs py-2.5 rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Sparkles size={14} />
            Kesinti Raporu Üret &amp; Arşivle
          </button>
        </div>

      </div>

      {/* 60% RIGHT PANEL: Archive & Details */}
      <div className="flex-1 bg-white border border-[#e2e8f0] rounded-2xl flex flex-col overflow-hidden shadow-sm min-h-[450px]">
        
        {/* Header */}
        <div className="p-4 border-b border-[#e2e8f0] bg-slate-50/50 flex items-center space-x-2 shrink-0">
          <ClipboardList size={16} className="text-[#0F172A]" />
          <h4 className="font-display font-bold text-xs text-slate-800 uppercase tracking-widest">
            {selectedTaseron} - Kesinti Raporları Arşivi
          </h4>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Active records */}
          {taseronKesintiRaporlari.filter(r => r.taseronFirmaAdi === selectedTaseron).length === 0 ? (
            <div className="h-40 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <ShieldAlert size={28} className="text-slate-300 mb-2" />
              <p className="text-xs font-bold">Arşivlenmiş Kesinti Raporu Bulunmuyor</p>
              <p className="text-[10px] text-slate-400 mt-1">Sol taraftaki hesap motorunu kullanarak bu taşeron için dönem raporu hazırlayabilirsiniz.</p>
            </div>
          ) : (
            taseronKesintiRaporlari.filter(r => r.taseronFirmaAdi === selectedTaseron).map(report => (
              <div key={report.id} className="border border-slate-150/70 hover:border-slate-300 rounded-2xl p-4 bg-white shadow-xs space-y-3.5 text-xs text-slate-700">
                <div className="flex justify-between items-start border-b pb-2.5">
                  <div className="space-y-1">
                    <span className="font-mono bg-slate-900 text-amber-500 rounded px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                      RAPOR: {report.donemAy} {report.donemYil}
                    </span>
                    <h5 className="font-bold text-slate-950 mt-1">{report.taseronFirmaAdi} Kesinti Tutanağı</h5>
                  </div>
                  <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border ${
                    report.onayDurumu === 'GONDERILDI' 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                      : 'bg-amber-50 text-amber-800 border-amber-100'
                  }`}>
                    {report.onayDurumu === 'GONDERILDI' ? 'MERKEZE İLETİLDİ' : 'TASLAK'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 text-[11px] leading-relaxed text-slate-500 font-medium">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Toplam İş Makinesi</p>
                    <p className="font-mono text-slate-900 font-bold mt-0.5">{report.toplamSaat} Saat</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Saatlik Ücret</p>
                    <p className="font-mono text-slate-900 font-bold mt-0.5">{report.saatlikUcret.toLocaleString('tr-TR')} TL</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Kesinti Bedeli</p>
                    <p className="font-mono text-slate-900 font-extrabold mt-0.5 text-rose-600">{report.kesintiTutari.toLocaleString('tr-TR')} TL</p>
                  </div>
                </div>

                {/* Log messages */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-150/50 space-y-1 font-mono text-[9px] text-slate-500">
                  <p>· Hazırlayan: {report.olusturanKullanici}</p>
                  <p>· Düzenleme Tarihi: {report.olusturmaTarihi}</p>
                  {report.epostaGonderildi && <p className="text-emerald-600 font-bold">· Merkeze Gönderildi: {report.gonderimTarihi}</p>}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handlePrintReport(report)}
                    className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Printer size={13} />
                    Onaylı PDF Yazdır
                  </button>
                  {report.onayDurumu === 'TASLAK' && (
                    <button
                      onClick={() => handleSendToCenter(report)}
                      className="flex-1 bg-slate-900 hover:bg-slate-950 text-white py-2 rounded-xl font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                    >
                      <Send size={13} className="text-amber-500" />
                      Merkeze Mail Gönder
                    </button>
                  )}
                </div>

              </div>
            ))
          )}

        </div>

      </div>

    </div>
  );
};

export default TaseronKesintiScreen;
