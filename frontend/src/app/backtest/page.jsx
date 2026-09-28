'use client';

import React, { useState, useEffect, useCallback } from 'react';
import BacktestPanel from '../../components/BacktestPanel';
import BacktestStats from '../../components/BacktestStats';
import BacktestEquityCurve from '../../components/BacktestEquityCurve';
import BacktestTradeLog from '../../components/BacktestTradeLog';
import StockChart from '../../components/StockChart';
import { AlertCircle, Terminal, Layers } from 'lucide-react';

import { API_BASE } from '../../config/api';

export default function BacktestPage() {
  const [result, setResult]       = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState(null);
  const [currentTicker, setCurrentTicker] = useState('BBCA');

  const executeBacktest = useCallback(async (params) => {
    setIsLoading(true);
    setError(null);
    setCurrentTicker(params.ticker || 'BBCA');

    try {
      const res = await fetch(`${API_BASE}/api/v1/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await res.json();
      if (!res.ok || data.status === 'error') {
        throw new Error(data.message || 'Gagal menjalankan backtest.');
      }

      setResult(data);
    } catch (err) {
      console.error('Backtest error:', err);
      setError(err.message || 'Terjadi kesalahan saat memproses backtest.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Run initial backtest on page load with default params
  useEffect(() => {
    executeBacktest({
      ticker: 'BBCA',
      strategy: 'macd_cross',
      initial_capital: 10000000,
      lot_size: 10,
      enable_tp_sl: true,
      sl_mode: 'fixed_pct',
      sl_pct: 3.0,
      rr_ratio: 2.0,
      enable_trailing_stop: false,
      trailing_stop_pct: 2.0,
      macd_fast: 12,
      macd_slow: 26,
      macd_signal: 9,
      ma1: 5,
      ma2: 20,
      ma3: 50,
      ma_type: 'EMA',
      swing_days: 20,
      vol_spike_mult: 2.0,
      min_trans_value: 10000000000,
      vwap_window: 20,
      bb_period: 20,
      bb_std: 2.0,
    });
  }, [executeBacktest]);

  return (
    <div className="min-h-screen bg-[#070913] text-slate-200 p-4 lg:p-6">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              Algorithmic Strategy Backtest Terminal
              <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                IDX Edition
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Simulasi historis eksekusi sinyal beli & jual lengkap dengan alasan teknikal serta kalkulasi PnL dalam Rupiah (IDR).
            </p>
          </div>
        </div>

        {result && (
          <div className="flex items-center gap-3 text-xs bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl font-mono">
            <span className="text-slate-400">Saham:</span>
            <span className="text-cyan-400 font-bold">{result.ticker}</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Strategi:</span>
            <span className="text-emerald-400 uppercase font-semibold">{result.strategy?.replace('_', ' ')}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Left Panel + Right Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Sidebar: Controls & Parameters (3 cols on large) */}
        <div className="lg:col-span-3">
          <div className="bg-[#0D1122] border border-slate-800/90 rounded-2xl p-4 lg:p-5 sticky top-20 shadow-xl">
            <BacktestPanel onRun={executeBacktest} isLoading={isLoading} />
          </div>
        </div>

        {/* Right Area: Results, Charts & Trade Log (9 cols on large) */}
        <div className="lg:col-span-9 space-y-5">
          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-start gap-3 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-bold">Error:</span> {error}
              </div>
            </div>
          )}

          {/* Stat Cards */}
          {result?.summary && (
            <BacktestStats summary={result.summary} ticker={result.ticker} />
          )}

          {/* Price Action & Execution Timeline Overlay (Candlestick Chart) */}
          <div className="bg-[#0D1122] border border-slate-800/90 rounded-2xl p-4 lg:p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                  Price Action & Execution Timeline Overlay
                </h2>
              </div>
              <div className="text-[11px] text-slate-400">
                Marker <span className="text-emerald-400 font-bold">▲ BUY</span> dan{' '}
                <span className="text-red-400 font-bold">▼ SELL</span> ditampilkan langsung pada candle
              </div>
            </div>

            <StockChart
              ticker={currentTicker}
              chartData={result}
              isLoading={isLoading}
              error={error}
            />
          </div>

          {/* Equity Curve Dynamics */}
          {result?.equity_curve && (
            <BacktestEquityCurve
              equityCurve={result.equity_curve}
              initialCapital={result.summary?.initial_capital}
            />
          )}

          {/* Trade Log Table with Buy/Sell Reasons */}
          <BacktestTradeLog trades={result?.trades || []} />
        </div>
      </div>
    </div>
  );
}
