"use client";
import React, { useState, useEffect } from 'react';
import { X, Building2, TrendingUp, TrendingDown, Minus, BarChart2, Info, Activity, ExternalLink } from 'lucide-react';
import StockChart from './StockChart';
import TradingViewWidget from './TradingViewWidget';
import { API_BASE } from '../config/api';

function SignalBadge({ signal, reasons, loading }) {
  if (loading) {
    return <div className="w-24 h-10 rounded-xl bg-slate-800 animate-pulse" />;
  }

  const isBuy  = signal === 'BUY';
  const isSell = signal === 'SELL';

  const base = 'flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm shadow-md';
  const cls  = isBuy
    ? `${base} bg-emerald-500/20 border border-emerald-500/50 text-emerald-400`
    : isSell
    ? `${base} bg-red-500/20 border border-red-500/50 text-red-400`
    : `${base} bg-slate-700/40 border border-slate-600/40 text-slate-400`;

  const Icon = isBuy ? TrendingUp : isSell ? TrendingDown : Minus;

  return (
    <div className="space-y-1">
      <div className={cls}>
        <Icon className="w-4 h-4" />
        <span>{signal || 'NEUTRAL'}</span>
      </div>
      {reasons?.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {reasons.slice(0, 2).map((r, i) => (
            <span key={i} className="text-[11px] text-slate-400 pl-1">• {r}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StockDetailModal({ stock, onClose, filter }) {
  // Default ke Chart Sinyal Screener yang memiliki data real-time hari ini dari server kita
  const [activeTab,   setActiveTab]   = useState('screener_chart');
  const [chartData,   setChartData]   = useState(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [loadError,   setLoadError]   = useState(null);


  // Parameter primitif untuk mencegah infinite re-render
  const ticker     = stock?.ticker;
  const ma1        = filter?.ma1        ?? 5;
  const ma2        = filter?.ma2        ?? 20;
  const ma3        = filter?.ma3        ?? 50;
  const maType     = filter?.maType     ?? 'EMA';
  const macdFast   = filter?.macdFast   ?? 12;
  const macdSlow   = filter?.macdSlow   ?? 26;
  const macdSignal = filter?.macdSignal ?? 9;
  const swingDays  = filter?.swingDays  ?? 20;

  // Key stabil berbasis string primitif
  const fetchKey = `${ticker}_${ma1}_${ma2}_${ma3}_${maType}_${macdFast}_${macdSlow}_${macdSignal}_${swingDays}`;

  // ── Fetch data chart & sinyal hanya SEKALI per emiten/setting ────────────
  useEffect(() => {
    if (!ticker) return;

    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);

    const params = new URLSearchParams({
      ma1:         String(ma1),
      ma2:         String(ma2),
      ma3:         String(ma3),
      ma_type:     maType,
      macd_fast:   String(macdFast),
      macd_slow:   String(macdSlow),
      macd_signal: String(macdSignal),
      swing_days:  String(swingDays),
    });

    fetch(`${API_BASE}/api/v1/chart/${ticker}?${params}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Gagal memuat data`);
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setChartData(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setLoadError(err.message || 'Gagal memuat chart');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [fetchKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!stock) return null;

  const currentSignal  = chartData?.current_signal  ?? 'NEUTRAL';
  const signalReasons  = chartData?.signal_reasons  ?? [];
  const totalSignals   = chartData?.signals?.length ?? 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 sm:p-5 w-full max-w-5xl text-white relative shadow-2xl space-y-4 max-h-[95vh] overflow-y-auto">

        {/* Tombol tutup */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors z-10"
        >
          <X size={22} />
        </button>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between pr-8">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold text-cyan-400 font-mono tracking-tight">{stock.ticker}</h2>
              {stock.sector && (
                <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-cyan-400" /> {stock.sector}
                </span>
              )}
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                IDX:{stock.ticker.replace('.JK', '')}
              </span>
              <a
                href={`https://www.tradingview.com/chart/?symbol=IDX:${stock.ticker.replace('.JK', '')}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/40 hover:bg-blue-600/40 hover:text-white flex items-center gap-1.5 transition-all shadow-sm"
                title="Buka chart live di TradingView.com (akun penuh)"
              >
                <span>Buka di TradingView.com</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-sm text-slate-300 font-medium">{stock.name || 'Emiten IHSG'}</p>
          </div>

          {/* Sinyal badge */}
          <div className="flex-shrink-0">
            <SignalBadge signal={currentSignal} reasons={signalReasons} loading={isLoading} />
          </div>
        </div>

        {/* ── Stats grid ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs">
          <div>
            <span className="text-slate-500 block mb-0.5">Harga Terakhir</span>
            <span className="font-mono font-bold text-slate-200">Rp {stock.price?.toLocaleString('id-ID')}</span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">1-Day Return</span>
            <span className={`font-mono font-bold ${stock.return_1d >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {stock.return_1d >= 0 ? '+' : ''}{stock.return_1d}%
            </span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">RSI (14)</span>
            <span className="font-mono font-bold text-slate-200">{stock.rsi ?? '--'}</span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Vol Ratio</span>
            <span className="font-mono font-bold text-pink-400">{stock.vol_ratio ?? 1}x</span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Sinyal Terdeteksi</span>
            <span className="font-mono font-bold text-amber-400">{totalSignals} sinyal</span>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="flex gap-1 border-b border-slate-800 overflow-x-auto">
          {[
            { id: 'screener_chart', label: 'Chart Live Screener (Real-Time)', icon: BarChart2, badge: 'REALTIME' },
            { id: 'tradingview',   label: 'TradingView Embed Widget',        icon: Activity },
            { id: 'info',           label: 'Histori Sinyal',                  icon: Info },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-t-lg transition-colors border-b-2 font-medium whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab 1: Custom Screener Chart (Real-Time dengan Data Hari Ini & Marker BUY/SELL) ── */}
        {activeTab === 'screener_chart' && (
          <StockChart
            ticker={stock.ticker}
            chartData={chartData}
            isLoading={isLoading}
            error={loadError}
          />
        )}

        {/* ── Tab 2: TradingView Chart Widget ─────────────────────────── */}
        {activeTab === 'tradingview' && (
          <TradingViewWidget ticker={stock.ticker} />
        )}


        {/* ── Tab 3: Sinyal Detail ──────────────────────────────────────── */}
        {activeTab === 'info' && (
          <div className="space-y-3 py-1">
            {chartData?.signals?.length > 0 ? (
              <>
                <p className="text-xs text-slate-400">
                  Daftar sinyal teknikal historis yang terdeteksi berdasarkan pergerakan candle:
                </p>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {[...chartData.signals].reverse().map((sig, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-sm ${
                        sig.type === 'BUY'
                          ? 'bg-emerald-500/5 border-emerald-500/30'
                          : 'bg-red-500/5 border-red-500/30'
                      }`}
                    >
                      <span className={`font-bold text-xs px-2.5 py-0.5 rounded-lg ${
                        sig.type === 'BUY'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {sig.type}
                      </span>
                      <span className="font-mono text-slate-400 text-xs">{sig.time}</span>
                      <span className="text-slate-200 flex-1">{sig.reason}</span>
                      <span className="font-mono text-slate-400 text-xs">
                        Rp {sig.price?.toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm space-y-1">
                <Info className="w-6 h-6 text-slate-500 mb-1" />
                <p>Tidak ada sinyal historis untuk parameter saat ini.</p>
                <p className="text-xs text-slate-500">Coba atur filter MACD, Triple MA, atau Breakout Swing High.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}