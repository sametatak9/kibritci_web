const fs = require('fs');
const path = './src/components/DashboardScreen.tsx';

let content = fs.readFileSync(path, 'utf8');

// 1. Update Kadro Logic
const oldKadroLogic = `  const totalPersonel = personeller.length;
  const activePersonelCount = personeller.filter(p => p.durum === true || String(p.durum) === 'true').length;`;

const newKadroLogic = `  const totalPersonel = personeller.length;
  const activeAnaFirmaCount = personeller.filter(p => (p.durum === true || String(p.durum) === 'true') && p.firmaTipi !== 'TASERON').length;
  const activeTaseronCount = personeller.filter(p => (p.durum === true || String(p.durum) === 'true') && p.firmaTipi === 'TASERON').length;
  const activePersonelCount = activeAnaFirmaCount + activeTaseronCount;`;

content = content.replace(oldKadroLogic, newKadroLogic);

// 2. Update Stats Array (Glassmorphic)
const oldStats = `  const stats = [
    {
      title: "Aktif Kadro (Personel)",
      value: \`\${activePersonelCount} / \${totalPersonel}\`,
      color: "text-slate-800",
      bg: "bg-slate-50/70 border-slate-200",
      icon: Users,
      trend: "Canlı Şantiye Kadrosu",
      trendColor: "text-emerald-600"
    },
    {
      title: "Lojman Doluluk Oranı",
      value: \`%\${fillRatio}\`,
      color: "text-emerald-600",
      bg: "bg-emerald-50/70 border-emerald-100",
      icon: Compass,
      trend: \`\${occupiedBeds} / \${totalBeds} Yatak Dolu\`,
      trendColor: "text-emerald-700"
    },
    {
      title: "Puantaj Katılım Oranı",
      value: \`%\${attendanceRate}\`,
      color: "text-[#8B1E1E]",
      bg: "bg-rose-50/70 border-rose-100",
      icon: CalendarCheck2,
      trend: "Aylık Ortalama Katılım",
      trendColor: "text-rose-700"
    },
    {
      title: "Bekleyen Onay Talepleri",
      value: \`\${totalPendingApprovals} Adet\`,
      color: "text-amber-600",
      bg: "bg-amber-50/70 border-amber-100",
      icon: ClipboardList,
      trend: "Yönetici Kararı Bekleyen",
      trendColor: "text-amber-600"
    }
  ];`;

const newStats = `  const stats = [
    {
      title: "Aktif Kadro (Personel)",
      value: \`\${activePersonelCount} / \${totalPersonel}\`,
      color: "text-white",
      bg: "bg-white/10 border-white/20 backdrop-blur-md",
      icon: Users,
      trend: \`\${activeAnaFirmaCount} Ana Firma / \${activeTaseronCount} Taşeron\`,
      trendColor: "text-emerald-400"
    },
    {
      title: "Lojman Doluluk Oranı",
      value: \`%\${fillRatio}\`,
      color: "text-white",
      bg: "bg-white/10 border-white/20 backdrop-blur-md",
      icon: Compass,
      trend: \`\${occupiedBeds} / \${totalBeds} Yatak Dolu\`,
      trendColor: "text-emerald-400"
    },
    {
      title: "Puantaj Katılım Oranı",
      value: \`%\${attendanceRate}\`,
      color: "text-white",
      bg: "bg-white/10 border-white/20 backdrop-blur-md",
      icon: CalendarCheck2,
      trend: "Aylık Ortalama Katılım",
      trendColor: "text-teal-400"
    },
    {
      title: "Bekleyen Onay Talepleri",
      value: \`\${totalPendingApprovals} Adet\`,
      color: "text-white",
      bg: "bg-white/10 border-white/20 backdrop-blur-md",
      icon: ClipboardList,
      trend: "Yönetici Kararı Bekleyen",
      trendColor: "text-amber-400"
    }
  ];`;

content = content.replace(oldStats, newStats);

