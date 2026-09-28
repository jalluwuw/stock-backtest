import React from 'react';
import { 
  Play, Sliders, TrendingUp, Activity, Loader2, Sparkles, 
  Flame, Zap, Compass, RotateCcw, Check
} from 'lucide-react';

export default function ScreenerFilter({ filter, setFilter, onRun, isLoading }) {

  // Preset Handlers
  const applyPreset = (presetName) => {
    switch (presetName) {
      case 'breakout':
        setFilter((prev) => ({
          ...prev,
          minReturn: 2.0,
          minValue: 20000000000,
          useSwingHigh: true,
          swingDays: 20,
          useMacd: false,
          useTripleMa: false,
          useRsi: true,
          rsiMin: 50,
          rsiMax: 80,
        }));
        break;
      case 'triple_ma':
        setFilter((prev) => ({
          ...prev,
          minReturn: 1.0,
          minValue: 20000000000,
          useTripleMa: true,
          ma1: 5,
          ma2: 20,
          ma3: 50,
          maType: 'EMA',
          useMacd: false,
          useSwingHigh: false,
          useRsi: true,
          rsiMin: 50,
          rsiMax: 70,
        }));
        break;
      case 'macd':
        setFilter((prev) => ({
          ...prev,
          minReturn: 1.0,
          minValue: 20000000000,
          useMacd: true,
          macdFast: 12,
          macdSlow: 26,
          macdSignal: 9,
          useTripleMa: false,
          useSwingHigh: false,
          useRsi: false,
        }));
        break;
      case 'combo':
        setFilter((prev) => ({
          ...prev,
          minReturn: 1.5,
          minValue: 20000000000,
          useMacd: true,
          macdFast: 12,
          macdSlow: 26,
          macdSignal: 9,
          useTripleMa: true,
          ma1: 5,
          ma2: 20,
          ma3: 50,
          maType: 'EMA',
          useSwingHigh: true,
          swingDays: 20,
          useRsi: true,
          rsiMin: 50,
          rsiMax: 75,
        }));
        break;
      case 'reset':
        setFilter({
          minValue: 20000000000,
          minReturn: 1.0,
          useRsi: true,
          rsiMin: 50,
          rsiMax: 70,
          useMaCross: false,
          useMacd: false,
          macdFast: 12,
          macdSlow: 26,
          macdSignal: 9,
          useTripleMa: false,
          ma1: 5,
          ma2: 20,
          ma3: 50,
          maType: 'EMA',
          useSwingHigh: false,
          swingDays: 20,
        });
        break;
      default:
        break;
    }
  };

  return (
    <div className="bg-[#12182E] p-6 rounded-2xl border border-slate-800/80 shadow-2xl space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-white font-bold text-base">Screener Technical &amp; Volume Rules</h2>
            <p className="text-xs text-slate-400">Pilih dan atur parameter indikator sesuai strategimu</p>
          </div>
        </div>

        {/* 1-Click Strategy Presets Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Presets:
          </span>
          <button
            type="button"
            onClick={() => applyPreset('breakout')}
            className="px-2.5 py-1 text-xs rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-medium transition flex items-center gap-1"
          >
            <Flame className="w-3 h-3 text-amber-400" /> Breakout Hunter
          </button>
          <button
            type="button"
            onClick={() => applyPreset('triple_ma')}
            className="px-2.5 py-1 text-xs rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 font-medium transition flex items-center gap-1"
          >
            <Compass className="w-3 h-3 text-blue-400" /> Triple MA Trend
          </button>
          <button
            type="button"
            onClick={() => applyPreset('macd')}
            className="px-2.5 py-1 text-xs rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-medium transition flex items-center gap-1"
          >
            <Zap className="w-3 h-3 text-emerald-400" /> MACD Momentum
          </button>
          <button
            type="button"
            onClick={() => applyPreset('combo')}
            className="px-2.5 py-1 text-xs rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-medium transition flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3 text-purple-400" /> Super Combo
          </button>
          <button
            type="button"
            onClick={() => applyPreset('reset')}
            className="p-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
            title="Reset Pengaturan"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Grid Filter Modular */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* 1. Likuiditas & Volume */}
        <div className="bg-[#18203B]/60 p-4 rounded-xl border border-slate-700/50 space-y-3">
          <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold border-b border-slate-700/50 pb-2">
            <TrendingUp className="w-4 h-4" /> Likuiditas &amp; Volume
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Min Nilai Transaksi (IDR)</label>
            <input
              type="number"
              value={filter.minValue}
              onChange={(e) => setFilter({ ...filter, minValue: Number(e.target.value) })}
              className="bg-[#0A0D1A] text-white text-xs font-mono px-3 py-2 rounded-lg border border-slate-700 w-full"
            />
            <span className="text-[10px] text-cyan-400 mt-1 block">
              = Rp {(filter.minValue / 1e9).toFixed(0)} Miliar (Volume &ge; MA20)
            </span>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Min 1-Day Return (%)</label>
            <input
              type="number"
              step="0.5"
              value={filter.minReturn}
              onChange={(e) => setFilter({ ...filter, minReturn: Number(e.target.value) })}
              className="bg-[#0A0D1A] text-white text-xs font-mono px-3 py-2 rounded-lg border border-slate-700 w-full"
            />
          </div>
        </div>

        {/* 2. MACD Golden Cross (Dinamis) */}
        <div className={`bg-[#18203B]/60 p-4 rounded-xl border transition-colors space-y-3 ${
          filter.useMacd ? 'border-emerald-500/50 bg-[#18203B]' : 'border-slate-700/50'
        }`}>
          <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
              <Zap className="w-4 h-4" /> MACD Golden Cross
            </div>
            <input
              type="checkbox"
              checked={filter.useMacd}
              onChange={(e) => setFilter({ ...filter, useMacd: e.target.checked })}
              className="accent-emerald-500 w-4 h-4 cursor-pointer"
            />
          </div>
          <div className={filter.useMacd ? 'space-y-2' : 'opacity-40 pointer-events-none space-y-2'}>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5 text-center">Fast</label>
                <input
                  type="number"
                  value={filter.macdFast}
                  onChange={(e) => setFilter({ ...filter, macdFast: Number(e.target.value) })}
                  className="bg-[#0A0D1A] text-white text-xs font-mono py-1.5 rounded border border-slate-700 w-full text-center"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5 text-center">Slow</label>
                <input
                  type="number"
                  value={filter.macdSlow}
                  onChange={(e) => setFilter({ ...filter, macdSlow: Number(e.target.value) })}
                  className="bg-[#0A0D1A] text-white text-xs font-mono py-1.5 rounded border border-slate-700 w-full text-center"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5 text-center">Signal</label>
                <input
                  type="number"
                  value={filter.macdSignal}
                  onChange={(e) => setFilter({ ...filter, macdSignal: Number(e.target.value) })}
                  className="bg-[#0A0D1A] text-white text-xs font-mono py-1.5 rounded border border-slate-700 w-full text-center"
                />
              </div>
            </div>
            <p className="text-[10px] text-emerald-400 font-mono text-center pt-1">
              Rule: MACD({filter.macdFast},{filter.macdSlow}) &gt; Signal({filter.macdSignal})
            </p>
          </div>
        </div>

        {/* 3. Triple Moving Average (Dinamis) */}
        <div className={`bg-[#18203B]/60 p-4 rounded-xl border transition-colors space-y-3 ${
          filter.useTripleMa ? 'border-blue-500/50 bg-[#18203B]' : 'border-slate-700/50'
        }`}>
          <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
            <div className="flex items-center gap-2 text-blue-400 text-sm font-semibold">
              <Compass className="w-4 h-4" /> Triple Moving Average
            </div>
            <input
              type="checkbox"
              checked={filter.useTripleMa}
              onChange={(e) => setFilter({ ...filter, useTripleMa: e.target.checked })}
              className="accent-blue-500 w-4 h-4 cursor-pointer"
            />
          </div>
          <div className={filter.useTripleMa ? 'space-y-2' : 'opacity-40 pointer-events-none space-y-2'}>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-slate-400 flex-shrink-0">Tipe MA:</label>
              <select
                value={filter.maType}
                onChange={(e) => setFilter({ ...filter, maType: e.target.value })}
                className="bg-[#0A0D1A] text-cyan-300 text-xs font-mono px-2 py-1 rounded border border-slate-700 w-full"
              >
                <option value="EMA">EMA (Exponential)</option>
                <option value="SMA">SMA (Simple)</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5 text-center">Short</label>
                <input
                  type="number"
                  value={filter.ma1}
                  onChange={(e) => setFilter({ ...filter, ma1: Number(e.target.value) })}
                  className="bg-[#0A0D1A] text-white text-xs font-mono py-1.5 rounded border border-slate-700 w-full text-center"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5 text-center">Medium</label>
                <input
                  type="number"
                  value={filter.ma2}
                  onChange={(e) => setFilter({ ...filter, ma2: Number(e.target.value) })}
                  className="bg-[#0A0D1A] text-white text-xs font-mono py-1.5 rounded border border-slate-700 w-full text-center"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5 text-center">Long</label>
                <input
                  type="number"
                  value={filter.ma3}
                  onChange={(e) => setFilter({ ...filter, ma3: Number(e.target.value) })}
                  className="bg-[#0A0D1A] text-white text-xs font-mono py-1.5 rounded border border-slate-700 w-full text-center"
                />
              </div>
            </div>
            <p className="text-[10px] text-blue-300 font-mono text-center pt-1">
              Rule: {filter.maType}({filter.ma1}) &gt; {filter.maType}({filter.ma2}) &gt; {filter.maType}({filter.ma3})
            </p>
          </div>
        </div>

        {/* 4. Breakout Swing High Daily (Dinamis) */}
        <div className={`bg-[#18203B]/60 p-4 rounded-xl border transition-colors space-y-3 ${
          filter.useSwingHigh ? 'border-amber-500/50 bg-[#18203B]' : 'border-slate-700/50'
        }`}>
          <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
            <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
              <Flame className="w-4 h-4" /> Breakout Swing High Daily
            </div>
            <input
              type="checkbox"
              checked={filter.useSwingHigh}
              onChange={(e) => setFilter({ ...filter, useSwingHigh: e.target.checked })}
              className="accent-amber-500 w-4 h-4 cursor-pointer"
            />
          </div>
          <div className={filter.useSwingHigh ? 'space-y-2' : 'opacity-40 pointer-events-none space-y-2'}>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Lookback Periode (Hari Bursa)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={filter.swingDays}
                  onChange={(e) => setFilter({ ...filter, swingDays: Number(e.target.value) })}
                  className="bg-[#0A0D1A] text-white text-xs font-mono px-3 py-2 rounded-lg border border-slate-700 w-full"
                />
                <span className="text-xs text-slate-400">Hari</span>
              </div>
            </div>
            <p className="text-[10px] text-amber-300 font-mono text-center pt-1">
              Rule: Close &gt; High {filter.swingDays} Hari Sebelumnya
            </p>
          </div>
        </div>

        {/* 5. RSI (14) Range */}
        <div className={`bg-[#18203B]/60 p-4 rounded-xl border transition-colors space-y-3 ${
          filter.useRsi ? 'border-pink-500/50 bg-[#18203B]' : 'border-slate-700/50'
        }`}>
          <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
            <div className="flex items-center gap-2 text-pink-400 text-sm font-semibold">
              <Activity className="w-4 h-4" /> RSI (14)
            </div>
            <input
              type="checkbox"
              checked={filter.useRsi}
              onChange={(e) => setFilter({ ...filter, useRsi: e.target.checked })}
              className="accent-pink-500 w-4 h-4 cursor-pointer"
            />
          </div>
          <div className={filter.useRsi ? 'space-y-2' : 'opacity-40 pointer-events-none space-y-2'}>
            <label className="text-xs text-slate-400 block mb-1">Rentang Nilai RSI</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={filter.rsiMin}
                onChange={(e) => setFilter({ ...filter, rsiMin: Number(e.target.value) })}
                className="bg-[#0A0D1A] text-white text-xs font-mono px-2 py-2 rounded border border-slate-700 w-full text-center"
                placeholder="Min"
              />
              <span className="text-slate-500 text-xs self-center">-</span>
              <input
                type="number"
                value={filter.rsiMax}
                onChange={(e) => setFilter({ ...filter, rsiMax: Number(e.target.value) })}
                className="bg-[#0A0D1A] text-white text-xs font-mono px-2 py-2 rounded border border-slate-700 w-full text-center"
                placeholder="Max"
              />
            </div>
            <p className="text-[10px] text-pink-400 font-mono text-center pt-1">
              Zone: {filter.rsiMin} s/d {filter.rsiMax} (Momentum Bullish)
            </p>
          </div>
        </div>

        {/* 6. Ringkasan Strategi Aktif */}
        <div className="bg-[#18203B]/30 p-4 rounded-xl border border-slate-800 space-y-2 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-300 block mb-2">Aturan Aktif:</span>
            <ul className="text-[11px] text-slate-400 space-y-1">
              <li className="flex items-center gap-1.5 text-cyan-300">
                <Check className="w-3 h-3 text-cyan-400" /> Nilai &ge; Rp {(filter.minValue / 1e9).toFixed(0)}M &amp; Vol &ge; MA20
              </li>
              {filter.useMacd && (
                <li className="flex items-center gap-1.5 text-emerald-300">
                  <Check className="w-3 h-3 text-emerald-400" /> MACD ({filter.macdFast},{filter.macdSlow},{filter.macdSignal}) GC
                </li>
              )}
              {filter.useTripleMa && (
                <li className="flex items-center gap-1.5 text-blue-300">
                  <Check className="w-3 h-3 text-blue-400" /> Triple {filter.maType} ({filter.ma1} &gt; {filter.ma2} &gt; {filter.ma3})
                </li>
              )}
              {filter.useSwingHigh && (
                <li className="flex items-center gap-1.5 text-amber-300">
                  <Check className="w-3 h-3 text-amber-400" /> Breakout High {filter.swingDays}D
                </li>
              )}
              {filter.useRsi && (
                <li className="flex items-center gap-1.5 text-pink-300">
                  <Check className="w-3 h-3 text-pink-400" /> RSI antara {filter.rsiMin} - {filter.rsiMax}
                </li>
              )}
            </ul>
          </div>
          <span className="text-[10px] text-slate-500 italic">
            Kombinasikan beberapa indikator untuk sinyal lebih presisi.
          </span>
        </div>

      </div>

      {/* Action Button */}
      <button
        onClick={onRun}
        disabled={isLoading}
        className="w-full py-3.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Menjalankan Screening...
          </>
        ) : (
          <>
            <Play className="w-4 h-4 fill-current" />
            EXECUTE SCREENER
          </>
        )}
      </button>
    </div>
  );
}