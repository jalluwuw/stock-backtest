"use client";
import React, { useState } from "react";
import {
  Play, Settings, TrendingUp, BarChart2, Activity,
  ShieldAlert, Zap, Waves, Disc, Globe
} from "lucide-react";

const MARKETS = [
  {
    id: "stocks_idx",
    label: "🇮🇩 IDX Stocks",
    lotLabel: "Lot per Trade",
    lotDesc: "1 lot = 100 lembar",
    defaultTicker: "BBCA",
    placeholder: "Contoh: BBCA, TLKM, BMRI",
    quickSymbols: ["BBCA", "BBRI", "TLKM", "BMRI", "ASII", "GOTO"],
  },
  {
    id: "crypto",
    label: "₿ Crypto",
    lotLabel: "Unit per Trade",
    lotDesc: "mis. 0.1 BTC, 1 ETH",
    defaultTicker: "BTC-USD",
    placeholder: "Contoh: BTC-USD, ETH-USD, SOL-USD",
    quickSymbols: ["BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD", "XRP-USD", "DOGE-USD"],
  },
  {
    id: "forex",
    label: "💱 Forex",
    lotLabel: "Lot per Trade",
    lotDesc: "mis. 1000 unit mata uang",
    defaultTicker: "EURUSD",
    placeholder: "Contoh: EURUSD, USDJPY, GBPUSD",
    quickSymbols: ["EURUSD", "USDJPY", "GBPUSD", "AUDUSD", "USDCHF", "USDCAD"],
  },
  {
    id: "commodity",
    label: "🥇 Commodity",
    lotLabel: "Unit per Trade",
    lotDesc: "mis. 1 oz Gold, 1 bbl Oil",
    defaultTicker: "GC",
    placeholder: "Contoh: GC (Gold), CL (Oil), SI (Silver)",
    quickSymbols: ["GC", "CL", "SI", "NG", "ZW", "ZC"],
  },
  {
    id: "index",
    label: "📊 Index",
    lotLabel: "Unit per Trade",
    lotDesc: "mis. 1 unit indeks",
    defaultTicker: "GSPC",
    placeholder: "Contoh: GSPC (S&P500), JKSE, DJI",
    quickSymbols: ["GSPC", "JKSE", "DJI", "IXIC", "N225", "FTSE"],
  },
];

const STRATEGIES = [
  { value: "macd_cross",         label: "MACD Cross",            icon: <Activity className="w-3.5 h-3.5" />,    desc: "Golden/Dead Cross MACD line & Signal line" },
  { value: "triple_ma",          label: "Triple MA",              icon: <TrendingUp className="w-3.5 h-3.5" />,  desc: "Alignment 3 Moving Average (5>20>50)" },
  { value: "swing_high",         label: "Swing High Breakout",    icon: <BarChart2 className="w-3.5 h-3.5" />,   desc: "Breakout di atas swing high N hari" },
  { value: "bandarmology",       label: "Bandarmology Spike",     icon: <Zap className="w-3.5 h-3.5" />,         desc: "Volume Spike anomali + Transaksi jumbo" },
  { value: "vwap_breakout",      label: "VWAP Breakout",          icon: <Waves className="w-3.5 h-3.5" />,       desc: "Volume Weighted Average Price crossover" },
  { value: "bollinger_breakout", label: "Bollinger Breakout",     icon: <Disc className="w-3.5 h-3.5" />,        desc: "Breakout Upper Band setelah squeeze" },
];

