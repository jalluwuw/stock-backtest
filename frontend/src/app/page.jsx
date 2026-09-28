'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ScreenerFilter from '../components/ScreenerFilter';
import ResultsTable from '../components/ResultsTable';
import StockDetailModal from '../components/StockDetailModal';
import LiveStatusBar from '../components/LiveStatusBar';
import TelegramModal from '../components/TelegramModal';

import { API_BASE } from '../config/api';
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 menit
const STATUS_POLL_MS   = 30 * 1000;     // status tiap 30 detik

export default function ScreenerPage() {
  const [filter, setFilter] = useState({
    minValue: 20000000000,
    minReturn: 1.0,
    useRsi: true,
    rsiMin: 50,
    rsiMax: 70,
    useMaCross: false,
    // Indikator Kustom MACD
    useMacd: false,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    // Indikator Kustom Triple MA
    useTripleMa: false,
    ma1: 5,
    ma2: 20,
    ma3: 50,
    maType: 'EMA',
    // Indikator Kustom Breakout Swing High
    useSwingHigh: false,
    swingDays: 20,
  });

  const [results, setResults]             = useState([]);
  const [prevTickers, setPrevTickers]     = useState(new Set());
  const [newTickers, setNewTickers]       = useState(new Set());
  const [selectedStock, setSelectedStock] = useState(null);
  const [isLoading, setIsLoading]         = useState(false);
  const [syncStatus, setSyncStatus]       = useState(null);
  const [lastUpdated, setLastUpdated]     = useState(null);
  const [autoRefresh, setAutoRefresh]     = useState(true);
  const [secondsToNext, setSecondsToNext] = useState(POLL_INTERVAL_MS / 1000);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);

  // ─── Refs agar polling tidak stale closure ────────────────────────────
  const pollTimerRef   = useRef(null);
  const statusTimerRef = useRef(null);
  const countdownRef   = useRef(null);
  const filterRef      = useRef(filter);
  const prevTickRef    = useRef(prevTickers);
  const autoRefRef     = useRef(autoRefresh);

  useEffect(() => { filterRef.current = filter; }, [filter]);
  useEffect(() => { prevTickRef.current = prevTickers; }, [prevTickers]);
  useEffect(() => { autoRefRef.current = autoRefresh; }, [autoRefresh]);

  // ─── Fetch screener (selalu baca filter dari ref) ─────────────────────
  const runScreener = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    const f = filterRef.current;
    try {
      const query = new URLSearchParams({
        min_value:      f.minValue,
        min_return:     f.minReturn,
        use_rsi:        f.useRsi,
        rsi_min:        f.rsiMin,
        rsi_max:        f.rsiMax,
        use_ma_cross:   f.useMaCross,
        use_macd:       f.useMacd,
        macd_fast:      f.macdFast,
        macd_slow:      f.macdSlow,
        macd_signal:    f.macdSignal,
        use_triple_ma:  f.useTripleMa,
        ma1:            f.ma1,
        ma2:            f.ma2,
        ma3:            f.ma3,
        ma_type:        f.maType,
        use_swing_high: f.useSwingHigh,
        swing_days:     f.swingDays,
      });

      const res     = await fetch(`${API_BASE}/api/v1/screen?${query}`);
      const data    = await res.json();
      const incoming = data.data || [];

      const incomingSet = new Set(incoming.map((r) => r.ticker));
      const fresh = new Set([...incomingSet].filter((t) => !prevTickRef.current.has(t)));

      setNewTickers(fresh);
      setPrevTickers(incomingSet);
      setResults(incoming);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Gagal menjalankan screener:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []); // deps kosong — baca filter via ref

  // ─── Fetch sync status ─────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/api/v1/status`);
      const data = await res.json();
      setSyncStatus(data);
    } catch {
      setSyncStatus(null);
    }
  }, []);

  // ─── Auto-run on first load ────────────────────────────────────────────
  useEffect(() => {
    runScreener();
    fetchStatus();
  }, []); // eslint-disable-line

  // ─── Auto-poll screener setiap POLL_INTERVAL_MS ───────────────────────
  useEffect(() => {
    setSecondsToNext(POLL_INTERVAL_MS / 1000);
    clearInterval(pollTimerRef.current);

    if (!autoRefresh) return;

    pollTimerRef.current = setInterval(() => {
      runScreener(true);
      setSecondsToNext(POLL_INTERVAL_MS / 1000); // reset countdown setelah refresh
    }, POLL_INTERVAL_MS);

    return () => clearInterval(pollTimerRef.current);
  }, [autoRefresh, runScreener]);

  // ─── Poll status tiap 30 detik ─────────────────────────────────────────
  useEffect(() => {
    statusTimerRef.current = setInterval(fetchStatus, STATUS_POLL_MS);
    return () => clearInterval(statusTimerRef.current);
  }, [fetchStatus]);

  // ─── Countdown tiap detik ─────────────────────────────────────────────
  useEffect(() => {
    clearInterval(countdownRef.current);
    if (!autoRefresh) { setSecondsToNext(null); return; }
    countdownRef.current = setInterval(() => {
      setSecondsToNext((s) => (s !== null && s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [autoRefresh]);

  // ─── Highlight baris baru selama 5 detik ──────────────────────────────
  useEffect(() => {
    if (newTickers.size === 0) return;
    const t = setTimeout(() => setNewTickers(new Set()), 5000);
    return () => clearTimeout(t);
  }, [newTickers]);

  // ─── Handler refresh manual ───────────────────────────────────────────
  const handleRefreshNow = useCallback(() => {
    runScreener(false);
    setSecondsToNext(POLL_INTERVAL_MS / 1000);
    // restart interval
    clearInterval(pollTimerRef.current);
    if (autoRefRef.current) {
      pollTimerRef.current = setInterval(() => {
        runScreener(true);
        setSecondsToNext(POLL_INTERVAL_MS / 1000);
      }, POLL_INTERVAL_MS);
    }
  }, [runScreener]);

  return (
    <div className="min-h-screen bg-[#0A0D1A] text-slate-200 p-6 space-y-4">
      <LiveStatusBar
        syncStatus={syncStatus}
        lastUpdated={lastUpdated}
        secondsToNext={secondsToNext}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
        onRefreshNow={handleRefreshNow}
        onOpenTelegram={() => setIsTelegramModalOpen(true)}
      />
      <ScreenerFilter
        filter={filter}
        setFilter={setFilter}
        onRun={() => runScreener(false)}
        isLoading={isLoading}
      />
      <ResultsTable
        results={results}
        newTickers={newTickers}
        isLoading={isLoading}
        onSelectStock={setSelectedStock}
      />
      {selectedStock && (
        <StockDetailModal
          stock={selectedStock}
          filter={filter}
          onClose={() => setSelectedStock(null)}
        />
      )}
      <TelegramModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
      />
    </div>
  );
}