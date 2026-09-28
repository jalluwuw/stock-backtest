import React from 'react';
import { Wifi, WifiOff, RefreshCw, Clock, Radio, Zap, Send } from 'lucide-react';

function formatCountdown(seconds) {
  if (seconds === null || seconds === undefined) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTime(date) {
  if (!date) return '--';
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function LiveStatusBar({
  syncStatus,
  lastUpdated,
  secondsToNext,
  autoRefresh,
  setAutoRefresh,
  onRefreshNow,
  onOpenTelegram,
}) {
  const isConnected = !!syncStatus;
  const isSyncing   = syncStatus?.status === 'syncing';

  return (
    <div className="bg-[#12182E] rounded-2xl border border-slate-800/80 px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 shadow-lg">

      {/* Live Badge */}
      <div className="flex items-center gap-2">
        {isConnected ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Live</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Offline</span>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-slate-700 hidden sm:block" />

      {/* Terakhir update */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Update: <span className="text-slate-200 font-mono">{formatTime(lastUpdated)}</span></span>
      </div>

      {/* Countdown to next refresh */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <RefreshCw className={`w-3.5 h-3.5 flex-shrink-0 ${isSyncing ? 'animate-spin text-cyan-400' : ''}`} />
        {isSyncing ? (
          <span className="text-cyan-400 font-semibold animate-pulse">
            Syncing {syncStatus?.progress && syncStatus.progress !== '0/0' ? `(${syncStatus.progress})` : 'data…'}
          </span>
        ) : autoRefresh ? (
          <span>
            Refresh dalam:{' '}
            <span className="text-cyan-400 font-mono font-bold">{formatCountdown(secondsToNext)}</span>
          </span>
        ) : (
          <span className="text-slate-500">Auto-refresh OFF</span>
        )}
      </div>

      {/* Jumlah ticker */}
      {syncStatus?.total_tickers && (
        <>
          <div className="h-4 w-px bg-slate-700 hidden sm:block" />
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Radio className="w-3.5 h-3.5 flex-shrink-0" />
            <span><span className="text-slate-200 font-mono font-bold">{syncStatus.total_tickers}</span> ticker dipantau</span>
          </div>
        </>
      )}

      {/* Kanan: Refresh Now + Auto-refresh toggle */}
      <div className="ml-auto flex items-center gap-3">

        {/* Tombol Telegram Alerts */}
        <button
          onClick={onOpenTelegram}
          title="Pengaturan Notifikasi Telegram Bot"
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600/20 border border-blue-500/40 hover:bg-blue-600/35 active:scale-95 transition-all text-xs text-blue-400 font-semibold shadow-sm"
        >
          <Send className="w-3.5 h-3.5 -rotate-45" />
          <span>Telegram</span>
        </button>

        {/* Tombol Refresh Now */}
        {onRefreshNow && (
          <button
            onClick={onRefreshNow}
            title="Refresh sekarang"
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-600/20 border border-cyan-600/40 hover:bg-cyan-600/40 active:scale-95 transition-all text-xs text-cyan-400 font-semibold"
          >
            <Zap className="w-3.5 h-3.5" />
            Refresh Now
          </button>
        )}


        {/* Toggle Auto-refresh */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Auto</span>
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
              autoRefresh ? 'bg-cyan-600' : 'bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                autoRefresh ? 'translate-x-4' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
