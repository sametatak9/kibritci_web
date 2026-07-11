const fs = require('fs');
let code = fs.readFileSync('src/components/GuvenlikScreen.tsx', 'utf8');

// 1. Add missing imports
if (!code.includes('html2canvas')) {
  code = code.replace(
    "import React, { useState, useEffect } from 'react';",
    "import React, { useState, useEffect } from 'react';\nimport html2canvas from 'html2canvas';\nimport { jsPDF } from 'jspdf';\nimport { generateGuvenlikReportHtml } from '../lib/guvenlikReportHtml';"
  );
}

// 2. Replace the AI scanner block
const oldUiBlockStart = '<div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-900/40 rounded-2xl p-4 space-y-3 text-xs">';
const oldUiBlockEnd = `                    {aiParseSuccess && (
                      <div className="bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 p-2.5 rounded-xl text-[10.5px] whitespace-pre-line font-medium leading-relaxed font-sans">
                        ✅ {aiParseSuccess}
                      </div>
                    )}
                  </div>`;

const newUiBlock = `<div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 rounded-3xl p-5 space-y-4 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-5 blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 rounded-full bg-blue-300 opacity-10 blur-xl"></div>
                    <div className="flex justify-between items-center relative z-10">
                      <span className="font-extrabold text-white tracking-wide uppercase text-[11px] flex items-center gap-2">
                        <span className="text-xl">🤖</span> YAPAY ZEKA EVRAK OKUYUCU
                      </span>
                      <span className="font-bold text-[9px] bg-white/20 text-white backdrop-blur-sm border border-white/30 px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                        Gemini AI
                      </span>
                    </div>
                    <p className="text-[11px] text-indigo-100 leading-relaxed font-medium relative z-10">
                      Evrakın (Fatura, İrsaliye vb.) fotoğrafını çekin veya yükleyin. Sistem belge türünü, numarasını, firmasını ve içindeki tüm kalemleri <strong className="text-white">saniyeler içinde otomatik</strong> dolduracaktır.
                    </p>
                    <div className="relative border-2 border-dashed border-white/40 rounded-2xl p-5 text-center bg-white/10 hover:bg-white/20 backdrop-blur-md transition-all duration-300 cursor-pointer group z-10">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        capture="environment"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            processSecurityDocumentAi(e.target.files[0]);
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={isAiParsing}
                      />
                      {isAiParsing ? (
                        <div className="flex flex-col items-center justify-center space-y-3 py-2">
                          <div className="animate-spin rounded-full h-8 w-8 border-4 border-white/20 border-t-white"></div>
                          <span className="text-[11px] font-bold text-white animate-pulse tracking-wide">Yapay zeka analiz ediyor, lütfen bekleyin...</span>
                        </div>
                      ) : (
                        <div className="space-y-2 py-1 transform group-hover:scale-105 transition-transform duration-300">
                          <div className="bg-white/20 w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 shadow-inner">
                            <Camera size={24} className="text-white" />
                          </div>
                          <span className="text-[13px] font-bold text-white block">Fotoğraf Çek veya Seç</span>
                          <span className="text-[10px] text-indigo-200 block font-medium">Kamera, PDF, PNG, JPG Desteklenir</span>
                        </div>
                      )}
                    </div>
                    {aiParseError && (
                      <div className="bg-red-500/20 border border-red-500/50 backdrop-blur-sm text-red-100 p-3 rounded-xl text-[11px] font-semibold relative z-10 flex items-start gap-2">
                        <AlertTriangle size={14} className="text-red-300 flex-shrink-0 mt-0.5" />
                        <span>{aiParseError}</span>
                      </div>
                    )}
                    {aiParseSuccess && (
                      <div className="bg-emerald-500/20 border border-emerald-500/50 backdrop-blur-sm text-emerald-50 p-3 rounded-xl text-[11px] whitespace-pre-line font-semibold leading-relaxed relative z-10 flex items-start gap-2">
                        <Check size={14} className="text-emerald-300 flex-shrink-0 mt-0.5" />
                        <span>{aiParseSuccess}</span>
                      </div>
                    )}
                  </div>`;

const startIndex = code.indexOf(oldUiBlockStart);
const endIndex = code.indexOf(oldUiBlockEnd) + oldUiBlockEnd.length;

if (startIndex !== -1 && endIndex !== -1) {
  code = code.substring(0, startIndex) + newUiBlock + code.substring(endIndex);
} else {
  console.log("Could not find UI block to replace.");
}

fs.writeFileSync('src/components/GuvenlikScreen.tsx', code);
console.log('Done');
