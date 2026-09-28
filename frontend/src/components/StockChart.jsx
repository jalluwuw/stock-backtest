"use client";
import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
  CrosshairMode,
} from 'lightweight-charts';
import { Eye, EyeOff, Layers } from 'lucide-react';

const COLORS = {
  ma1:       '#facc15',  // kuning
  ma2:       '#38bdf8',  // biru
  ma3:       '#a855f7',  // ungu
  macd:      '#22d3ee',  // cyan
  signal:    '#fb923c',  // oranye
  vwap:      '#e879f9',  // fuchsia
  bbUpper:   '#38bdf8',  // light blue
  bbMid:     '#94a3b8',  // slate
  bbLower:   '#38bdf8',  // light blue
  volUp:     '#22c55e80',
  volDown:   '#ef444480',
  bg:        '#0f172a',
  grid:      '#1e293b',
  text:      '#94a3b8',
  buy:       '#22c55e',  // green
  sell:      '#f59e0b',  // amber
  tp:        '#10b981',  // emerald
  sl:        '#ef4444',  // red
};

function fmtVolume(v) {
  if (!v) return '0';
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return String(v);
}

export default function StockChart({ ticker, chartData, isLoading, error }) {
  const mainRef = useRef(null);
  const macdRef = useRef(null);

  const [legend, setLegend] = useState(null);

  // ── Indicator Visibility Controls (Hide / Show) ───────────────────────────
  const [showMA,      setShowMA]      = useState(true);
  const [showMACD,    setShowMACD]    = useState(true);
  const [showSignals, setShowSignals] = useState(true);
  const [showVolume,  setShowVolume]  = useState(true);
  const [showVWAP,    setShowVWAP]    = useState(true);
  const [showBB,      setShowBB]      = useState(true);

  // ── Render Chart ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartData || !chartData.candles || chartData.candles.length === 0) return;
    if (!mainRef.current) return;

    const commonOpts = {
      layout:    { background: { color: COLORS.bg }, textColor: COLORS.text },
      grid:      { vertLines: { color: COLORS.grid }, horzLines: { color: COLORS.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: COLORS.grid },
      timeScale: { borderColor: COLORS.grid, timeVisible: true },
      handleScroll: true,
      handleScale:  true,
    };

    // 1. Main Candlestick Chart
    const mainChart = createChart(mainRef.current, {
      ...commonOpts,
      width:  mainRef.current.clientWidth || 700,
      height: showMACD && chartData.macd?.macd_line?.length > 0 ? 320 : 420,
    });

    const candles = mainChart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    candles.setData(chartData.candles);

    // Volume Series (Optional)
    if (showVolume) {
      const volSeries = mainChart.addSeries(HistogramSeries, {
        color:        COLORS.volUp,
        priceFormat:  { type: 'volume' },
        priceScaleId: 'volume',
      });
      mainChart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      });
      volSeries.setData(
        chartData.candles.map((c) => ({
          time:  c.time,
          value: c.volume,
          color: c.close >= c.open ? COLORS.volUp : COLORS.volDown,
        }))
      );
    }

    // Moving Averages Overlay (Optional)
    if (showMA && chartData.ma_lines) {
      const meta = chartData.meta || {};
      if (chartData.ma_lines.ma1?.length > 0) {
        const s1 = mainChart.addSeries(LineSeries, {
          color: COLORS.ma1,
          lineWidth: 1.5,
          title: `${meta.ma_type || 'MA'}${meta.ma1 || 5}`,
        });
        s1.setData(chartData.ma_lines.ma1);
      }
      if (chartData.ma_lines.ma2?.length > 0) {
        const s2 = mainChart.addSeries(LineSeries, {
          color: COLORS.ma2,
          lineWidth: 1.5,
          title: `${meta.ma_type || 'MA'}${meta.ma2 || 20}`,
        });
        s2.setData(chartData.ma_lines.ma2);
      }
      if (chartData.ma_lines.ma3?.length > 0) {
        const s3 = mainChart.addSeries(LineSeries, {
          color: COLORS.ma3,
          lineWidth: 1.5,
          title: `${meta.ma_type || 'MA'}${meta.ma3 || 50}`,
        });
        s3.setData(chartData.ma_lines.ma3);
      }
    }

    // VWAP Line Overlay (Optional)
    if (showVWAP && chartData.vwap?.length > 0) {
      const vwapSeries = mainChart.addSeries(LineSeries, {
        color: COLORS.vwap,
        lineWidth: 1.8,
        title: `VWAP(${chartData.meta?.vwap_window || 20})`,
      });
      vwapSeries.setData(chartData.vwap);
    }

    // Bollinger Bands Overlay (Optional)
    if (showBB && chartData.bollinger) {
      if (chartData.bollinger.upper?.length > 0) {
        const upper = mainChart.addSeries(LineSeries, {
          color: COLORS.bbUpper,
          lineWidth: 1.2,
          title: 'BB Upper',
        });
        upper.setData(chartData.bollinger.upper);
      }
      if (chartData.bollinger.middle?.length > 0) {
        const mid = mainChart.addSeries(LineSeries, {
          color: COLORS.bbMid,
          lineWidth: 1.0,
          lineStyle: 2, // dashed
          title: 'BB Mid',
        });
        mid.setData(chartData.bollinger.middle);
      }
      if (chartData.bollinger.lower?.length > 0) {
        const lower = mainChart.addSeries(LineSeries, {
          color: COLORS.bbLower,
          lineWidth: 1.2,
          title: 'BB Lower',
        });
        lower.setData(chartData.bollinger.lower);
      }
    }

    // Signal Markers: BUY, SELL, TP (Take Profit), SL (Stop Loss)
    if (showSignals && chartData.signals?.length > 0) {
      const markers = chartData.signals.map((sig) => {
        let position = 'aboveBar';
        let shape    = 'arrowDown';
        let color    = COLORS.sell;
        let text     = sig.type;

        if (sig.type === 'BUY') {
          position = 'belowBar';
          shape    = 'arrowUp';
          color    = COLORS.buy;
          text     = `BUY ${sig.price ? sig.price.toLocaleString('id-ID') : ''}`;
        } else if (sig.type === 'TP') {
          position = 'aboveBar';
          shape    = 'arrowDown';
          color    = COLORS.tp;
          text     = `TP ${sig.price ? sig.price.toLocaleString('id-ID') : ''}`;
        } else if (sig.type === 'SL') {
          position = 'aboveBar';
          shape    = 'arrowDown';
          color    = COLORS.sl;
          text     = `SL ${sig.price ? sig.price.toLocaleString('id-ID') : ''}`;
        } else if (sig.type === 'SELL') {
          position = 'aboveBar';
          shape    = 'arrowDown';
          color    = COLORS.sell;
          text     = `SELL ${sig.price ? sig.price.toLocaleString('id-ID') : ''}`;
        }

        return {
          time:     sig.time,
          position: position,
          color:    color,
          shape:    shape,
          text:     text,
          size:     1.5,
        };
      });
      createSeriesMarkers(candles, markers);
    }

    mainChart.timeScale().fitContent();

    // 2. MACD Sub-Chart (Optional)
    let macdChart = null;
    const hasMacdData = chartData.macd?.macd_line?.length > 0;
    if (showMACD && hasMacdData && macdRef.current) {
      macdChart = createChart(macdRef.current, {
        ...commonOpts,
        width:  macdRef.current.clientWidth || 700,
        height: 120,
        timeScale: { ...commonOpts.timeScale, visible: false },
      });

      if (chartData.macd.histogram?.length > 0) {
        const histSeries = macdChart.addSeries(HistogramSeries, {
          color: '#22c55e',
          priceScaleId: 'right',
        });
        histSeries.setData(chartData.macd.histogram);
      }

      if (chartData.macd.macd_line?.length > 0) {
        const ml = macdChart.addSeries(LineSeries, { color: COLORS.macd, lineWidth: 1.5, title: 'MACD' });
        ml.setData(chartData.macd.macd_line);
      }

      if (chartData.macd.signal_line?.length > 0) {
        const sl = macdChart.addSeries(LineSeries, { color: COLORS.signal, lineWidth: 1.5, title: 'Signal' });
        sl.setData(chartData.macd.signal_line);
      }

      macdChart.timeScale().fitContent();

      // Sync visible range between main and macd
      mainChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range && macdChart) macdChart.timeScale().setVisibleLogicalRange(range);
      });
      macdChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range && mainChart) mainChart.timeScale().setVisibleLogicalRange(range);
      });
    }

    // Crosshair hover for OHLCV Legend
    mainChart.subscribeCrosshairMove((param) => {
      const prices = param?.seriesData;
      if (!prices) return;
      const bar = prices.get(candles);
      if (bar) {
        setLegend({
          time:   param.time,
          open:   bar.open,
          high:   bar.high,
          low:    bar.low,
          close:  bar.close,
          volume: chartData.candles.find((c) => c.time === param.time)?.volume,
        });
      }
    });

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (mainRef.current && mainChart) {
        mainChart.applyOptions({ width: mainRef.current.clientWidth });
      }
      if (macdRef.current && macdChart) {
        macdChart.applyOptions({ width: macdRef.current.clientWidth });
      }
    });

    if (mainRef.current) ro.observe(mainRef.current);
    if (macdRef.current) ro.observe(macdRef.current);

    return () => {
      ro.disconnect();
      mainChart.remove();
      if (macdChart) macdChart.remove();
    };
  }, [chartData, showMA, showMACD, showSignals, showVolume, showVWAP, showBB]);

  const hasCandles = chartData?.candles && chartData.candles.length > 0;
  const hasVwap    = chartData?.vwap && chartData.vwap.length > 0;
  const hasBB      = chartData?.bollinger?.upper && chartData.bollinger.upper.length > 0;
  const hasMACD    = chartData?.macd?.macd_line && chartData.macd.macd_line.length > 0;

  return (
    <div className="space-y-2">
      {/* ── Toolbar: Hide / Show Indicators ─────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 text-xs">
        <div className="flex items-center gap-2 text-slate-400 font-medium">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>Overlay:</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Toggle MA */}
          <button
            onClick={() => setShowMA((v) => !v)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold transition-all ${
              showMA
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
            }`}
          >
            {showMA ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>Triple MA</span>
          </button>

          {/* Toggle VWAP */}
          {hasVwap && (
            <button
              onClick={() => setShowVWAP((v) => !v)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold transition-all ${
                showVWAP
                  ? 'bg-fuchsia-500/10 border-fuchsia-500/40 text-fuchsia-400'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
              }`}
            >
              {showVWAP ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>VWAP</span>
            </button>
          )}

          {/* Toggle Bollinger */}
          {hasBB && (
            <button
              onClick={() => setShowBB((v) => !v)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold transition-all ${
                showBB
                  ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
              }`}
            >
              {showBB ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>Bollinger</span>
            </button>
          )}

          {/* Toggle MACD */}
          {hasMACD && (
            <button
              onClick={() => setShowMACD((v) => !v)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold transition-all ${
                showMACD
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
              }`}
            >
              {showMACD ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>MACD</span>
            </button>
          )}

          {/* Toggle Sinyal */}
          <button
            onClick={() => setShowSignals((v) => !v)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold transition-all ${
              showSignals
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
            }`}
          >
            {showSignals ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>Sinyal & TP/SL</span>
          </button>

          {/* Toggle Volume */}
          <button
            onClick={() => setShowVolume((v) => !v)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold transition-all ${
              showVolume
                ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-400'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
            }`}
          >
            {showVolume ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>Volume</span>
          </button>
        </div>
      </div>

      {/* ── OHLCV & Legend Bar ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1 text-xs font-mono min-h-[22px] flex-wrap gap-2">
        {legend ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-slate-500 font-sans">Tanggal:</span>
            <span className="text-slate-300 font-bold">{legend.time}</span>
            <span className="text-slate-500">O</span>
            <span className={legend.open >= legend.close ? 'text-red-400' : 'text-emerald-400'}>
              {legend.open?.toLocaleString('id-ID')}
            </span>
            <span className="text-slate-500">H</span>
            <span className="text-emerald-400">{legend.high?.toLocaleString('id-ID')}</span>
            <span className="text-slate-500">L</span>
            <span className="text-red-400">{legend.low?.toLocaleString('id-ID')}</span>
            <span className="text-slate-500">C</span>
            <span className="text-slate-200 font-bold">{legend.close?.toLocaleString('id-ID')}</span>
            {showVolume && (
              <>
                <span className="text-slate-500 ml-2">Vol</span>
                <span className="text-slate-300">{fmtVolume(legend.volume)}</span>
              </>
            )}
          </div>
        ) : (
          <span className="text-slate-500 text-[11px]">Arahkan kursor ke grafik untuk rincian candle</span>
        )}

        {/* Legend MA / VWAP jika aktif */}
        <div className="flex items-center gap-2.5 text-[11px]">
          {showMA && chartData?.meta && (
            <>
              <span style={{ color: COLORS.ma1 }}>■ {chartData.meta.ma_type}{chartData.meta.ma1}</span>
              <span style={{ color: COLORS.ma2 }}>■ {chartData.meta.ma_type}{chartData.meta.ma2}</span>
              <span style={{ color: COLORS.ma3 }}>■ {chartData.meta.ma_type}{chartData.meta.ma3}</span>
            </>
          )}
          {showVWAP && hasVwap && (
            <span style={{ color: COLORS.vwap }} className="font-semibold">■ VWAP</span>
          )}
          {showBB && hasBB && (
            <span style={{ color: COLORS.bbUpper }} className="font-semibold">■ BBands</span>
          )}
        </div>
      </div>

      {/* ── Chart Container ── */}
      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-[#0f172a]">
        {/* Main Candlestick Chart */}
        <div ref={mainRef} className="w-full" />

        {/* MACD Sub-Chart (jika toggle aktif) */}
        {showMACD && hasMACD && (
          <div>
            <div className="bg-[#0b1120] px-3 py-1 flex items-center justify-between text-[11px] border-t border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <span style={{ color: COLORS.macd }} className="font-semibold">
                  ■ MACD ({chartData?.meta?.macd_fast || 12},{chartData?.meta?.macd_slow || 26},{chartData?.meta?.macd_signal || 9})
                </span>
                <span style={{ color: COLORS.signal }}>■ Signal</span>
                <span className="text-emerald-400">■</span>
                <span className="text-red-400">■ Histogram</span>
              </div>
            </div>
            <div ref={macdRef} className="w-full" />
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-[#0f172a]/85 backdrop-blur-[2px] flex items-center justify-center z-20">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-300">Memproses simulasi & chart {ticker}…</p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && !isLoading && (
          <div className="absolute inset-0 bg-[#0f172a]/95 flex items-center justify-center z-20 p-4">
            <div className="text-center text-red-400 text-sm max-w-sm">
              <p className="font-semibold mb-1">Gagal memuat chart</p>
              <p className="text-xs text-slate-400">{error}</p>
            </div>
          </div>
        )}

        {/* Empty Data Overlay */}
        {!isLoading && !error && !hasCandles && (
          <div className="absolute inset-0 bg-[#0f172a] flex items-center justify-center z-20 p-4">
            <div className="text-center text-slate-400 text-xs">
              Belum ada data candle untuk {ticker}. Pastikan ticker sudah di-sync.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