// 3. Update Root Div and Welcome Banner (Glass & Aurora)
const oldRootStart = `  return (
    <div className="flex-grow p-6 space-y-6 overflow-y-auto h-full font-sans bg-slate-50">
      
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 text-white rounded-3xl p-6 shadow-md relative overflow-hidden border border-slate-800 gap-4">
        <div className="absolute right-0 top-0 w-64 h-64 bg-slate-800 rounded-full mix-blend-multiply filter blur-xl opacity-30 -translate-y-20 translate-x-10" />
        <div className="absolute right-10 bottom-0 w-48 h-48 bg-[#1E4E78] rounded-full mix-blend-multiply filter blur-2xl opacity-15 translate-y-10" />
        
        <div className="relative z-10 space-y-2 flex items-center space-x-4">
          <KibritciLogo size="lg" className="mr-2" />
          <div className="space-y-1">
            <span className="bg-[#1E4E78]/25 text-slate-500 text-[10px] font-bold tracking-widest px-2.5 py-0.5 rounded-full border border-[#1E4E78]/30 uppercase block w-fit">
              BULUT YÖNETSEL ÖZET PANELİ
            </span>
            <h2 className="font-display font-black text-xl tracking-tight text-white">
              Şantiye Kontrol &amp; Raporlama Merkezi
            </h2>
            <p className="text-[11px] text-slate-350 font-sans tracking-tight max-w-lg leading-relaxed">
              Google Cloud Firestore NoSQL canlı veritabanı aktif durumdadır. Personel, puantaj, satın alma talepleri ve hakediş harcamaları anlık senkronizedir.
            </p>
          </div>
        </div>
        
        <div className="relative z-10 flex space-x-2 shrink-0">
          <button 
            onClick={() => onNavigate("satin_alma")} 
            className="bg-gradient-to-r from-[#1E4E78] to-[#B91C1C] hover:from-[#153a5c] hover:to-[#991b1b] active:scale-95 text-white font-bold text-[11px] px-4 py-2.5 rounded-xl transition shadow-md cursor-pointer"
          >
            + Yeni Satın Alma Talebi
          </button>
          <button 
            onClick={() => onNavigate("personel")} 
            className="bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 font-semibold text-[11px] px-4 py-2.5 rounded-xl transition shadow-md cursor-pointer"
          >
            Personel Düzenle
          </button>
        </div>
      </div>`;

const newRootStart = `  return (
    <div className="flex-grow p-6 overflow-y-auto h-full font-sans bg-slate-950 text-slate-200 relative scrollbar-none">
      
      {/* 🔮 AURORA BACKGROUND EFFECTS 🔮 */}
      <div className="absolute top-0 left-0 w-full h-[800px] overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-900/30 mix-blend-screen filter blur-[120px]" />
        <div className="absolute top-[10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-900/20 mix-blend-screen filter blur-[140px]" />
        <div className="absolute top-[40%] left-[20%] w-[40%] h-[40%] rounded-full bg-purple-900/20 mix-blend-screen filter blur-[130px]" />
      </div>

      <div className="relative z-10 space-y-6">

      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden gap-4 group hover:bg-white/10 transition-all duration-500">
        <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full mix-blend-screen filter blur-3xl opacity-50 group-hover:opacity-80 transition-opacity duration-700 -translate-y-20 translate-x-10" />
        
        <div className="relative z-10 flex items-center space-x-5">
          <div className="p-3 bg-white/10 rounded-2xl border border-white/10 shadow-inner backdrop-blur-lg">
            <KibritciLogo size="lg" />
          </div>
          <div className="space-y-1.5">
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold tracking-widest px-3 py-1 rounded-full border border-emerald-500/30 uppercase block w-fit shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              VİZYONER YÖNETİM PANELİ
            </span>
            <h2 className="font-display font-black text-2xl tracking-tight text-white drop-shadow-md">
              Şantiye Kontrol &amp; Raporlama Merkezi
            </h2>
            <p className="text-[12px] text-slate-300 font-sans tracking-wide max-w-lg leading-relaxed">
              Kibritçi Yapı "Glass & Aurora" arayüzüne hoş geldiniz. Anlık personel, lojistik ve finansal verileriniz uçtan uca şifreli olarak ekranınızda.
            </p>
          </div>
        </div>
        
        <div className="relative z-10 flex space-x-3 shrink-0">
          <button 
            onClick={() => onNavigate("satin_alma")} 
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-95 text-white font-bold text-[12px] px-5 py-3 rounded-2xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer"
          >
            + Yeni Satın Alma Talebi
          </button>
          <button 
            onClick={() => onNavigate("personel")} 
            className="bg-white/10 hover:bg-white/20 backdrop-blur-md active:scale-95 text-white border border-white/20 font-semibold text-[12px] px-5 py-3 rounded-2xl transition-all shadow-lg cursor-pointer"
          >
            Personel Düzenle
          </button>
        </div>
      </div>`;

content = content.replace(oldRootStart, newRootStart);

