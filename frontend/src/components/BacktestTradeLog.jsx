"use client";
import React, { useState } from "react";
import { TableProperties, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Target, ShieldAlert } from "lucide-react";

function fmtIDR(val) {
  if (val === undefined || val === null) return "–";
  const abs = Math.abs(val);
  const prefix = val < 0 ? "-Rp " : "Rp ";
  if (abs >= 1_000_000_000) return (val < 0 ? "-" : "") + "Rp " + (abs / 1_000_000_000).toFixed(2) + " M";
  if (abs >= 1_000_000)     return (val < 0 ? "-" : "") + "Rp " + (abs / 1_000_000).toFixed(1) + " jt";
  return prefix + abs.toLocaleString("id-ID");
}

function fmtPrice(val) {
  if (!val) return "–";
  return "Rp " + Number(val).toLocaleString("id-ID");
}

export default function BacktestTradeLog({ trades }) {
  const [sortKey, setSortKey]   = useState("no");
  const [sortDir, setSortDir]   = useState("asc");
  const [page, setPage]         = useState(0);
  const PAGE_SIZE = 15;

  if (!trades || trades.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center text-slate-500 text-sm">
        Tidak ada trade yang dieksekusi dalam periode ini. Coba sesuaikan parameter atau kurangi batas filter.
      </div>
    );
  }

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(0);
  };

  const sorted = [...trades].sort((a, b) => {
    const av = a[sortKey]; const bv = b[sortKey];
    if (av === undefined || bv === undefined) return 0;
    if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated  = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const winCount  = trades.filter((t) => t.result === "WIN").length;
  const lossCount = trades.filter((t) => t.result === "LOSS").length;
  const totalPnL  = trades.reduce((s, t) => s + (t.gross_pnl || 0), 0);

  const SortIcon = ({ col }) =>
    sortKey === col ? (
      sortDir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />
    ) : null;

  const Th = ({ col, children, className = "" }) => (
    <th
      onClick={() => handleSort(col)}
      className={`px-3 py-2.5 text-left text-[11px] font-semibold text-slate-400 cursor-pointer
                  hover:text-slate-200 select-none whitespace-nowrap ${className}`}
    >
      {children} <SortIcon col={col} />
    </th>
  );

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <TableProperties className="w-4 h-4 text-cyan-400" />
          <span>Riwayat Eksekusi Trade</span>
          <span className="text-xs text-slate-500 font-normal">({trades.length} trade)</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-emerald-400 font-semibold">{winCount} WIN</span>
          <span className="text-red-400 font-semibold">{lossCount} LOSS</span>
          <span className={`font-mono font-bold px-2 py-0.5 rounded ${totalPnL >= 0 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
            {totalPnL >= 0 ? "+" : ""}{fmtIDR(totalPnL)}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-950/70 border-b border-slate-800/80">
            <tr>
              <Th col="no">#</Th>
              <Th col="buy_date">Tanggal Beli</Th>
              <Th col="buy_price">Harga Beli</Th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-400 min-w-[190px]">Alasan Beli (Reason)</th>
              <Th col="sell_date">Tanggal Jual</Th>
              <Th col="sell_price">Harga Jual</Th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-400">Tipe Exit</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-400 min-w-[210px]">Alasan Jual (Reason)</th>
              <Th col="lots">Lot</Th>
              <Th col="gross_pnl">PnL (IDR)</Th>
              <Th col="pnl_pct">% Return</Th>
              <Th col="result">Hasil</Th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((trade) => {
              const isWin     = trade.result === "WIN";
              const exitType  = trade.exit_type || (isWin ? "TP" : "SL");
              const rowBg     = isWin ? "hover:bg-emerald-500/5" : "hover:bg-red-500/5";

              return (
                <tr key={trade.no} className={`border-b border-slate-800/40 transition-colors ${rowBg}`}>
                  <td className="px-3 py-2.5 text-slate-500 font-mono">{trade.no}</td>

                  {/* BUY */}
                  <td className="px-3 py-2.5 text-slate-300 font-mono whitespace-nowrap">{trade.buy_date}</td>
                  <td className="px-3 py-2.5 text-slate-200 font-mono font-semibold whitespace-nowrap">{fmtPrice(trade.buy_price)}</td>
                  <td className="px-3 py-2.5 min-w-[190px]">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-medium leading-tight">
                      <TrendingUp className="w-2.5 h-2.5 shrink-0" />
                      {trade.buy_reason}
                    </span>
                  </td>

                  {/* SELL */}
                  <td className="px-3 py-2.5 text-slate-300 font-mono whitespace-nowrap">
                    {trade.sell_date || <span className="text-amber-400 font-semibold italic">Open ⚡</span>}
                  </td>
                  <td className="px-3 py-2.5 text-slate-200 font-mono font-semibold whitespace-nowrap">
                    {trade.sell_price ? fmtPrice(trade.sell_price) : "–"}
                  </td>

                  {/* EXIT TYPE BADGE */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {exitType === "TP" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        <Target className="w-2.5 h-2.5" /> TP Hit
                      </span>
                    )}
                    {exitType === "SL" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40">
                        <ShieldAlert className="w-2.5 h-2.5" /> SL Hit
                      </span>
                    )}
                    {exitType !== "TP" && exitType !== "SL" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        Signal Exit
                      </span>
                    )}
                  </td>

                  {/* SELL REASON */}
                  <td className="px-3 py-2.5 min-w-[210px]">
                    {trade.sell_reason ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium leading-tight ${
                        exitType === "TP"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : exitType === "SL"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-blue-500/10 text-blue-400"
                      }`}>
                        <TrendingDown className="w-2.5 h-2.5 shrink-0" />
                        {trade.sell_reason}
                      </span>
                    ) : (
                      <span className="text-amber-400 text-[10px] italic">Belum Tutup</span>
                    )}
                  </td>

                  {/* LOTS & PNL */}
                  <td className="px-3 py-2.5 text-slate-300 font-mono text-center">{trade.lots}</td>
                  <td className={`px-3 py-2.5 font-mono font-bold whitespace-nowrap ${isWin ? "text-emerald-400" : "text-red-400"}`}>
                    {isWin ? "+" : ""}{fmtIDR(trade.gross_pnl)}
                  </td>
                  <td className={`px-3 py-2.5 font-mono font-semibold whitespace-nowrap ${isWin ? "text-emerald-400" : "text-red-400"}`}>
                    {isWin ? "+" : ""}{trade.pnl_pct?.toFixed(2)}%
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isWin
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-red-500/15 text-red-400 border border-red-500/30"
                    }`}>
                      {trade.result}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-800 text-xs text-slate-500">
          <span>
            Menampilkan {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, trades.length)} dari {trades.length} trade
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`px-2.5 py-1 rounded transition ${
                  i === page
                    ? "bg-cyan-600 text-white font-bold"
                    : "bg-slate-800 hover:bg-slate-700"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
