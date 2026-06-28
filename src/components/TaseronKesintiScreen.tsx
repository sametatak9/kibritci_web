import React, { useState } from 'react';
import { 
  Building2, HardHat, DollarSign, Wallet, FileText, Send, 
  ChevronRight, ClipboardList, ShieldAlert, Sparkles, RefreshCw, Printer,
  Tent, ArrowRight, CheckCircle2, ShieldCheck, Upload
} from 'lucide-react';
import { CariKart, OperatorFaaliyet, HazirTutanak, TaseronKesintiRaporu } from '../types/erp';
import { saveDocument } from '../lib/firebase';
import { compressImage } from '../lib/imageCompress';

interface TaseronKesintiScreenProps {
  cariKartlar: CariKart[];
  operatorFaaliyetleri: OperatorFaaliyet[];
  setOperatorFaaliyetleri?: React.Dispatch<React.SetStateAction<OperatorFaaliyet[]>>;
  hazirTutanaklar: HazirTutanak[];
  taseronKesintiRaporlari: TaseronKesintiRaporu[];
  setTaseronKesintiRaporlari: React.Dispatch<React.SetStateAction<TaseronKesintiRaporu[]>>;
  addNotification?: (mesaj: string) => void;
  currentUser?: any;
}

export const TaseronKesintiScreen: React.FC<TaseronKesintiScreenProps> = ({
  cariKartlar,
  operatorFaaliyetleri,
  setOperatorFaaliyetleri,
  hazirTutanaklar,
  taseronKesintiRaporlari,
  setTaseronKesintiRaporlari,
  addNotification,
  currentUser
}) => {
  const taseronlar = cariKartlar.filter(c => c.kartTipi === 'TASERON');
  const [selectedTaseron, setSelectedTaseron] = useState<string>(taseronlar[0]?.unvan || "");
  const [selectedPeriod, setSelectedPeriod] = useState("Haziran 2026");
  const [leftTab, setLeftTab] = useState<'is_makinesi' | 'sayac'>('is_makinesi');

  // Work machine hour logger states
  const [logHours, setLogHours] = useState(8);
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logWork, setLogWork] = useState("");
  const [repName, setRepName] = useState("");
  const [repTc, setRepTc] = useState("");
  const [localLogs, setLocalLogs] = useState<Omit<OperatorFaaliyet, 'id'>[]>([]);

  // Meter index states
  const [elekIlk, setElekIlk] = useState(0);
  const [elekSon, setElekSon] = useState(0);
  const [elekBirim, setElekBirim] = useState(3.5);

  const [suIlk, setSuIlk] = useState(0);
  const [suSon, setSuSon] = useState(0);
  const [suBirim, setSuBirim] = useState(12.0);

  const [gazIlk, setGazIlk] = useState(0);
  const [gazSon, setGazSon] = useState(0);
  const [gazBirim, setGazBirim] = useState(8.5);

  const [saatlikUcret, setSaatlikUcret] = useState(1500);

  // Meter math
  const elekFark = Math.max(0, elekSon - elekIlk);
  const elekTutar = elekFark * elekBirim;

  const suFark = Math.max(0, suSon - suIlk);
  const suTutar = suFark * suBirim;

  const gazFark = Math.max(0, gazSon - gazIlk);
  const gazTutar = gazFark * gazBirim;

  const toplamEnerjiKesinti = elekTutar + suTutar + gazTutar;

  // Filter operator activities for selected taseron (APPROVED ONLY)
  const approvedActivities = operatorFaaliyetleri.filter(
    op => op.firmaAdi?.toLowerCase().trim() === selectedTaseron?.toLowerCase().trim() && 
          op.onayDurumu === 'ONAYLANDI'
  );
  const pendingActivities = operatorFaaliyetleri.filter(
    op => op.firmaAdi?.toLowerCase().trim() === selectedTaseron?.toLowerCase().trim() && 
          op.onayDurumu === 'BEKLEMEDE'
  );

  const toplamSaat = approvedActivities.reduce((acc, curr) => acc + (curr.calismaSuresi || 0), 0);
  const toplamIsMakinesiKesinti = toplamSaat * saatlikUcret;

  // Penalties
  const matchingPenalties = hazirTutanaklar.filter(
    t => t.tutanakTipi === 'CEZA' && 
         (t.taseronAdi?.toLowerCase().trim() === selectedTaseron?.toLowerCase().trim() ||
          t.cariKartId === cariKartlar.find(c => c.unvan === selectedTaseron)?.id)
  );
  const toplamCezaKesinti = matchingPenalties.reduce((acc, curr) => acc + (curr.cezaTutari || 0), 0);

  const genelToplamKesinti = toplamEnerjiKesinti + toplamIsMakinesiKesinti + toplamCezaKesinti;

  // Add hourly log to temporary table
  const handleAddLocalLog = () => {
    if (!logWork || logHours <= 0) {
      alert("Lütfen yapılan işi ve çalışma süresini doldurunuz.");
      return;
    }
    const newLog: Omit<OperatorFaaliyet, 'id'> = {
      aracId: "is_makinesi_taseron",
      aracPlaka: "TAŞERON KİRALIK",
      operatorIsim: "Taşeron Ekip Operatörü",
      operatorTipi: 'DİĞER',
      tarih: logDate,
      baslangicSaat: "08:00",
      bitisSaat: "17:00",
      calismaSuresi: logHours,
      yapilanIs: logWork,
      firmaAdi: selectedTaseron,
      temsilciAdSoyad: repName || "Şantiye Yetkilisi",
      temsilciTc: repTc || "00000000000",
      onayDurumu: 'BEKLEMEDE'
    };
    setLocalLogs(prev => [...prev, newLog]);
    setLogWork("");
  };

  // Complete day and send to management
  const handleCompleteDayAndSend = () => {
    if (localLogs.length === 0) {
      alert("Gönderilecek çalışma kaydı bulunmuyor.");
      return;
    }
    if (setOperatorFaaliyetleri) {
      const formatted = localLogs.map((log, idx) => ({
        ...log,
        id: `op_faal_${Date.now()}_${idx}`
      }));
      setOperatorFaaliyetleri(prev => [...formatted, ...prev]);
    }
    setLocalLogs([]);
    alert("İş makinesi faaliyet kayıtları başarıyla sisteme girildi ve yönetici onayına sunuldu!");
  };

  // Simulated manager approval
  const handleApproveActivity = (actId: string) => {
    if (setOperatorFaaliyetleri) {
      setOperatorFaaliyetleri(prev => prev.map(op => {
        if (op.id === actId) {
          return { ...op, onayDurumu: 'ONAYLANDI' };
        }
        return op;
      }));
      alert("Çalışma saati kaydı onaylandı! Hakediş kesintisi hesaplamasına dahil edildi.");
    }
  };

  // Create monthly summary report
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
      faaliyetler: approvedActivities,
      onayDurumu: 'TASLAK',
      olusturanKullanici: currentUser?.email || 'admin',
      olusturmaTarihi: new Date().toISOString().split('T')[0],
      epostaKonusu: `${selectedTaseron} - ${selectedPeriod} Taşeron Hakediş Kesinti Bildirimi`,
      epostaIcerik: `Sayın Yetkili,\n\n${selectedPeriod} dönemine ait ${selectedTaseron} firmasının şantiye hakediş kesinti dökümü aşağıdaki gibidir:\n\n1. İş Makinesi Çalışma Bedeli (${toplamSaat} saat * ${saatlikUcret} TL): ${toplamIsMakinesiKesinti.toLocaleString('tr-TR')} TL\n2. Şantiye Enerji Tüketim Bedeli (Elektrik, Su, Doğalgaz Sayaçları): ${toplamEnerjiKesinti.toLocaleString('tr-TR')} TL\n3. İSG ve Saha Cezaları Toplamı: ${toplamCezaKesinti.toLocaleString('tr-TR')} TL\n\nGENEL TOPLAM KESİNTİ: ${genelToplamKesinti.toLocaleString('tr-TR')} TL\n\nDetaylar sistemde kayıt altına alınmıştır. Raporun onaylı hali ekte sunulmuştur.`,
      eImzalar: []
    };

    setTaseronKesintiRaporlari(prev => [newReport, ...prev]);
    if (addNotification) {
      addNotification(`${selectedTaseron} firması için ${selectedPeriod} dönemi kesinti raporu oluşturuldu.`);
    }
    alert(`${selectedTaseron} firması için ${selectedPeriod} dönemi kesinti raporu başarıyla oluşturuldu!`);
  };

  // Upload signed PDF and complete report
  const handleUploadSignedReport = (e: React.ChangeEvent<HTMLInputElement>, rId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        const compressed = await compressImage(rawBase64);
        setTaseronKesintiRaporlari(prev => prev.map(rep => {
          if (rep.id === rId) {
            return {
              ...rep,
              onayDurumu: 'ONAYLANDI'
            };
          }
          return rep;
        }));
        alert("Fiziksel ıslak imzalı kesinti raporu sisteme yüklendi! Hakediş kesintisi kesinleştirildi.");
      };
      reader.readAsDataURL(file);
    }
  };

  // Simulate e-signature for report
  const handleESignReport = (rId: string) => {
    const selectedEmail = window.prompt(
      "E-İmza ile onaylayacak yetkiliyi giriniz:\n- sametatak9@gmail.com\n- santiye@kibritci.com",
      "sametatak9@gmail.com"
    );

    if (selectedEmail === "sametatak9@gmail.com" || selectedEmail === "santiye@kibritci.com") {
      const name = selectedEmail === "sametatak9@gmail.com" ? "SAMET ATAK" : "ŞANTİYE SORUMLUSU";
      setTaseronKesintiRaporlari(prev => prev.map(rep => {
        if (rep.id === rId) {
          return {
            ...rep,
            onayDurumu: 'ONAYLANDI',
            eImzalar: [...(rep.eImzalar || []), `${name} (${selectedEmail} - E-İmza)`]
          };
        }
        return rep;
      }));
      alert(`Dijital E-İmza onaylandı! (${name}) Rapor onaylandı.`);
    } else {
      alert("Hata: Geçersiz e-imza yetkilisi seçildi.");
    }
  };

  const handleSendToCenter = async (report: TaseronKesintiRaporu) => {
    if (window.confirm(`${report.taseronFirmaAdi} firmasının kesinti raporunu merkeze e-posta ile göndermek istediğinize emin misiniz?`)) {
      const updated = {
        ...report,
        onayDurumu: 'GONDERILDI' as const,
        epostaGonderildi: true,
        gonderimTarihi: new Date().toISOString().split('T')[0]
      };

      setTaseronKesintiRaporlari(prev => prev.map(r => r.id === report.id ? updated : r));
      
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
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1e293b; line-height: 1.5; }
            .corporate-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 25px; }
            .logo { font-weight: 900; font-size: 22px; color: #1e3a8a; display: flex; align-items: center; gap: 8px; }
            .logo svg { fill: #1e3a8a; }
            .title-area { text-align: right; }
            .title-area h2 { margin: 0; font-size: 16px; color: #0f172a; }
            .title-area p { margin: 2px 0 0 0; font-size: 10px; font-weight: bold; color: #64748b; }
            .summary-table { width: 100%; border-collapse: collapse; margin-top: 15px; border-radius: 8px; overflow: hidden; }
            .summary-table th { background-color: #1e3a8a; color: white; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
            .summary-table td { border-bottom: 1px solid #e2e8f0; padding: 10px; font-size: 11px; font-weight: 500; }
            .total-row { font-weight: bold; background-color: #f8fafc; font-size: 12px; }
            .signatures-title { margin-top: 40px; font-size: 11px; font-weight: bold; color: #1e3a8a; border-bottom: 2px dashed #cbd5e1; padding-bottom: 5px; text-transform: uppercase; }
            .signatures-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 15px; }
            .sig-col { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; font-size: 10px; min-height: 80px; display: flex; flex-direction: column; justify-content: space-between; background: #fff; }
            .e-imza-bar { margin-top: 20px; font-size: 9px; color: #059669; font-weight: bold; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 8px; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="corporate-header">
            <div class="logo">
              <svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 3.5L18.5 19H5.5L12 5.5z"/></svg>
              KİBRİTÇİ İNŞAAT A.Ş.
            </div>
            <div class="title-area">
              <h2>TAŞERON HAKEDİŞ KESİNTİ PROTOKOLÜ</h2>
              <p>DÖNEM: ${report.donemAy} ${report.donemYil}</p>
            </div>
          </div>

          <p style="font-size: 11px; font-weight: 550;">İşbu protokol, şantiyede faaliyet gösteren aşağıda ünvanı yazılı taşeron firmanın aylık hak edişinden kesilecek tutarların resmi dökümüdür.</p>

          <table class="summary-table">
            <thead>
              <tr>
                <th>Kesinti Kalemi / Açıklama</th>
                <th style="text-align: right;">Birim / Miktar</th>
                <th style="text-align: right;">Birim Fiyat</th>
                <th style="text-align: right;">Toplam Tutar</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>İş Makinesi Çalışma Bedeli (Operatör Föyleri)</td>
                <td style="text-align: right;">${report.toplamSaat} Saat</td>
                <td style="text-align: right;">${report.saatlikUcret.toLocaleString('tr-TR')} TL</td>
                <td style="text-align: right;">${(report.toplamSaat * report.saatlikUcret).toLocaleString('tr-TR')} TL</td>
              </tr>
              <tr class="total-row">
                <td colspan="3">GENEL KESİNTİ TOPLAMI (HAKEDİŞTEN DÜŞÜLECEK)</td>
                <td style="text-align: right; color:#b91c1c;">${report.kesintiTutari.toLocaleString('tr-TR')} TL</td>
              </tr>
            </tbody>
          </table>

          <div class="signatures-title">🖋️ YETKİLİ ONAY VE PROTOKOL İMZA KANALLARI</div>
          <div class="signatures-grid">
            <div class="sig-col">
              <span style="font-weight:bold; color:#475569;">Hazırlayan / Şantiye Şefi</span>
              <span style="font-weight:bold; margin-top:10px;">${currentUser?.email ? currentUser.email.split('@')[0].toUpperCase() : 'ŞANTİYE'}</span>
            </div>
            <div class="sig-col">
              <span style="font-weight:bold; color:#475569;">Proje Müdürü</span>
              <span style="color:#10b981; font-weight:850; margin-top:10px;">✓ ONAYLI</span>
            </div>
            <div class="sig-col">
              <span style="font-weight:bold; color:#475569;">Taşeron Firma Yetkilisi</span>
              <span style="color:#94a3b8; font-style:italic;">Fiili İmza / Islak Kaşe</span>
            </div>
          </div>

          ${report.eImzalar && report.eImzalar.length > 0 ? `
            <div class="e-imza-bar">
              🛡️ DİJİTAL E-İMZA KANIT ZİNCİRİ:<br/>
              ${report.eImzalar.map(im => `• ${im}`).join('<br/>')}
            </div>
          ` : ''}
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
      
      {/* 40% LEFT PANEL: selector & logs entry */}
      <div className="w-full lg:w-[440px] shrink-0 bg-white border border-[#e2e8f0] rounded-2xl flex flex-col overflow-hidden shadow-sm">
        
        {/* Header selection */}
        <div className="bg-[#0F172A] text-slate-100 p-4 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-widest text-amber-500 uppercase">Hakediş Kesinti Sistemi</span>
            <span className="text-[9px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full font-bold text-amber-400">Sayaç ve Çalışmalar</span>
          </div>
          
          <div className="space-y-2">
            <select
              value={selectedTaseron}
              onChange={(e) => setSelectedTaseron(e.target.value)}
              className="w-full text-xs font-bold p-2 bg-slate-800 text-slate-100 border border-slate-700 rounded-lg outline-none"
            >
              {taseronlar.length === 0 ? (
                <option value="">Kayıtlı Taşeron Bulunmuyor</option>
              ) : (
                taseronlar.map(t => <option key={t.id} value={t.unvan}>{t.unvan}</option>)
              )}
            </select>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full p-2 bg-slate-800 text-slate-100 border border-slate-700 rounded-lg outline-none font-bold"
              >
                <option value="Haziran 2026">Haziran 2026</option>
                <option value="Temmuz 2026">Temmuz 2026</option>
                <option value="Ağustos 2026">Ağustos 2026</option>
              </select>
              <input
                type="number"
                value={saatlikUcret}
                onChange={(e) => setSaatlikUcret(Number(e.target.value))}
                placeholder="Saatlik Makine Bedeli"
                className="w-full p-2 bg-slate-800 text-slate-100 border border-slate-700 rounded-lg outline-none font-mono font-bold text-center"
              />
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="bg-slate-50 border-b flex font-bold text-[11px] text-slate-650">
          <button
            onClick={() => setLeftTab('is_makinesi')}
            className={`flex-1 py-2.5 text-center transition ${leftTab === 'is_makinesi' ? 'bg-white border-b-2 border-slate-900 text-slate-900' : 'hover:bg-slate-100/50'}`}
          >
            🚜 İş Makinesi Çalışmaları
          </button>
          <button
            onClick={() => setLeftTab('sayac')}
            className={`flex-1 py-2.5 text-center transition ${leftTab === 'sayac' ? 'bg-white border-b-2 border-slate-900 text-slate-900' : 'hover:bg-slate-100/50'}`}
          >
            🔌 Aylık Sayaç Girişleri
          </button>
        </div>

        {/* Forms content */}
        <div className="flex-grow p-4 space-y-4 overflow-y-auto text-xs text-slate-700">
          
          {leftTab === 'is_makinesi' && (
            <div className="space-y-4">
              <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-2xl space-y-2">
                <span className="text-[9px] font-extrabold text-amber-800 uppercase block tracking-wider">🚜 YENİ İŞ MAKİNESİ FAALİYET FİŞİ</span>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Tarih</label>
                    <input 
                      type="date"
                      value={logDate}
                      onChange={(e) => setLogDate(e.target.value)}
                      className="w-full p-1.5 border rounded-lg bg-white mt-0.5 text-[10px]"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Çalışma Süresi (Saat)</label>
                    <input 
                      type="number"
                      value={logHours}
                      onChange={(e) => setLogHours(Number(e.target.value))}
                      className="w-full p-1.5 border rounded-lg bg-white mt-0.5 text-[10px] text-center font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Firma Yetkilisi T.C.</label>
                    <input 
                      type="text"
                      placeholder="TC No"
                      value={repTc}
                      onChange={(e) => setRepTc(e.target.value)}
                      className="w-full p-1.5 border rounded-lg bg-white mt-0.5 text-[10px]"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Firma Yetkilisi Adı</label>
                    <input 
                      type="text"
                      placeholder="Adı Soyadı"
                      value={repName}
                      onChange={(e) => setRepName(e.target.value)}
                      className="w-full p-1.5 border rounded-lg bg-white mt-0.5 text-[10px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Yapılan İş Açıklaması</label>
                  <input 
                    type="text"
                    placeholder="Örn: Blok A Temel Kazısı"
                    value={logWork}
                    onChange={(e) => setLogWork(e.target.value)}
                    className="w-full p-1.5 border rounded-lg bg-white mt-0.5 text-[10px]"
                  />
                </div>

                <button
                  onClick={handleAddLocalLog}
                  className="w-full bg-slate-900 text-white font-bold py-1.5 rounded-lg hover:bg-slate-950 transition text-[10px]"
                >
                  Giriş Listesine Ekle
                </button>
              </div>

              {localLogs.length > 0 && (
                <div className="border border-dashed border-slate-200 p-3 rounded-2xl space-y-2">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Günü Tamamlamayan Fişler ({localLogs.length})</span>
                  <div className="space-y-1 max-h-32 overflow-y-auto text-[10px] font-semibold text-slate-650">
                    {localLogs.map((log, idx) => (
                      <div key={idx} className="flex justify-between bg-white border p-2 rounded-lg">
                        <span>{log.tarih} · {log.yapilanIs}</span>
                        <span className="font-mono text-slate-900">{log.calismaSuresi} Sa</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleCompleteDayAndSend}
                    className="w-full bg-[#10b981] text-white font-bold py-2 rounded-xl text-[10px]"
                  >
                    Günü Tamamla ve Yönetime Yolla
                  </button>
                </div>
              )}

              {/* Pending reviews */}
              {pendingActivities.length > 0 && (
                <div className="border border-slate-150 p-3 rounded-2xl bg-rose-50/20 space-y-2">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">⏳ Yönetim Onayı Bekleyen Saatler ({pendingActivities.length})</span>
                  <div className="space-y-2 max-h-44 overflow-y-auto">
                    {pendingActivities.map((act) => (
                      <div key={act.id} className="bg-white p-2.5 rounded-xl border border-slate-200 flex justify-between items-center text-[10px]">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900">{act.tarih} · {act.yapilanIs}</p>
                          <p className="text-slate-450 font-semibold">Yetkili: {act.temsilciAdSoyad} ({act.calismaSuresi} Saat)</p>
                        </div>
                        <button
                          onClick={() => handleApproveActivity(act.id)}
                          className="bg-slate-900 hover:bg-slate-950 text-white font-bold px-2.5 py-1.5 rounded-lg text-[9px]"
                        >
                          Onayla
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {leftTab === 'sayac' && (
            <div className="space-y-4">
              <span className="text-[9px] font-extrabold text-slate-450 uppercase tracking-widest block">🔌 ŞANTİYE ENERJİ SAYAÇ ENDEKS FARKLARI</span>
              
              {/* Electricity */}
              <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-150 space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-blue-700">
                  <span>⚡ ELEKTRİK SAYACI</span>
                  <span>Fark: {elekFark} kWh</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    placeholder="İlk Okuma"
                    value={elekIlk || ""}
                    onChange={(e) => setElekIlk(Number(e.target.value))}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-center"
                  />
                  <input
                    type="number"
                    placeholder="Son Okuma"
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
                <p className="text-[9px] text-right font-black text-slate-500">Hesaplanan Maliyet: {elekTutar.toLocaleString('tr-TR')} TL</p>
              </div>

              {/* Water */}
              <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-150 space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-cyan-700">
                  <span>💧 SU SAYACI</span>
                  <span>Fark: {suFark} m³</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    placeholder="İlk Okuma"
                    value={suIlk || ""}
                    onChange={(e) => setSuIlk(Number(e.target.value))}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-center"
                  />
                  <input
                    type="number"
                    placeholder="Son Okuma"
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
                <p className="text-[9px] text-right font-black text-slate-500">Hesaplanan Maliyet: {suTutar.toLocaleString('tr-TR')} TL</p>
              </div>

              {/* Gas */}
              <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-150 space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-orange-700">
                  <span>🔥 DOĞALGAZ SAYACI</span>
                  <span>Fark: {gazFark} m³</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    placeholder="İlk Okuma"
                    value={gazIlk || ""}
                    onChange={(e) => setGazIlk(Number(e.target.value))}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-center"
                  />
                  <input
                    type="number"
                    placeholder="Son Okuma"
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
                <p className="text-[9px] text-right font-black text-slate-500">Hesaplanan Maliyet: {gazTutar.toLocaleString('tr-TR')} TL</p>
              </div>
            </div>
          )}

          {/* Aggregated values summary */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3.5 border border-slate-800">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-450 border-b border-slate-800 pb-2">
              <span>Konsolide Kesinti Özeti</span>
              <span>{selectedPeriod}</span>
            </div>
            <div className="space-y-1.5 font-semibold text-[11px] text-slate-300">
              <div className="flex justify-between">
                <span>İş Makinesi Çalışmaları ({toplamSaat} Saat):</span>
                <span className="font-mono">{toplamIsMakinesiKesinti.toLocaleString('tr-TR')} TL</span>
              </div>
              <div className="flex justify-between">
                <span>Sayaç Tüketimleri (Elektrik, Su, Gaz):</span>
                <span className="font-mono">{toplamEnerjiKesinti.toLocaleString('tr-TR')} TL</span>
              </div>
              <div className="flex justify-between">
                <span>Saha Cezaları / İSG İhtarları:</span>
                <span className="font-mono">{toplamCezaKesinti.toLocaleString('tr-TR')} TL</span>
              </div>
            </div>
            <div className="border-t border-slate-800 pt-2.5 flex justify-between items-end text-sm font-black text-amber-400">
              <span>GENEL KESİNTİ TOPLAMI:</span>
              <span className="font-mono">{genelToplamKesinti.toLocaleString('tr-TR')} TL</span>
            </div>
          </div>

        </div>

        {/* Create Summary report */}
        <div className="p-4 border-t bg-slate-50 shrink-0">
          <button
            onClick={handleCreateReport}
            className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-bold text-xs py-2.5 rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Sparkles size={14} />
            Kesinti Raporu Oluştur &amp; Arşivle
          </button>
        </div>

      </div>

      {/* 60% RIGHT PANEL: Report archive & details */}
      <div className="flex-grow bg-white border border-slate-200 rounded-3xl flex flex-col overflow-hidden shadow-xs min-h-[480px]">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center space-x-2 shrink-0">
          <ClipboardList size={16} className="text-[#0F172A]" />
          <h4 className="font-display font-bold text-xs text-slate-800 uppercase tracking-widest">
            {selectedTaseron} - Kesinti Raporları Arşivi
          </h4>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {taseronKesintiRaporlari.filter(r => r.taseronFirmaAdi === selectedTaseron).length === 0 ? (
            <div className="h-40 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <ShieldAlert size={28} className="text-slate-300 mb-2" />
              <p className="text-xs font-bold">Arşivlenmiş Kesinti Raporu Bulunmuyor</p>
              <p className="text-[10px] text-slate-400 mt-1">Sol taraftaki hesap motorunu kullanarak bu taşeron için dönem raporu hazırlayabilirsiniz.</p>
            </div>
          ) : (
            taseronKesintiRaporlari.filter(r => r.taseronFirmaAdi === selectedTaseron).map(report => (
              <div key={report.id} className="border border-slate-150 rounded-2xl p-4 bg-white shadow-xs space-y-3 text-xs text-slate-700">
                
                <div className="flex justify-between items-start border-b pb-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono bg-slate-900 text-amber-500 rounded px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                        RAPOR: {report.donemAy} {report.donemYil}
                      </span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase ${
                        report.onayDurumu === 'GONDERILDI'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                          : report.onayDurumu === 'ONAYLANDI'
                            ? 'bg-blue-50 text-blue-800 border-blue-100'
                            : 'bg-amber-50 text-amber-800 border-amber-100'
                      }`}>
                        {report.onayDurumu === 'GONDERILDI' ? 'MERKEZE GÖNDERİLDİ' : report.onayDurumu === 'ONAYLANDI' ? 'ONAYLANDI (KİLİTLİ)' : 'ONAY BEKLİYOR'}
                      </span>
                    </div>
                    <h5 className="font-bold text-slate-950 mt-1">{report.taseronFirmaAdi} Kesinti Tutanağı</h5>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-[10px] font-semibold text-slate-500">
                  <div>
                    <p className="text-[8px] text-slate-400 uppercase">Onaylı Çalışma</p>
                    <p className="text-slate-900 font-mono font-bold">{report.toplamSaat} Saat</p>
                  </div>
                  <div>
                    <p className="text-[8px] text-slate-400 uppercase">Saatlik Ücret</p>
                    <p className="text-slate-900 font-mono font-bold">{report.saatlikUcret.toLocaleString('tr-TR')} TL</p>
                  </div>
                  <div>
                    <p className="text-[8px] text-slate-400 uppercase">Kesinti Bedeli</p>
                    <p className="text-rose-600 font-mono font-extrabold">{report.kesintiTutari.toLocaleString('tr-TR')} TL</p>
                  </div>
                  <div>
                    <p className="text-[8px] text-slate-400 uppercase">Oluşturan</p>
                    <p className="text-slate-900 font-bold">{report.olusturanKullanici}</p>
                  </div>
                </div>

                {report.eImzalar && report.eImzalar.length > 0 && (
                  <div className="bg-emerald-50/50 p-2 rounded-xl text-[9px] text-emerald-800 border border-emerald-100">
                    ✍️ E-İmzalayan Yetkililer: {report.eImzalar.join(', ')}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-1.5 text-[10px]">
                  <button
                    onClick={() => handlePrintReport(report)}
                    className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Printer size={13} />
                    Onaylı PDF Yazdır
                  </button>

                  {report.onayDurumu === 'TASLAK' && (
                    <>
                      <button
                        onClick={() => handleESignReport(report.id)}
                        className="bg-indigo-600 hover:bg-indigo-750 text-white px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <ShieldCheck size={13} />
                        E-İmza ile Onayla
                      </button>

                      <label className="cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-250 px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1">
                        <Upload size={13} />
                        İmzalı Rapor Yükle
                        <input 
                          type="file" 
                          onChange={(e) => handleUploadSignedReport(e, report.id)} 
                          className="hidden" 
                          accept="image/*,application/pdf" 
                        />
                      </label>
                    </>
                  )}

                  {(report.onayDurumu === 'ONAYLANDI' || report.onayDurumu === 'GONDERILDI') && (
                    <button
                      onClick={() => handleSendToCenter(report)}
                      disabled={report.onayDurumu === 'GONDERILDI'}
                      className="bg-slate-900 hover:bg-slate-950 text-white px-4 py-1.5 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      <Send size={13} className={report.onayDurumu === 'GONDERILDI' ? 'text-slate-400' : 'text-amber-500'} />
                      {report.onayDurumu === 'GONDERILDI' ? "Merkeze Gönderildi" : "E-posta ile Merkeze Gönder"}
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
