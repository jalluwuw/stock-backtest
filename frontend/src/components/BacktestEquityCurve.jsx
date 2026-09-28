"use client";
import React, { useEffect, useRef } from "react";
import { createChart, LineSeries, AreaSeries } from "lightweight-charts";
import { TrendingUp } from "lucide-react";

function fmtIDR(val) {
  if (val === undefined || val === null) return "–";
  const abs = Math.abs(val);
  if (abs >= 1_000_000_000)
    return (val < 0 ? "-" : "+") + "Rp " + (abs / 1_000_000_000).toFixed(2) + " M";
  if (abs >= 1_000_000)
    return (val < 0 ? "-" : "+") + "Rp " + (abs / 1_000_000).toFixed(2) + " jt";
  return (val < 0 ? "-Rp " : "Rp ") + Math.abs(val).toLocaleString("id-ID");
}

export default function BacktestEquityCurve({ equityCurve, initialCapital }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!equityCurve || equityCurve.length < 2 || !chartRef.current) return;

    // Convert equity curve to lightweight-charts format
    // equity_curve uses string dates "YYYY-MM-DD"
    const data = equityCurve
      .filter((pt) => pt.date && pt.value)
      .map((pt) => ({ time: pt.date, value: Number(pt.value) }))
      // Remove duplicates (same date) — keep last
      .reduce((acc, cur) => {
        const last = acc[acc.length - 1];
        if (last && last.time === cur.time) {
          acc[acc.length - 1] = cur;
        } else {
          acc.push(cur);
        }
        return acc;
      }, []);

    if (data.length < 2) return;

    const finalVal = data[data.length - 1].value;
    const isProfit  = finalVal >= initialCapital;

    const chart = createChart(chartRef.current, {
      layout:    { background: { color: "#0f172a" }, textColor: "#94a3b8" },
      grid:      { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
      rightPriceScale: { borderColor: "#1e293b" },
      timeScale: { borderColor: "#1e293b", timeVisible: true },
      width:     chartRef.current.clientWidth || 600,
      height:    180,
      handleScroll: true,
      handleScale:  true,
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor:       isProfit ? "#22c55e" : "#ef4444",
      topColor:        isProfit ? "#22c55e30" : "#ef444430",
      bottomColor:     isProfit ? "#22c55e05" : "#ef444405",
      lineWidth:       2,
      priceFormat:     { type: "price", precision: 0, minMove: 1 },
    });
    areaSeries.setData(data);

    // Baseline — initial capital
    if (initialCapital) {
      const baselineSeries = chart.addSeries(LineSeries, {
        color:     "#475569",
        lineWidth: 1,
        lineStyle: 2, // dashed
        title:     "Modal Awal",
      });
      baselineSeries.setData(
        data.map((pt) => ({ time: pt.time, value: initialCapital }))
      );
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    });
    if (chartRef.current) ro.observe(chartRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, [equityCurve, initialCapital]);

  if (!equityCurve || equityCurve.length < 2) return null;

  const finalVal  = equityCurve[equityCurve.length - 1]?.value ?? initialCapital;
  const pnl       = finalVal - initialCapital;
  const isProfit  = pnl >= 0;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <span>Equity Curve</span>
        </div>
        <div className={`text-xs font-mono font-semibold ${isProfit ? "text-emerald-400" : "text-red-400"}`}>
          {isProfit ? "+" : ""}{fmtIDR(pnl)}
        </div>
      </div>
      {/* Chart */}
      <div ref={chartRef} className="w-full" />
    </div>
  );
}