// 4. Update KPI Cards Row Mapping
const oldKpiMap = `      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((st, i) => {
          const Icon = st.icon;
          return (
            <div key={i} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition duration-200">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    {st.title}
                  </span>
                  <span className={\`text-2xl font-black font-mono tracking-tight \${st.color}\`}>
                    {st.value}
                  </span>
                </div>
                <div className={\`p-2 rounded-xl border \${st.bg} flex items-center justify-center shrink-0\`}>
                  <Icon size={18} className={\`\${st.color}\`} />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Canlı Durum:</span>
                <span className={\`font-semibold \${st.trendColor}\`}>{st.trend}</span>
              </div>
            </div>
          );
        })}
      </div>`;

const newKpiMap = `      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((st, i) => {
          const Icon = st.icon;
          return (
            <div key={i} className={\`p-5 rounded-3xl border border-white/10 shadow-xl flex flex-col justify-between hover:-translate-y-1 transition-all duration-300 \${st.bg}\`}>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block drop-shadow-sm">
                    {st.title}
                  </span>
                  <span className={\`text-3xl font-black font-mono tracking-tight \${st.color} drop-shadow-lg\`}>
                    {st.value}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-white/10 border border-white/20 shadow-inner flex items-center justify-center shrink-0">
                  <Icon size={20} className="text-white" />
                </div>
              </div>
              <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Durum:</span>
                <span className={\`font-bold \${st.trendColor} drop-shadow-md\`}>{st.trend}</span>
              </div>
            </div>
          );
        })}
      </div>`;

content = content.replace(oldKpiMap, newKpiMap);

// 5. Update UI background of the remaining white cards to glassmorphism
// Using regex to replace "bg-white border border-slate-200" with "bg-white/5 backdrop-blur-xl border border-white/10 text-slate-200" globally.
content = content.replace(/bg-white border border-slate-200/g, 'bg-white/5 backdrop-blur-xl border border-white/10 text-slate-200');
content = content.replace(/bg-white border rounded-2xl/g, 'bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl text-slate-200');

// Fix specific text colors globally for dark mode
content = content.replace(/text-slate-800/g, 'text-white');
content = content.replace(/text-slate-700/g, 'text-slate-200');
content = content.replace(/text-slate-500/g, 'text-slate-400');
content = content.replace(/text-slate-900/g, 'text-white');
content = content.replace(/text-rose-700/g, 'text-rose-400');
content = content.replace(/text-emerald-700/g, 'text-emerald-400');
content = content.replace(/text-amber-700/g, 'text-amber-400');

// Fix border colors
content = content.replace(/border-slate-100/g, 'border-white/10');
content = content.replace(/border-slate-50/g, 'border-white/5');

// Update the Kadro Aktivasyon Durumu UI to show Ana Firma / Taseron
const oldKadroProgress = `          <div>
            <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1.5">
              <span>Aktif Çalışanlar</span>
              <span className="text-white">{activePersonelCount} / {totalPersonel} Kişi</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-white/10">
              <div 
                className="bg-gradient-to-r from-[#1E4E78] to-blue-600 h-full rounded-full transition-all duration-1000 ease-out" 
                style={{ width: \`\${totalPersonel > 0 ? Math.round((activePersonelCount / totalPersonel) * 100) : 0}%\` }} 
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Sisteme kayıtlı toplam personel ile şu anda aktif çalışan personelin oranını gösterir.
          </p>`;

const newKadroProgress = `          <div>
            <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1.5">
              <span>Ana Firma / Taşeron</span>
              <span className="text-white">{activeAnaFirmaCount} Ana / {activeTaseronCount} Taşeron</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden border border-white/10 flex">
              <div 
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-1000 ease-out" 
                style={{ width: \`\${activePersonelCount > 0 ? (activeAnaFirmaCount / activePersonelCount) * 100 : 0}%\` }} 
                title="Ana Firma"
              />
              <div 
                className="bg-gradient-to-r from-amber-400 to-orange-500 h-full transition-all duration-1000 ease-out" 
                style={{ width: \`\${activePersonelCount > 0 ? (activeTaseronCount / activePersonelCount) * 100 : 0}%\` }} 
                title="Taşeron"
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed mt-2">
            Sahada fiili olarak bulunan Ana Firma personeli ile Taşeron personelinin dağılımını ifade eder.
          </p>`;

content = content.replace(oldKadroProgress, newKadroProgress);

// Fix bg-slate-50 for dark mode background contrasts inside cards
content = content.replace(/bg-slate-50/g, 'bg-white/5');

// Make sure to add the closing div for the new relative z-10 space-y-6 wrapper
const oldClosing = `    </div>
  );
};`;
const newClosing = `      </div>
    </div>
  );
};`;
content = content.replace(oldClosing, newClosing);

fs.writeFileSync(path, content, 'utf8');
console.log("DashboardScreen.tsx successfully patched with Glass & Aurora theme and Kadro Logic.");
