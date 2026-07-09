const fs = require('fs');

let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

// Add icons
content = content.replace('LogOut,', 'LogOut, Moon, Sun,');

// Add button
const buttonCode = `
        <div className="px-3">
          <button
            onClick={() => document.documentElement.classList.toggle('dark-mode')}
            className="w-full flex items-center justify-center space-x-2 bg-slate-900 hover:bg-black text-white py-2.5 rounded-xl font-bold text-[11px] transition cursor-pointer shadow-sm keep-colors"
          >
            <Moon size={14} />
            <span>Gece Modu</span>
          </button>
        </div>
`;

content = content.replace('<div className="px-3">', buttonCode + '\n          <div className="px-3">');

fs.writeFileSync('src/components/Sidebar.tsx', content);
console.log('Sidebar patched.');
