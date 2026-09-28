"use client";
import React, { useEffect, useRef, useState, memo } from 'react';
import { Clock, Zap } from 'lucide-react';

const TIMEFRAMES = [
  { label: '1m (Live)', value: '1',  desc: 'Intraday 1 Menit' },
  { label: '5m',        value: '5',  desc: 'Intraday 5 Menit' },
  { label: '15m',       value: '15', desc: 'Intraday 15 Menit' },
  { label: '1h',        value: '60', desc: 'Hourly' },
  { label: '1D',        value: 'D',  desc: 'Daily' },
  { label: '1W',        value: 'W',  desc: 'Weekly' },
];

function TradingViewWidget({ ticker }) {
  const chartContainer     = useRef(null);
  const symbolInfoContainer = useRef(null);

  // Default interval: '1' untuk intraday live real-time
  const [interval, setInterval] = useState('1');

  const cleanTicker = ticker ? ticker.toUpperCase().replace('.JK', '').trim() : '';
  const symbol = `IDX:${cleanTicker}`;

  // ── 1. Render TradingView Symbol Info Widget (Live Quote, % Change, Volume) ─
  useEffect(() => {
    if (!symbol || !symbolInfoContainer.current) return;

    symbolInfoContainer.current.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    symbolInfoContainer.current.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: symbol,
      width: '100%',
      locale: 'id',
      colorTheme: 'dark',
      isTransparent: true,
    });

    symbolInfoContainer.current.appendChild(script);

    return () => {
      if (symbolInfoContainer.current) {
        symbolInfoContainer.current.innerHTML = '';
      }
    };
  }, [symbol]);

  // ── 2. Render TradingView Advanced Real-Time Chart Widget ─────────────────
  useEffect(() => {
    if (!symbol || !chartContainer.current) return;

    chartContainer.current.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    chartContainer.current.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: interval,
      timezone: 'Asia/Jakarta',
      theme: 'dark',
      style: '1',
      locale: 'id',
      enable_publishing: false,
      withdateranges: true,
      hide_top_toolbar: false,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      save_image: false,
      details: true,
      hotlist: false,
      calendar: false,
      show_popup_button: true,
      popup_width: '1000',
      popup_height: '650',
      support_host: 'https://www.tradingview.com',
      studies: [
        'STD;MACD',
        'STD;EMA@tv-basicstudies',
      ],
    });

    chartContainer.current.appendChild(script);

    return () => {
      if (chartContainer.current) {
        chartContainer.current.innerHTML = '';
      }
    };
  }, [symbol, interval]);

  return (
    <div className="space-y-2">
      {/* ── Real-Time Symbol Info Widget dari TradingView ───────────────── */}
      <div className="rounded-xl overflow-hidden border border-slate-800 bg-[#0b1120] p-1">
        <div ref={symbolInfoContainer} className="tradingview-widget-container min-h-[70px] w-full" />
      </div>

      {/* ── Timeframe Bar: 1m, 5m, 15m, 1h, 1D, 1W ─────────────────────── */}
      <div className="flex items-center justify-between gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400 font-medium">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>Timeframe:</span>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setInterval(tf.value)}
              title={tf.desc}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                interval === tf.value
                  ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {tf.value === '1' && <Zap className="w-3 h-3 inline mr-1 text-amber-300" />}
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Advanced Real-Time Chart ────────────────────────────────────── */}
      <div className="w-full h-[500px] rounded-xl overflow-hidden border border-slate-800 bg-[#0f172a] shadow-inner relative">
        <div ref={chartContainer} className="tradingview-widget-container h-full w-full" />
      </div>

      {/* ── Disclaimer & Direct Link ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400">
        <span>
          ℹ️ <b>Info Bursa IDX:</b> Widget sematan gratis TradingView dibatasi regulasi bursa (data EOD/kemarin). Untuk melihat live tick 1 menit di akun TradingView kamu (seperti di tab browser sebelah), gunakan tombol:
        </span>
        <a
          href={`https://www.tradingview.com/chart/?symbol=${symbol}`}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-blue-400 hover:text-white px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 transition-all flex items-center gap-1"
        >
          <span>Buka di Web TradingView</span>
          <span>↗</span>
        </a>
      </div>
    </div>
  );
}


export default memo(TradingViewWidget);
