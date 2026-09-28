import React, { useState } from 'react';
import { ArrowUpRight, ArrowUpDown, ArrowUp, ArrowDown, Sparkles, Search } from 'lucide-react';

const COLUMNS = [
  { key: 'ticker',       label: 'EMITEN',       align: 'left'  },
  { key: 'price',        label: 'HARGA',        align: 'left'  },
  { key: 'return_1d',    label: '1D RETURN',    align: 'left'  },
  { key: 'value_miliar', label: 'VALUE (IDR)',  align: 'left'  },
  { key: 'vol_ratio',    label: 'VOL / MA20',   align: 'left'  },
  { key: 'rsi',          label: 'RSI',          align: 'left'  },
  { key: 'ma_cross',     label: 'MA CROSS',     align: 'left'  },
  { key: 'signal',       label: 'SIGNAL',       align: 'right' },
];

function SortIcon({ column, sortKey, sortDir }) {
  if (sortKey !== column) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
  return sortDir === 'asc'
    ? <ArrowUp className="w-3 h-3 text-cyan-400" />
    : <ArrowDown className="w-3 h-3 text-cyan-400" />;
}

// Skeleton row
function SkeletonRow() {
  return (
    <tr className="border-b border-slate-800/60">
      {COLUMNS.map((col) => (
        <td key={col.key} className="p-3">
          <div className="h-4 rounded bg-slate-800 animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  );
}

export default function ResultsTable({ results, newTickers = new Set(), isLoading, onSelectStock }) {
  const [sortKey, setSortKey] = useState('value_miliar');
  const [sortDir, setSortDir] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // Filter pencarian
  const filtered = results.filter((row) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      row.ticker?.toLowerCase().includes(q) ||
      row.name?.toLowerCase().includes(q) ||
      row.sector?.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortKey] ?? '';
    const vb = b[sortKey] ?? '';
    if (typeof va === 'number' && typeof vb === 'number') {
      return sortDir === 'asc' ? va - vb : vb - va;
    }
    return sortDir === 'asc'
      ? String(va).localeCompare(String(vb))
      : String(vb).localeCompare(String(va));
  });

  return (
    <div className="bg-[#12182E] p-6 rounded-2xl border border-slate-800/80 shadow-xl space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-white font-semibold">Hasil Screening</h3>
          <span className="text-cyan-400 font-mono bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md text-xs font-bold">
            {results.length} lolos kriteria
          </span>
          {newTickers.size > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md animate-pulse">
              <Sparkles className="w-3 h-3" />
              +{newTickers.size} baru
            </span>
          )}
        </div>

        {/* Search bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kode / nama / sektor..."
            className="w-full bg-[#0A0D1A] text-xs text-slate-200 pl-9 pr-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-400">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`p-3 cursor-pointer select-none hover:text-slate-200 transition group ${
                    col.align === 'right' ? 'text-right' : ''
                  }`}
                  onClick={() => handleSort(col.key)}
                >
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    {col.label}
                    <SortIcon column={col.key} sortKey={sortKey} sortDir={sortDir} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60 text-sm">
            {isLoading && results.length === 0
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : sorted.map((row) => {
                  const isNew = newTickers.has(row.ticker);
                  const returnColor =
                    row.return_1d > 0 ? 'text-emerald-400' : row.return_1d < 0 ? 'text-red-400' : 'text-slate-400';

                  return (
                    <tr
                      key={row.ticker}
                      onClick={() => onSelectStock(row)}
                      className={`cursor-pointer transition-colors duration-300 ${
                        isNew
                          ? 'bg-amber-500/10 hover:bg-amber-500/15 border-l-2 border-amber-400'
                          : 'hover:bg-[#18203B]/80'
                      }`}
                    >
                      {/* Emiten: Ticker + Nama + Sektor */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-cyan-400 font-mono">{row.ticker}</span>
                          {isNew && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded px-1 font-bold">
                              NEW
                            </span>
                          )}
                          {row.sector && (
                            <span className="text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60 hidden md:inline">
                              {row.sector}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[200px]" title={row.name}>
                          {row.name}
                        </div>
                      </td>

                      <td className="p-3 font-mono">Rp {row.price?.toLocaleString('id-ID')}</td>
                      <td className={`p-3 font-mono font-semibold ${returnColor}`}>
                        {row.return_1d > 0 ? '+' : ''}{row.return_1d?.toFixed(2)}%
                      </td>
                      <td className="p-3 font-mono text-slate-300">Rp {row.value_miliar} M</td>
                      <td className="p-3 font-mono text-pink-400 font-bold">{row.vol_ratio}x</td>
                      <td className="p-3 font-mono">
                        <span className={`${row.rsi >= 70 ? 'text-red-400' : row.rsi >= 50 ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {row.rsi?.toFixed(1)}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-xs text-blue-300">{row.ma_cross}</td>
                      <td className="p-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {row.signals && row.signals.length > 0 ? (
                            row.signals.map((sig, idx) => {
                              let badgeColor = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
                              if (sig.includes('MACD')) badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                              else if (sig.includes('Triple') || sig.includes('EMA') || sig.includes('SMA')) badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
                              else if (sig.includes('Breakout') || sig.includes('High')) badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30';

                              return (
                                <span
                                  key={idx}
                                  className={`${badgeColor} border px-2 py-0.5 rounded-md text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap`}
                                >
                                  {sig} <ArrowUpRight className="w-2.5 h-2.5" />
                                </span>
                              );
                            })
                          ) : (
                            <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-md text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap">
                              {row.signal || 'BULLISH'} <ArrowUpRight className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

            {!isLoading && sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="p-10 text-center text-slate-500 text-sm">
                  {searchQuery ? `Tidak ada hasil untuk pencarian "${searchQuery}".` : 'Tidak ada emiten yang lolos kriteria saat ini.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}