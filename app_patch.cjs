const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Imports
content = content.replace(
  "import { Sidebar } from './components/Sidebar';",
  "import { ToastProvider } from './components/ToastProvider';\nimport { CommandPalette } from './components/CommandPalette';\nimport { Sidebar } from './components/Sidebar';"
);

// 2. Alert Override
const useEfxCode = `
  // --- Toast Override ---
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message) => {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message } }));
    };
    return () => { window.alert = originalAlert; };
  }, []);

  const [personeller, setPersoneller]`;
content = content.replace('const [personeller, setPersoneller]', useEfxCode);

// 3. Components injection at the end
const injectCode = `
      {/* İleri Seviye Bileşenler */}
      <ToastProvider />
      <CommandPalette onSelect={(tab) => setActiveTab(tab as any)} />
    </div>
  );
`;
const oldEnd = `
    </div>
  );
}`;
content = content.replace(oldEnd, injectCode + '}');

// 4. Skeleton Loading replacement
const oldLoading = `if (dbStatus === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-8 select-none">
        <div className="w-full max-w-md text-center space-y-8 animate-fade-in">
          <div className="space-y-3">
            <KibritciLogo size="xl" className="mx-auto h-16" />
            <p className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">Bulut ERP Ynetim Altyaps v2.6</p>
          </div>

          <div className="bg-slate-850 p-6 rounded-2xl border border-slate-700/60 shadow-xl space-y-5">
            <div className="flex items-center justify-center space-x-3 text-sm text-amber-400 font-semibold min-h-[24px]">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
              <span>{loadingMsg}</span>
            </div>
            
            {/* Visual sleek layout progress line bar */}
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-700">
              <div className="bg-gradient-to-r from-amber-400 to-amber-600 h-full rounded-full animate-pulse transition-all duration-300 w-full" />
            </div>

            {/* Robust Interactive Timeout Bypass trigger */}
            <div className="pt-2 border-t border-slate-800/80">
              <p className="text-[9px] text-slate-400 italic mb-2">BaYlatma adm ok mu uzun sǬrdǬ? nternet/Sunucu baYlantsn atlayabilirsiniz:</p>
              <button
                type="button"
                onClick={switchToOfflineMode}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-[11px] py-2.5 px-4 rounded-xl transition duration-150 shadow-md flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <span>s BEKLEMEY ATLA (demo verisi yǬklenmez)</span>
              </button>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 italic">
            * GǬvenli Google Cloud Firestore Bulut NoSQL veritaban aktif edilmiYtir. TǬm kullanclar gerek zamanl eY zamanl alYabilir.
          </p>
        </div>
      </div>
    );
  }`;

const newLoading = `if (dbStatus === 'loading') {
    return (
      <div className="flex h-screen bg-slate-50 overflow-hidden select-none">
        {/* Skeleton Sidebar */}
        <div className="hidden lg:flex flex-col w-68 bg-white border-r border-slate-200/60 p-5 space-y-8 animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-slate-200 rounded-xl"></div>
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              <div className="h-2 bg-slate-100 rounded w-1/2"></div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-3 bg-slate-200 rounded w-1/3 mb-4"></div>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-slate-200 rounded-md"></div>
                <div className="h-3 bg-slate-100 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Skeleton Main Area */}
        <div className="flex-1 flex flex-col">
          {/* Topbar */}
          <div className="h-[56px] bg-white border-b border-slate-200/80 px-6 flex items-center justify-between animate-pulse">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-slate-200 rounded-full lg:hidden"></div>
              <div className="h-4 bg-slate-200 rounded w-32"></div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
              <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
            </div>
          </div>

          {/* Content Body */}
          <div className="flex-1 p-6 space-y-6">
            <div className="h-6 bg-slate-200 rounded w-48 mb-8 animate-pulse"></div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1,2,3].map(i => (
                <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 h-32 animate-shimmer"></div>
              ))}
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 h-96 mt-6 p-6 space-y-4 animate-shimmer">
              <div className="h-8 bg-slate-100 rounded w-1/4"></div>
              <div className="space-y-2 mt-8">
                {[1,2,3,4,5].map(j => (
                  <div key={j} className="h-10 bg-slate-50 border border-slate-100 rounded-xl w-full"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Loading overlay text */}
        <div className="fixed bottom-6 right-6 bg-white/80 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg border border-slate-200 flex items-center space-x-3 animate-fade-in-up">
           <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></span>
           <span className="text-xs font-bold text-slate-700">{loadingMsg}</span>
        </div>
      </div>
    );
  }`;

content = content.replace(oldLoading, newLoading);

fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx patched successfully.');
