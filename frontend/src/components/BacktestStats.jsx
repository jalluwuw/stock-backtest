"use client";
import React from "react";
import {
  TrendingUp, TrendingDown, Target, BarChart2,
  AlertTriangle, Award, Minus, Clock, ShieldCheck,
  Percent, ArrowRightLeft
} from "lucide-react";

function fmtIDR(val) {
  if (val === undefined || val === null) return "–";
  const abs = Math.abs(val);
  if (abs >= 1_000_000_000)
    return (val < 0 ? "-" : "") + "Rp " + (abs / 1_000_000_000).toFixed(2) + " M";
  if (abs >= 1_000_000)
    return (val < 0 ? "-" : "") + "Rp " + (abs / 1_000_000).toFixed(2) + " jt";
  return (val < 0 ? "-" : "") + "Rp " + Math.abs(val).toLocaleString("id-ID");
}

function StatCard({ icon, label, value, sub, color = "text-slate-200", bgColor = "bg-slate-900/60", borderColor = "border-slate-800" }) {
  return (
    <div className={`${bgColor} border ${borderColor} rounded-xl p-3.5 space-y-1.5`}>
      <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 leading-tight">{sub}</div>}
    </div>
  );
}

export default function BacktestStats({ summary, ticker }) {
  if (!summary) return null;

  const {
    net_pnl, net_pnl_pct, win_rate, total_trades,
    win_trades, loss_trades, max_drawdown,
    initial_capital, final_capital,
    best_trade, worst_trade, avg_hold_days,
    still_holding, unrealized_pnl,
    tp_count, sl_count, signal_count,
    profit_factor, rr_setting,
    start_date, end_date, total_bars, period
  } = summary;

  const isProfit    = net_pnl >= 0;
  const pnlColor    = isProfit ? "text-emerald-400" : "text-red-400";
  const pnlBg       = isProfit ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20";

  const wrColor =
    win_rate >= 60 ? "text-emerald-400" :
    win_rate >= 40 ? "text-amber-400"   : "text-red-400";

  return (
    <div className="space-y-3">
      {/* Date Range & Total Candles Badge */}
      {start_date && end_date && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-cyan-400">📅</span>
            <span className="text-slate-400">Rentang Waktu:</span>
            <span className="font-mono font-semibold text-slate-200">{start_date}</span>
            <span className="text-slate-500">s/d</span>
            <span className="font-mono font-semibold text-slate-200">{end_date}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono text-[11px] font-semibold">
              {total_bars?.toLocaleString('id-ID')} Candle Bars
            </span>
            <span className="text-[11px] text-slate-500">
              {period === 'max' ? '🌟 Sejak Awal Listing (IPO)' : `Periode ${period?.toUpperCase()}`}
            </span>
          </div>
        </div>
      )}

      {/* Row 1 — headline stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Net PnL */}
        <div className={`col-span-2 sm:col-span-1 bg-slate-900/60 border ${pnlBg} rounded-xl p-3.5 space-y-1.5`}>
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
            {isProfit
              ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
            <span>Net PnL (IDR)</span>
          </div>
          <div className={`text-2xl font-bold font-mono ${pnlColor}`}>
            {fmtIDR(net_pnl)}
          </div>
          <div className={`text-xs font-semibold ${pnlColor}`}>
            {isProfit ? "+" : ""}{net_pnl_pct?.toFixed(2)}%
            <span className="text-slate-500 font-normal ml-2">return</span>
          </div>
          {still_holding && unrealized_pnl !== 0 && (
            <div className="text-[10px] text-amber-400 font-mono">
              ⚡ Floating: {fmtIDR(unrealized_pnl)}
            </div>
          )}
        </div>

        {/* Win Rate */}
        <StatCard
          icon={<Target className="w-3.5 h-3.5 text-cyan-400" />}
          label="Win Rate"
          value={`${win_rate?.toFixed(1)}%`}
          sub={`${win_trades} WIN / ${loss_trades} LOSS`}
          color={wrColor}
        />

        {/* Profit Factor */}
        <StatCard
          icon={<Percent className="w-3.5 h-3.5 text-indigo-400" />}
          label="Profit Factor"
          value={profit_factor > 50 ? "> 50" : profit_factor?.toFixed(2)}
          sub={`Target RR: ${rr_setting || 'N/A'}`}
          color={profit_factor >= 1.5 ? "text-emerald-400" : "text-amber-400"}
        />

        {/* Max Drawdown */}
        <StatCard
          icon={<AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
          label="Max Drawdown"
          value={fmtIDR(max_drawdown)}
          sub="Penurunan terdalam dari puncak"
          color={max_drawdown < 0 ? "text-red-400" : "text-slate-300"}
        />
      </div>

      {/* Row 2 — Execution Breakdown & Risk Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* TP vs SL vs Sinyal Breakdown */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
            <span>Tipe Exit Selesai</span>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold border border-emerald-500/30">
              🎯 {tp_count || 0} TP
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400 font-mono font-bold border border-red-500/30">
              🛑 {sl_count || 0} SL
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono font-semibold">
              🔄 {signal_count || 0}
            </span>
          </div>
          <div className="text-[10px] text-slate-500">
            Total {total_trades} trade dieksekusi
          </div>
        </div>

        <StatCard
          icon={<Award className="w-3.5 h-3.5 text-emerald-400" />}
          label="Best Trade"
          value={fmtIDR(best_trade)}
          color="text-emerald-400"
        />

        <StatCard
          icon={<Minus className="w-3.5 h-3.5 text-red-400" />}
          label="Worst Trade"
          value={fmtIDR(worst_trade)}
          color={worst_trade < 0 ? "text-red-400" : "text-slate-300"}
        />

        <StatCard
          icon={<Clock className="w-3.5 h-3.5 text-purple-400" />}
          label="Rata-rata Hold"
          value={`${avg_hold_days} hari`}
          sub={`Modal Akhir: ${fmtIDR(final_capital)}`}
          color="text-purple-300"
        />
      </div>
    </div>
  );
}