function InputField({ label, value, onChange, type = "text", min, step, suffix }) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] text-slate-400 font-medium">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
          min={min}
          step={step}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200
                     focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all
                     pr-10"
        />
        {suffix && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export default function BacktestPanel({ onRun, isLoading }) {
  const [marketType, setMarketType]   = useState("stocks_idx");
  const [ticker, setTicker]           = useState("BBCA");
  const [strategy, setStrategy]       = useState("macd_cross");
  const [period, setPeriod]           = useState("max"); // max | 10y | 5y | 3y | 1y | db
  const [capital, setCapital]         = useState(10_000_000);
  const [lotSize, setLotSize]         = useState(10);

  const currentMarket = MARKETS.find((m) => m.id === marketType) || MARKETS[0];

  const handleMarketChange = (mId) => {
    const m = MARKETS.find((x) => x.id === mId);
    setMarketType(mId);
    setTicker(m.defaultTicker);
    // Reset lot size logic: IDX 10 lot, others 1 unit
    setLotSize(mId === "stocks_idx" ? 10 : 1);
  };

  // ── Risk Management ──
  const [enableTpSl, setEnableTpSl]         = useState(true);
  const [slMode, setSlMode]                 = useState("fixed_pct"); // fixed_pct | swing_low
  const [slPct, setSlPct]                   = useState(3.0);
  const [rrRatio, setRrRatio]               = useState(2.0); // 1:2
  const [enableTrailing, setEnableTrailing] = useState(false);
  const [trailPct, setTrailPct]             = useState(2.0);

  // ── Strategy-specific params ──
  // MACD
  const [macdFast, setMacdFast] = useState(12);
  const [macdSlow, setMacdSlow] = useState(26);
  const [macdSig,  setMacdSig]  = useState(9);
  // Triple MA
  const [ma1, setMa1]           = useState(5);
  const [ma2, setMa2]           = useState(20);
  const [ma3, setMa3]           = useState(50);
  const [maType, setMaType]     = useState("EMA");
  // Swing High
  const [swingDays, setSwingDays]       = useState(20);
  // Bandarmology
  const [volSpikeMult, setVolSpikeMult] = useState(2.0);
  const [minValMiliar, setMinValMiliar] = useState(10); // Rp 10 Miliar
  // VWAP
  const [vwapWindow, setVwapWindow]     = useState(20);
  // Bollinger
  const [bbPeriod, setBbPeriod]         = useState(20);
  const [bbStd, setBbStd]               = useState(2.0);

  const handleRun = () => {
    onRun({
      ticker: ticker.trim(),
      market_type: marketType,
      strategy,
      period,
      initial_capital: capital,
      lot_size: lotSize,
      // Risk Management
      enable_tp_sl: enableTpSl,
      sl_mode: slMode,
      sl_pct: slPct,
      rr_ratio: rrRatio,
      enable_trailing_stop: enableTrailing,
      trailing_stop_pct: trailPct,
      // Strategy params
      macd_fast: macdFast,
      macd_slow: macdSlow,
      macd_signal: macdSig,
      ma1, ma2, ma3,
      ma_type: maType,
      swing_days: swingDays,
      vol_spike_mult: volSpikeMult,
      min_trans_value: minValMiliar * 1_000_000_000,
      vwap_window: vwapWindow,
      bb_period: bbPeriod,
      bb_std: bbStd,
    });
  };

  const selectedStrategy = STRATEGIES.find((s) => s.value === strategy);
  const estimatedTpPct   = (slPct * rrRatio).toFixed(1);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-semibold text-slate-200">Parameter Backtest</span>
      </div>

      {/* ── Market Selector ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
          <Globe className="w-3 h-3" />
          <span>Pilih Pasar</span>
        </div>
        <div className="grid grid-cols-1 gap-1">
          {MARKETS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handleMarketChange(m.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all text-left ${
                marketType === m.id
                  ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-sm"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Ticker / Symbol Input ── */}
      <div className="space-y-2">
        <label className="block text-[11px] text-slate-400 font-medium">
          {marketType === "stocks_idx" ? "Kode Saham (IDX)" : "Symbol"}
        </label>
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder={currentMarket.placeholder}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-cyan-300
                     uppercase tracking-widest focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all"
        />
        {/* Quick symbol chips */}
        <div className="flex flex-wrap gap-1">
          {currentMarket.quickSymbols.map((sym) => (
            <button
              key={sym}
              type="button"
              onClick={() => setTicker(sym)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-all ${
                ticker === sym
                  ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                  : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600"
              }`}
            >
              {sym}
            </button>
          ))}
        </div>
      </div>

      {/* Periode Backtest */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <span>Rentang Waktu / Periode</span>
          <span className="text-cyan-400 font-semibold">{period === 'max' ? 'Awal Listing' : period.toUpperCase()}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: "max", label: "🌟 All (Max)" },
            { id: "10y", label: "10 Tahun" },
            { id: "5y",  label: "5 Tahun" },
            { id: "3y",  label: "3 Tahun" },
            { id: "1y",  label: "1 Tahun" },
            { id: "db",  label: "DB (60H)" },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold border transition-all text-center ${
                period === p.id
                  ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-sm"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>


      {/* Strategy Selector */}
      <div className="space-y-2">
        <label className="block text-[11px] text-slate-400 font-medium">Strategi / Engine</label>
        <div className="grid grid-cols-1 gap-1.5 max-h-52 overflow-y-auto pr-1">
          {STRATEGIES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStrategy(s.value)}
              className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                strategy === s.value
                  ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-300"
                  : "bg-slate-900/60 border-slate-700/60 text-slate-400 hover:border-slate-600 hover:text-slate-300"
              }`}
            >
              <span className="mt-0.5 shrink-0 text-cyan-400">{s.icon}</span>
              <div>
                <div className="text-xs font-semibold">{s.label}</div>
                <div className="text-[10px] text-slate-500 line-clamp-1">{s.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Capital & Lot */}
      <div className="space-y-1">
        <div className="grid grid-cols-2 gap-2">
          <InputField label="Modal Awal (IDR)" value={capital}  onChange={setCapital}  type="number" min={1000000} step={1000000} />
          <InputField
            label={currentMarket.lotLabel}
            value={lotSize}
            onChange={setLotSize}
            type="number"
            min={marketType === "stocks_idx" ? 1 : 0.0001}
            step={marketType === "stocks_idx" ? 1 : 0.001}
            suffix={marketType === "stocks_idx" ? "lot" : "unit"}
          />
        </div>
        <div className="text-[10px] text-slate-500 pl-0.5">
          {currentMarket.lotDesc}
        </div>
      </div>

      {/* ── SECTION: Risk Management & RR ── */}
      <div className="border-t border-slate-800 pt-3 space-y-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Risk Management (RR)</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enableTpSl}
              onChange={(e) => setEnableTpSl(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-7 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600" />
          </label>
        </div>

        {enableTpSl && (
          <div className="space-y-2.5">
            {/* Mode SL */}
            <div className="flex gap-1.5">
              {[
                { id: "fixed_pct", label: "Fixed % SL" },
                { id: "swing_low", label: "Swing Low" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSlMode(m.id)}
                  className={`flex-1 py-1 rounded-md text-[11px] font-semibold border transition-all ${
                    slMode === m.id
                      ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                      : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Input SL & RR */}
            <div className="grid grid-cols-2 gap-2">
              {slMode === "fixed_pct" ? (
                <InputField label="Stop Loss (SL)" value={slPct} onChange={setSlPct} type="number" min={0.5} step={0.5} suffix="%" />
              ) : (
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-400 flex items-center">
                  SL di Low 10 hari terakhir
                </div>
              )}
              <InputField label="RR Ratio (1:X)" value={rrRatio} onChange={setRrRatio} type="number" min={0.5} step={0.5} suffix="x" />
            </div>

            {/* Kalkulator Target TP */}
            {slMode === "fixed_pct" && (
              <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-emerald-400">
                <span>Target TP (1:{rrRatio}):</span>
                <span className="font-bold font-mono">+{estimatedTpPct}%</span>
              </div>
            )}

            {/* Trailing Stop */}
            <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Trailing Stop</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableTrailing}
                  onChange={(e) => setEnableTrailing(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-7 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-600" />
              </label>
            </div>
            {enableTrailing && (
              <InputField label="Jarak Trailing dari Puncak" value={trailPct} onChange={setTrailPct} type="number" min={0.5} step={0.5} suffix="%" />
            )}
          </div>
        )}
      </div>

      {/* ── SECTION: Parameter Khusus Strategi ── */}
      <div className="border-t border-slate-800 pt-3 space-y-3">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
          <Settings className="w-3 h-3" />
          <span>Parameter {selectedStrategy?.label}</span>
        </div>

        {strategy === "macd_cross" && (
          <div className="grid grid-cols-3 gap-2">
            <InputField label="Fast"   value={macdFast} onChange={setMacdFast} type="number" min={2} />
            <InputField label="Slow"   value={macdSlow} onChange={setMacdSlow} type="number" min={5} />
            <InputField label="Signal" value={macdSig}  onChange={setMacdSig}  type="number" min={2} />
          </div>
        )}

        {strategy === "triple_ma" && (
          <>
            <div className="flex gap-2">
              {["EMA", "SMA"].map((t) => (
                <button
                  key={t}
                  onClick={() => setMaType(t)}
                  className={`flex-1 py-1 rounded-lg border text-xs font-semibold transition-all ${
                    maType === t
                      ? "bg-amber-500/10 border-amber-500/40 text-amber-400"
                      : "bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <InputField label={`${maType}1`} value={ma1} onChange={setMa1} type="number" min={2} />
              <InputField label={`${maType}2`} value={ma2} onChange={setMa2} type="number" min={5} />
              <InputField label={`${maType}3`} value={ma3} onChange={setMa3} type="number" min={10} />
            </div>
          </>
        )}

        {strategy === "swing_high" && (
          <InputField label="Lookback Swing High (Hari)" value={swingDays} onChange={setSwingDays} type="number" min={5} suffix="hari" />
        )}

        {strategy === "bandarmology" && (
          <div className="grid grid-cols-2 gap-2">
            <InputField label="Volume Spike (x MA20)" value={volSpikeMult} onChange={setVolSpikeMult} type="number" min={1.2} step={0.2} suffix="x" />
            <InputField label="Min Transaksi (Miliar)" value={minValMiliar} onChange={setMinValMiliar} type="number" min={1} step={1} suffix="M" />
          </div>
        )}

        {strategy === "vwap_breakout" && (
          <InputField label="VWAP Period (Hari)" value={vwapWindow} onChange={setVwapWindow} type="number" min={5} suffix="hari" />
        )}

        {strategy === "bollinger_breakout" && (
          <div className="grid grid-cols-2 gap-2">
            <InputField label="Period (SMA)" value={bbPeriod} onChange={setBbPeriod} type="number" min={5} />
            <InputField label="Std Dev" value={bbStd} onChange={setBbStd} type="number" min={1.0} step={0.5} suffix="σ" />
          </div>
        )}
      </div>

      {/* Run Button */}
      <button
        onClick={handleRun}
        disabled={isLoading || !ticker.trim()}
        className={`mt-2 flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm transition-all ${
          isLoading || !ticker.trim()
            ? "bg-slate-800 text-slate-500 cursor-not-allowed"
            : "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 active:scale-[0.98]"
        }`}
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            <span>Running Backtest...</span>
          </>
        ) : (
          <>
            <Play className="w-4 h-4 fill-current" />
            <span>Run Backtest</span>
          </>
        )}
      </button>
    </div>
  );
}
