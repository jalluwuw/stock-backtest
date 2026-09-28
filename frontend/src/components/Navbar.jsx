"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Filter, PlayCircle, Activity } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-800 bg-[#0A0D1A]/90 backdrop-blur sticky top-0 z-40 px-6 py-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-base tracking-wide text-white">IHSG</span>{' '}
            <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-semibold border border-cyan-500/30">
              PRO TERMINAL
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              pathname === '/'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Screener</span>
          </Link>

          <Link
            href="/backtest"
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              pathname?.startsWith('/backtest')
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>Backtest Strategy</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
