import os
import logging
import sys
from datetime import datetime, timezone, timedelta
from contextlib import asynccontextmanager

import pytz
import pandas as pd
import numpy as np
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text, bindparam
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
import yfinance as yf

# Import sync logic dari ihsg_sync.py
from ihsg_sync import sync_all_stocks_parallel, get_all_tickers

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

from pydantic import BaseModel
from telegram_notifier import (
    get_telegram_config,
    update_telegram_env,
    send_telegram_message,
    test_telegram_connection,
    send_alert_for_stocks,
)

load_dotenv()


# ─── Database ──────────────────────────────────────────────────────────────────
DB_HOST     = os.getenv("DB_HOST", "localhost")
DB_PORT     = os.getenv("DB_PORT", "5432")
DB_NAME     = os.getenv("DB_NAME", "stock_screener_db")
DB_USER     = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "12345678")

DATABASE_URL = f"postgresql+psycopg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=15, max_overflow=20)

# ─── Sync State ────────────────────────────────────────────────────────────────
WIB     = timezone(timedelta(hours=7))          # untuk datetime Python
WIB_TZ  = pytz.timezone("Asia/Jakarta")        # untuk APScheduler (UTC+7)
SYNC_INTERVAL_MINUTES = 5

sync_state = {
    "last_sync": None,
    "next_sync": None,
    "status": "idle",
    "message": "Belum pernah sync",
    "progress": "0/0",
    "total_tickers": 0,
    "success_count": 0,
}

def run_sync():
    """Jalankan sync paralel seluruh emiten IHSG ke database."""
    sync_state["status"] = "syncing"
    sync_state["message"] = "Sedang sync seluruh emiten IHSG..."
    logging.info("=== [Scheduler] Memulai sinkronisasi seluruh emiten IHSG ===")
    try:
        tickers = get_all_tickers()
        sync_state["total_tickers"] = len(tickers)
        success, failed = sync_all_stocks_parallel(tickers=tickers, max_workers=10, status_dict=sync_state)
        
        sync_state["status"] = "done"
        sync_state["last_sync"] = datetime.now(WIB)
        sync_state["next_sync"] = sync_state["last_sync"] + timedelta(minutes=SYNC_INTERVAL_MINUTES)
        sync_state["success_count"] = success
        sync_state["message"] = f"Sync selesai: {success} aktif dari {len(tickers)} emiten"
        logging.info(f"=== [Scheduler] Sync berhasil: {success} emiten aktif ===")

        # Otomatis deteksi sinyal dan kirim notifikasi Telegram
        try:
            logging.info("[Scheduler] Memeriksa sinyal saham untuk notifikasi Telegram...")
            screener_res = run_screener(
                min_value=5_000_000_000,
                min_return=0.5,
                use_rsi=True,
                rsi_min=45,
                rsi_max=75,
                use_macd=True,
                use_triple_ma=True,
            )
            sent = screener_res.get("telegram_alerts_sent", 0)
            if sent > 0:
                logging.info(f"[Scheduler] {sent} notifikasi alert berhasil dikirim ke Telegram!")
        except Exception as e:
            logging.error(f"[Scheduler Telegram Alert Error] {e}")
    except Exception as e:

        sync_state["status"] = "error"
        sync_state["message"] = f"Sync error: {str(e)}"
        logging.error(f"[Scheduler] Error: {e}")

# ─── Scheduler ─────────────────────────────────────────────────────────────────
scheduler = BackgroundScheduler(timezone=WIB_TZ)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Di Vercel (serverless), jangan jalankan loop scheduler background yang berat
    if not os.environ.get("VERCEL"):
        tickers = get_all_tickers()
        sync_state["total_tickers"] = len(tickers)

        logging.info(f"[Startup] Memulai sync untuk {len(tickers)} emiten...")
        import threading
        startup_thread = threading.Thread(target=run_sync, daemon=True)
        startup_thread.start()

        scheduler.add_job(run_sync, "interval", minutes=SYNC_INTERVAL_MINUTES, id="ihsg_sync")
        scheduler.start()
        logging.info(f"[Scheduler] Berjalan — sync tiap {SYNC_INTERVAL_MINUTES} menit")
    yield
    if not os.environ.get("VERCEL"):
        scheduler.shutdown()
        logging.info("[Shutdown] Scheduler dihentikan")

# ─── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="IHSG Screener API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "status": "online",
        "service": "IHSG Screener & Multi-Market Backtest API",
        "docs": "/docs",
        "version": "1.0.0"
    }

@app.get("/api")
def api_root():
    return root()

@app.get("/api/v1/status")
def get_status():
    """Status sync data terakhir dan jumlah emiten."""
    now = datetime.now(WIB)
    seconds_to_next = None
    if sync_state["next_sync"]:
        delta = (sync_state["next_sync"] - now).total_seconds()
        seconds_to_next = max(0, int(delta))

    return {
        "status": sync_state["status"],
        "message": sync_state["message"],
        "progress": sync_state["progress"],
        "last_sync": sync_state["last_sync"].isoformat() if sync_state["last_sync"] else None,
        "next_sync": sync_state["next_sync"].isoformat() if sync_state["next_sync"] else None,
        "seconds_to_next_sync": seconds_to_next,
        "sync_interval_minutes": SYNC_INTERVAL_MINUTES,
        "total_tickers": sync_state["total_tickers"],
        "success_count": sync_state["success_count"],
    }

@app.get("/api/v1/market-status")
def get_market_status():
    """Cek apakah pasar IHSG sedang buka."""
    now = datetime.now(WIB)
    is_weekday = now.weekday() < 5
    market_open  = now.replace(hour=9,  minute=0,  second=0, microsecond=0)
    market_close = now.replace(hour=16, minute=15, second=0, microsecond=0)
    is_open = is_weekday and market_open <= now <= market_close
    return {
        "is_open": is_open,
        "current_time_wib": now.isoformat(),
        "session": "Sesi Trading" if is_open else "Pasar Tutup",
    }

# ─── Telegram Alert Models & Endpoints ─────────────────────────────────────────
class TelegramConfigUpdate(BaseModel):
    bot_token: str = ""
    chat_id:   str = ""
    enabled:   bool = True
    mode:      str = "grouped"

class TelegramTestRequest(BaseModel):
    bot_token: str | None = None
    chat_id:   str | None = None
    mode:      str = "grouped"

@app.get("/api/v1/telegram/config")
def get_telegram_settings():
    """Ambil status konfigurasi Telegram saat ini."""
    cfg = get_telegram_config()
    token = cfg["bot_token"]
    masked_token = f"{token[:5]}...{token[-4:]}" if len(token) > 10 else ("Configured" if token else "")
    return {
        "enabled":      cfg["enabled"],
        "has_token":    bool(cfg["bot_token"]),
        "has_chat_id":  bool(cfg["chat_id"]),
        "chat_id":      cfg["chat_id"],
        "masked_token": masked_token,
        "mode":         cfg.get("mode", "grouped"),
    }

@app.post("/api/v1/telegram/config")
def save_telegram_settings(req: TelegramConfigUpdate):
    """Simpan bot token, chat ID, dan mode Telegram."""
    update_telegram_env(req.bot_token.strip(), req.chat_id.strip(), req.enabled, mode=req.mode)
    return {"status": "success", "message": "Konfigurasi Telegram berhasil disimpan."}

@app.post("/api/v1/telegram/test")
def test_telegram(req: TelegramTestRequest):
    """Kirim pesan pengujian ke bot Telegram."""
    ok, msg = test_telegram_connection(bot_token=req.bot_token, chat_id=req.chat_id, mode=req.mode)
    return {"ok": ok, "message": msg}



@app.get("/api/v1/screen")

def run_screener(
    min_value:      float = 20_000_000_000,
    min_return:     float = 1.0,
    use_rsi:        bool  = True,
    rsi_min:        float = 50.0,
    rsi_max:        float = 70.0,
    use_ma_cross:   bool  = False,
    # MACD Settings (Dinamis)
    use_macd:       bool  = False,
    macd_fast:      int   = 12,
    macd_slow:      int   = 26,
    macd_signal:    int   = 9,
    # Triple MA Settings (Dinamis)
    use_triple_ma:  bool  = False,
    ma1:            int   = 5,
    ma2:            int   = 20,
    ma3:            int   = 50,
    ma_type:        str   = "EMA",
    # Breakout Swing High Daily (Dinamis)
    use_swing_high: bool  = False,
    swing_days:     int   = 20,
):
    query_str = """
        WITH LatestDate AS (
            SELECT MAX(date) as max_date FROM daily_prices
        )
        SELECT 
            dp.ticker,
            COALESCE(s.name, dp.ticker) as name,
            COALESCE(s.sector, 'Lainnya') as sector,
            dp.close as price, dp.return_1d, dp.volume, 
            dp.value, dp.volume_ma20, dp.rsi_14 as rsi, dp.ema_5, dp.ema_20,
            dp.date as data_date
        FROM daily_prices dp
        JOIN LatestDate ld ON dp.date = ld.max_date
        LEFT JOIN stocks s ON dp.ticker = s.ticker
        WHERE dp.value >= :min_value
          AND dp.return_1d >= :min_return
          AND dp.volume >= dp.volume_ma20
    """

    if use_rsi:
        query_str += " AND dp.rsi_14 BETWEEN :rsi_min AND :rsi_max"
    if use_ma_cross:
        query_str += " AND dp.ema_5 > dp.ema_20"

    query_str += " ORDER BY dp.value DESC;"

    with engine.connect() as conn:
        result = conn.execute(
            text(query_str),
            {
                "min_value": min_value,
                "min_return": min_return,
                "rsi_min": rsi_min,
                "rsi_max": rsi_max,
            }
        )
        initial_candidates = [dict(r) for r in result.mappings()]

    if not initial_candidates:
        return {"status": "success", "total_passed": 0, "data": []}

    # Jika membutuhkan kalkulasi teknikal lanjutan dinamis (MACD, Triple MA, Swing High)
    needs_history = use_macd or use_triple_ma or use_swing_high

    if needs_history:
        candidate_tickers = [c["ticker"] for c in initial_candidates]
        
        # Ambil riwayat candle terakhir untuk kandidat ini
        hist_query = text("""
            SELECT ticker, date, close, high, low
            FROM daily_prices
            WHERE ticker IN :tickers
            ORDER BY ticker, date ASC;
        """).bindparams(bindparam("tickers", expanding=True))

        with engine.connect() as conn:
            hist_res = conn.execute(hist_query, {"tickers": candidate_tickers})
            hist_rows = [dict(r) for r in hist_res.mappings()]

        df_hist = pd.DataFrame(hist_rows)
        
        filtered_candidates = []
        if not df_hist.empty:
            grouped = df_hist.groupby("ticker")

            for item in initial_candidates:
                t = item["ticker"]
                if t not in grouped.groups:
                    continue

                stock_df = grouped.get_group(t).sort_values("date").reset_index(drop=True)
                if len(stock_df) < max(swing_days + 1, ma3, macd_slow):
                    # Data belum cukup panjang untuk periode yang diminta
                    # Tapi jika user set period kecil dan data ada, lanjutkan
                    if len(stock_df) < 15:
                        continue

                passed = True
                signals = []

                # 1. MACD Golden Cross
                if use_macd:
                    ema_f = stock_df["close"].ewm(span=macd_fast, adjust=False).mean()
                    ema_s = stock_df["close"].ewm(span=macd_slow, adjust=False).mean()
                    macd_line = ema_f - ema_s
                    signal_line = macd_line.ewm(span=macd_signal, adjust=False).mean()
                    
                    latest_macd = macd_line.iloc[-1]
                    latest_sig  = signal_line.iloc[-1]
                    
                    if latest_macd > latest_sig:
                        signals.append("MACD GC")
                        item["macd_info"] = f"MACD ({latest_macd:.2f}) > Signal ({latest_sig:.2f})"
                    else:
                        passed = False

                # 2. Triple Moving Average
                if passed and use_triple_ma:
                    if ma_type.upper() == "SMA":
                        m1_series = stock_df["close"].rolling(window=ma1).mean()
                        m2_series = stock_df["close"].rolling(window=ma2).mean()
                        m3_series = stock_df["close"].rolling(window=ma3).mean()
                    else:  # EMA
                        m1_series = stock_df["close"].ewm(span=ma1, adjust=False).mean()
                        m2_series = stock_df["close"].ewm(span=ma2, adjust=False).mean()
                        m3_series = stock_df["close"].ewm(span=ma3, adjust=False).mean()

                    v1 = m1_series.iloc[-1]
                    v2 = m2_series.iloc[-1]
                    v3 = m3_series.iloc[-1]

                    if pd.notna(v1) and pd.notna(v2) and pd.notna(v3) and v1 > v2 > v3:
                        signals.append(f"Triple {ma_type.upper()} ({ma1}>{ma2}>{ma3})")
                        item["triple_ma_info"] = f"{ma_type} {ma1} ({v1:.0f}) > {ma2} ({v2:.0f}) > {ma3} ({v3:.0f})"
                    else:
                        passed = False

                # 3. Breakout Swing High Daily
                if passed and use_swing_high:
                    lookback_high = stock_df["high"].iloc[:-1].tail(swing_days).max()
                    current_close = stock_df["close"].iloc[-1]

                    if pd.notna(lookback_high) and current_close > lookback_high:
                        signals.append(f"Breakout High {swing_days}D")
                        item["swing_high_info"] = f"Close ({current_close:.0f}) > High {swing_days}D ({lookback_high:.0f})"
                    else:
                        passed = False

                if passed:
                    item["signals"] = signals if signals else ["BULLISH MOMENTUM"]
                    filtered_candidates.append(item)

            final_data = filtered_candidates
        else:
            final_data = initial_candidates
    else:
        for item in initial_candidates:
            item["signals"] = ["BULLISH BREAKOUT"]
        final_data = initial_candidates

    # Format fields
    for item in final_data:
        item["vol_ratio"]    = round(float(item["volume"] / item["volume_ma20"]), 2) if item.get("volume_ma20") else 1.0
        item["value_miliar"] = round(float(item["value"] / 1_000_000_000), 2)
        item["rsi"]          = round(float(item["rsi"]), 2) if item.get("rsi") else None
        item["return_1d"]    = round(float(item["return_1d"]), 2) if item.get("return_1d") else None
        item["price"]        = round(float(item["price"]), 0) if item.get("price") else None
        item["data_date"]    = str(item.get("data_date", ""))
        item["signal"]       = " • ".join(item.get("signals", ["BULLISH"]))

    # Kirim alert Telegram untuk sinyal baru (dengan anti-spam per saham per hari)
    telegram_sent = 0
    if final_data:
        try:
            telegram_sent = send_alert_for_stocks(final_data)
        except Exception as e:
            logging.error(f"[Telegram Alert Error] {e}")

    return {
        "status": "success",
        "total_passed": len(final_data),
        "data": final_data,
        "last_sync": sync_state["last_sync"].isoformat() if sync_state["last_sync"] else None,
        "telegram_alerts_sent": telegram_sent,
    }



# ─── Chart Data Endpoint ────────────────────────────────────────────────────────
@app.get("/api/v1/chart/{ticker}")
def get_chart_data(
    ticker:      str,
    ma1:         int   = 5,
    ma2:         int   = 20,
    ma3:         int   = 50,
    ma_type:     str   = "EMA",
    macd_fast:   int   = 12,
    macd_slow:   int   = 26,
    macd_signal: int   = 9,
    swing_days:  int   = 20,
):
    """Return OHLCV candles, MA lines, MACD pane, dan signal markers untuk satu emiten."""

    # ── Ambil riwayat candle dari DB ─────────────────────────────────────────────
    ticker_clean = ticker.upper().replace(".JK", "").strip()
    ticker_jk    = f"{ticker_clean}.JK"

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT date, open, high, low, close, volume
                FROM daily_prices
                WHERE ticker IN (:t1, :t2, :t3)
                ORDER BY date ASC
            """),
            {"t1": ticker, "t2": ticker_clean, "t3": ticker_jk}
        )
        raw = [dict(r) for r in rows.mappings()]

    if not raw:
        return {"ticker": ticker, "candles": [], "ma_lines": {}, "macd": {}, "signals": [],
                "current_signal": "NEUTRAL", "signal_reasons": []}

    df = pd.DataFrame(raw)
    df["date"] = df["date"].astype(str)

    # ── Candles ───────────────────────────────────────────────────────────────────
    candles = []
    for _, r in df.iterrows():
        candles.append({
            "time":   r["date"],
            "open":   round(float(r["open"]),  2),
            "high":   round(float(r["high"]),  2),
            "low":    round(float(r["low"]),   2),
            "close":  round(float(r["close"]), 2),
            "volume": int(r["volume"]) if pd.notna(r["volume"]) else 0,
        })

    # ── MA Lines ──────────────────────────────────────────────────────────────────
    fn = (lambda s, p: s.rolling(p).mean()) if ma_type.upper() == "SMA" else \
         (lambda s, p: s.ewm(span=p, adjust=False).mean())

    ma1_s = fn(df["close"], ma1)
    ma2_s = fn(df["close"], ma2)
    ma3_s = fn(df["close"], ma3)

    def series_to_points(dates, series):
        return [
            {"time": str(d), "value": round(float(v), 2)}
            for d, v in zip(dates, series)
            if pd.notna(v)
        ]

    ma_lines = {
        "ma1": series_to_points(df["date"], ma1_s),
        "ma2": series_to_points(df["date"], ma2_s),
        "ma3": series_to_points(df["date"], ma3_s),
    }

    # ── MACD ──────────────────────────────────────────────────────────────────────
    ema_f   = df["close"].ewm(span=macd_fast,   adjust=False).mean()
    ema_s   = df["close"].ewm(span=macd_slow,   adjust=False).mean()
    macd_l  = ema_f - ema_s
    sig_l   = macd_l.ewm(span=macd_signal, adjust=False).mean()
    hist    = macd_l - sig_l

    macd_data = {
        "macd_line":   series_to_points(df["date"], macd_l),
        "signal_line": series_to_points(df["date"], sig_l),
        "histogram": [
            {
                "time":  str(d),
                "value": round(float(v), 4),
                "color": "#22c55e" if v >= 0 else "#ef4444",
            }
            for d, v in zip(df["date"], hist) if pd.notna(v)
        ],
    }

    # ── Signal Detection ──────────────────────────────────────────────────────────
    # Deteksi di setiap bar (untuk markers pada chart)
    signals_list = []

    # MACD Golden Cross / Dead Cross (perubahan dari negatif ke positif)
    macd_diff = macd_l - sig_l
    for i in range(1, len(df)):
        prev_diff = macd_diff.iloc[i-1]
        curr_diff = macd_diff.iloc[i]
        date_str  = df["date"].iloc[i]
        if pd.notna(prev_diff) and pd.notna(curr_diff):
            if prev_diff < 0 and curr_diff >= 0:
                signals_list.append({"time": date_str, "type": "BUY",
                                     "reason": f"MACD Golden Cross ({macd_fast},{macd_slow},{macd_signal})",
                                     "price": round(float(df["close"].iloc[i]), 2)})
            elif prev_diff > 0 and curr_diff <= 0:
                signals_list.append({"time": date_str, "type": "SELL",
                                     "reason": f"MACD Dead Cross ({macd_fast},{macd_slow},{macd_signal})",
                                     "price": round(float(df["close"].iloc[i]), 2)})

    # Triple MA BUY / SELL (perubahan alignment)
    if len(df) >= ma3:
        for i in range(1, len(df)):
            v1 = ma1_s.iloc[i]; v2 = ma2_s.iloc[i]; v3 = ma3_s.iloc[i]
            p1 = ma1_s.iloc[i-1]; p2 = ma2_s.iloc[i-1]; p3 = ma3_s.iloc[i-1]
            date_str = df["date"].iloc[i]
            if pd.notna(v1) and pd.notna(v2) and pd.notna(v3) and pd.notna(p1) and pd.notna(p2) and pd.notna(p3):
                if v1 > v2 > v3 and not (p1 > p2 > p3):
                    signals_list.append({"time": date_str, "type": "BUY",
                                         "reason": f"Triple {ma_type} Aligned ({ma1}>{ma2}>{ma3})",
                                         "price": round(float(df["close"].iloc[i]), 2)})
                elif v1 < v2 < v3 and not (p1 < p2 < p3):
                    signals_list.append({"time": date_str, "type": "SELL",
                                         "reason": f"Triple {ma_type} Death Align ({ma1}<{ma2}<{ma3})",
                                         "price": round(float(df["close"].iloc[i]), 2)})

    # Breakout Swing High
    if len(df) > swing_days + 1:
        for i in range(swing_days, len(df)):
            lookback_high = df["high"].iloc[i-swing_days:i-1].max()
            curr_close    = df["close"].iloc[i]
            prev_close    = df["close"].iloc[i-1]
            date_str      = df["date"].iloc[i]
            if pd.notna(lookback_high):
                if curr_close > lookback_high and prev_close <= lookback_high:
                    signals_list.append({"time": date_str, "type": "BUY",
                                         "reason": f"Breakout Swing High {swing_days}D",
                                         "price": round(float(curr_close), 2)})

    # Dedup per tanggal — jika ada BUY dan SELL di hari sama, BUY menang
    seen_dates: dict = {}
    for sig in signals_list:
        d = sig["time"]
        if d not in seen_dates:
            seen_dates[d] = sig
        else:
            existing = seen_dates[d]
            # Gabungkan reason
            if existing["type"] == sig["type"]:
                existing["reason"] += f" + {sig['reason']}"
            elif sig["type"] == "BUY":
                seen_dates[d] = sig  # BUY override SELL
    signals_sorted = sorted(seen_dates.values(), key=lambda x: x["time"])

    # ── Current signal (hari terakhir atau sinyal terbaru) ────────────────────────
    current_signal  = "NEUTRAL"
    signal_reasons  = []
    if signals_sorted:
        last_sig = signals_sorted[-1]
        current_signal = last_sig["type"]
        signal_reasons = [last_sig["reason"]]

    # Cek hari ini
    today_v1 = ma1_s.iloc[-1]; today_v2 = ma2_s.iloc[-1]; today_v3 = ma3_s.iloc[-1]
    today_macd = macd_l.iloc[-1]; today_sig = sig_l.iloc[-1]
    today_reasons = []
    if pd.notna(today_macd) and pd.notna(today_sig) and today_macd > today_sig:
        today_reasons.append(f"MACD ({macd_fast},{macd_slow},{macd_signal}) Bullish")
    if pd.notna(today_v1) and pd.notna(today_v2) and pd.notna(today_v3) and today_v1 > today_v2 > today_v3:
        today_reasons.append(f"Triple {ma_type} ({ma1}>{ma2}>{ma3}) Aligned")

    if today_reasons:
        current_signal = "BUY"
        signal_reasons = today_reasons

    return {
        "ticker":         ticker,
        "candles":        candles,
        "ma_lines":       ma_lines,
        "macd":           macd_data,
        "signals":        signals_sorted,
        "current_signal": current_signal,
        "signal_reasons": signal_reasons,
        "meta": {
            "ma_type":    ma_type,
            "ma1": ma1, "ma2": ma2, "ma3": ma3,
            "macd_fast":  macd_fast,
            "macd_slow":  macd_slow,
            "macd_signal": macd_signal,
        }
    }


# ─── Backtest Endpoint ──────────────────────────────────────────────────────────
class BacktestRequest(BaseModel):
    ticker:               str   = "BBCA"
    market_type:          str   = "stocks_idx"   # stocks_idx | crypto | forex | commodity | index
    strategy:             str   = "macd_cross"   # macd_cross | triple_ma | swing_high | bandarmology | vwap_breakout | bollinger_breakout
    period:               str   = "max"          # max (sejak listing/IPO) | 10y | 5y | 3y | 1y | db
    initial_capital:      float = 10_000_000     # IDR
    lot_size:             int   = 10             # jumlah lot per trade (1 lot = 100 lembar untuk IDX, 1 unit untuk lainnya)
    
    # ── Risk Management & RR Settings ──
    enable_tp_sl:         bool  = True
    sl_mode:              str   = "fixed_pct"    # fixed_pct | swing_low
    sl_pct:               float = 3.0            # Stop loss %
    rr_ratio:             float = 2.0            # Risk-to-Reward ratio (TP = sl * rr_ratio)
    enable_trailing_stop: bool  = False
    trailing_stop_pct:    float = 2.0            # Trailing stop % dari highest high
    
    # ── MACD params ──
    macd_fast:            int   = 12
    macd_slow:            int   = 26
    macd_signal:          int   = 9
    
    # ── Triple MA params ──
    ma1:                  int   = 5
    ma2:                  int   = 20
    ma3:                  int   = 50
    ma_type:              str   = "EMA"
    
    # ── Swing High params ──
    swing_days:           int   = 20
    
    # ── Bandarmology params ──
    vol_spike_mult:       float = 2.0            # Volume spike >= mult * MA20
    min_trans_value:      float = 10_000_000_000 # Rp 10 Miliar
    
    # ── VWAP params ──
    vwap_window:          int   = 20
    
    # ── Bollinger Bands params ──
    bb_period:            int   = 20
    bb_std:               float = 2.0


def resolve_symbol(ticker_raw: str, market_type: str) -> str:
    """Resolusi simbol yfinance berdasarkan tipe pasar."""
    t = ticker_raw.upper().strip()
    if market_type == "stocks_idx":
        # Hapus .JK jika sudah ada, tambahkan kembali
        t = t.replace(".JK", "")
        return f"{t}.JK"
    elif market_type == "crypto":
        # Sudah dalam format BTC-USD, ETH-USDT dll — kembalikan apa adanya
        return t
    elif market_type == "forex":
        # EURUSD → EURUSD=X (jika belum ada =X)
        if not t.endswith("=X"):
            t = t.replace("=X", "")
            return f"{t}=X"
        return t
    elif market_type == "commodity":
        # GC → GC=F (Gold Futures)
        if not t.endswith("=F"):
            t = t.replace("=F", "")
            return f"{t}=F"
        return t
    elif market_type == "index":
        # GSPC → ^GSPC
        if not t.startswith("^"):
            return f"^{t}"
        return t
    return t


@app.post("/api/v1/backtest")
def run_backtest(req: BacktestRequest):
    """
    Simulasi backtest strategi untuk satu ticker dari berbagai pasar (IDX, Crypto, Forex, Commodity, Index).
    Lengkap dengan Risk Management (RR, TP, SL, Trailing Stop) dan indikator teknikal komprehensif.
    """
    market_type = req.market_type.lower()
    ticker_raw  = req.ticker.strip()
    ticker_symbol = resolve_symbol(ticker_raw, market_type)
    # Fallback untuk DB (hanya IDX)
    ticker_clean = ticker_raw.upper().replace(".JK", "")
    ticker_jk    = f"{ticker_clean}.JK"

    # ── 1. Ambil data historis ─────────────────────────────────────────────────
    raw = []

    # Jika period != 'db', download data historis penuh dari yfinance
    if req.period != "db":
        try:
            logging.info(f"[Backtest] Mengambil data historis {req.period} untuk {ticker_symbol} via yfinance ({market_type})...")
            yf_stock = yf.Ticker(ticker_symbol)
            yf_df = yf_stock.history(period=req.period, timeout=15)
            if not yf_df.empty and len(yf_df) >= 10:
                yf_df.index = pd.to_datetime(yf_df.index).date
                for d, r in yf_df.iterrows():
                    c = float(r["Close"])
                    o = float(r["Open"])
                    h = float(r["High"])
                    l = float(r["Low"])
                    v = float(r["Volume"])
                    raw.append({
                        "date":   str(d),
                        "open":   round(o, 4),
                        "high":   round(h, 4),
                        "low":    round(l, 4),
                        "close":  round(c, 4),
                        "volume": int(v),
                        "value":  round(c * v, 2),
                    })
                logging.info(f"[Backtest] Berhasil memuat {len(raw)} candle untuk {ticker_symbol} (sejak {raw[0]['date']})")
        except Exception as e:
            logging.warning(f"[Backtest] yfinance fetch gagal: {e}, fallback ke database lokal...")

    # Fallback ke database lokal jika yfinance kosong atau period == 'db' (hanya IDX)
    if not raw and market_type == "stocks_idx":
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT date, open, high, low, close, volume, value
                    FROM daily_prices
                    WHERE ticker IN (:t1, :t2, :t3)
                    ORDER BY date ASC
                """),
                {"t1": req.ticker, "t2": ticker_clean, "t3": ticker_jk}
            )
            raw = [dict(r) for r in rows.mappings()]

    market_labels = {
        "stocks_idx": "IDX (Bursa Efek Indonesia)",
        "crypto": "Crypto",
        "forex": "Forex",
        "commodity": "Commodity Futures",
        "index": "Market Index",
    }
    if not raw:
        return {
            "status": "error",
            "message": f"Tidak ada data historis untuk '{ticker_symbol}' di pasar {market_labels.get(market_type, market_type)}. Pastikan simbol valid.",
            "ticker": ticker_symbol,
        }

    df = pd.DataFrame(raw)
    df["date"] = df["date"].astype(str)
    df = df.sort_values("date").reset_index(drop=True)

    # Isi missing values & hitung metrik dasar
    df["volume"] = df["volume"].fillna(0).astype(float)
    df["close"]  = df["close"].astype(float)
    df["open"]   = df["open"].fillna(df["close"]).astype(float)
    df["high"]   = df["high"].fillna(df["close"]).astype(float)
    df["low"]    = df["low"].fillna(df["close"]).astype(float)
    if "value" not in df.columns or df["value"].isna().all():
        df["value"] = df["close"] * df["volume"]
    else:
        df["value"] = df["value"].fillna(df["close"] * df["volume"]).astype(float)

    # ── 2. Hitung Indikator & Deteksi Sinyal Berdasarkan Strategi ───────────────
    buy_signals_map  = {}   # date -> reason
    sell_signals_map = {}   # date -> reason
    strategy = req.strategy.lower()

    # Pre-calculate Common Indicators
    vol_ma20 = df["volume"].rolling(20).mean()
    typical_price = (df["high"] + df["low"] + df["close"]) / 3.0

    # 2.1. MACD Cross
    if strategy == "macd_cross":
        ema_f  = df["close"].ewm(span=req.macd_fast,   adjust=False).mean()
        ema_s  = df["close"].ewm(span=req.macd_slow,   adjust=False).mean()
        macd_l = ema_f - ema_s
        sig_l  = macd_l.ewm(span=req.macd_signal, adjust=False).mean()
        diff   = macd_l - sig_l

        for i in range(1, len(df)):
            prev_d = diff.iloc[i - 1]
            curr_d = diff.iloc[i]
            if pd.isna(prev_d) or pd.isna(curr_d): continue
            d_str = df["date"].iloc[i]
            if prev_d < 0 and curr_d >= 0:
                buy_signals_map[d_str] = f"MACD Golden Cross ({req.macd_fast},{req.macd_slow},{req.macd_signal})"
            elif prev_d > 0 and curr_d <= 0:
                sell_signals_map[d_str] = f"MACD Dead Cross ({req.macd_fast},{req.macd_slow},{req.macd_signal})"

    # 2.2. Triple MA
    elif strategy == "triple_ma":
        fn = (lambda s, p: s.rolling(p).mean()) if req.ma_type.upper() == "SMA" else \
             (lambda s, p: s.ewm(span=p, adjust=False).mean())
        m1 = fn(df["close"], req.ma1)
        m2 = fn(df["close"], req.ma2)
        m3 = fn(df["close"], req.ma3)

        for i in range(1, len(df)):
            v1, v2, v3 = m1.iloc[i], m2.iloc[i], m3.iloc[i]
            p1, p2, p3 = m1.iloc[i-1], m2.iloc[i-1], m3.iloc[i-1]
            if any(pd.isna(x) for x in [v1, v2, v3, p1, p2, p3]): continue
            d_str = df["date"].iloc[i]
            if v1 > v2 > v3 and not (p1 > p2 > p3):
                buy_signals_map[d_str] = f"Triple {req.ma_type} Aligned ({req.ma1}>{req.ma2}>{req.ma3})"
            elif v1 < v2 < v3 and not (p1 < p2 < p3):
                sell_signals_map[d_str] = f"Triple {req.ma_type} Death Align ({req.ma1}<{req.ma2}<{req.ma3})"

    # 2.3. Swing High Breakout
    elif strategy == "swing_high":
        sma20 = df["close"].rolling(20).mean()
        for i in range(req.swing_days, len(df)):
            lookback_high = df["high"].iloc[i - req.swing_days:i - 1].max()
            curr_c = df["close"].iloc[i]
            prev_c = df["close"].iloc[i - 1]
            d_str  = df["date"].iloc[i]
            if pd.isna(lookback_high): continue
            if curr_c > lookback_high and prev_c <= lookback_high:
                buy_signals_map[d_str] = f"Breakout Swing High {req.swing_days}D (High: {round(float(lookback_high), 0):,.0f})"
            sma_val = sma20.iloc[i]
            if not pd.isna(sma_val) and curr_c < sma_val and prev_c >= sma_val:
                sell_signals_map[d_str] = f"Close di bawah SMA20 ({round(float(sma_val), 0):,.0f})"

    # 2.4. Bandarmology (Volume Spike + Nilai Transaksi + Akumulasi)
    elif strategy == "bandarmology":
        ema20 = df["close"].ewm(span=20, adjust=False).mean()
        for i in range(20, len(df)):
            d_str = df["date"].iloc[i]
            c_close = df["close"].iloc[i]
            c_open  = df["open"].iloc[i]
            c_vol   = df["volume"].iloc[i]
            c_val   = df["value"].iloc[i]
            avg_vol = vol_ma20.iloc[i]
            p_close = df["close"].iloc[i-1]
            ret_1d  = ((c_close - p_close) / p_close) * 100 if p_close else 0

            # Syarat BUY: Volume Spike >= Multiplier * MA20, Nilai Transaksi >= Threshold, Bullish Candle
            if pd.notna(avg_vol) and avg_vol > 0:
                is_vol_spike = c_vol >= req.vol_spike_mult * avg_vol
                is_big_value = c_val >= req.min_trans_value
                is_bullish   = c_close > c_open and ret_1d >= 1.0

                if is_vol_spike and is_big_value and is_bullish:
                    vol_ratio = c_vol / avg_vol
                    val_m = c_val / 1_000_000_000
                    buy_signals_map[d_str] = f"Bandar Akumulasi: Vol {vol_ratio:.1f}x MA20 & Transaksi Rp {val_m:.1f}M (+{ret_1d:.1f}%)"

            # Syarat SELL: Breakdown di bawah EMA20 atau Distribusi Spike Bearish
            if pd.notna(ema20.iloc[i]):
                if c_close < ema20.iloc[i] and p_close >= ema20.iloc[i-1]:
                    sell_signals_map[d_str] = f"Breakdown di bawah EMA20 ({round(float(ema20.iloc[i]), 0):,.0f})"
                elif c_close < c_open and c_vol >= 1.8 * avg_vol:
                    sell_signals_map[d_str] = "Distribusi Volume Bearish Anomali"

    # 2.5. Rolling VWAP Breakout
    elif strategy == "vwap_breakout":
        # Rolling VWAP: sum(typical_price * volume) / sum(volume)
        tp_vol = typical_price * df["volume"]
        rolling_tp_vol = tp_vol.rolling(req.vwap_window).sum()
        rolling_vol    = df["volume"].rolling(req.vwap_window).sum()
        vwap_series    = rolling_tp_vol / rolling_vol

        for i in range(req.vwap_window, len(df)):
            d_str  = df["date"].iloc[i]
            curr_c = df["close"].iloc[i]
            prev_c = df["close"].iloc[i-1]
            curr_v = vwap_series.iloc[i]
            prev_v = vwap_series.iloc[i-1]
            avg_vol = vol_ma20.iloc[i]
            c_vol   = df["volume"].iloc[i]

            if pd.notna(curr_v) and pd.notna(prev_v):
                # Cross above VWAP dengan konfirmasi volume
                if prev_c <= prev_v and curr_c > curr_v and c_vol >= (avg_vol if pd.notna(avg_vol) else 0):
                    buy_signals_map[d_str] = f"Breakout ke atas VWAP ({round(float(curr_v), 0):,.0f}) + Vol Konfirmasi"
                # Cross below VWAP
                elif prev_c >= prev_v and curr_c < curr_v:
                    sell_signals_map[d_str] = f"Breakdown di bawah VWAP ({round(float(curr_v), 0):,.0f})"

    # 2.6. Bollinger Bands Breakout
    elif strategy == "bollinger_breakout":
        bb_mid   = df["close"].rolling(req.bb_period).mean()
        bb_std_v = df["close"].rolling(req.bb_period).std()
        bb_upper = bb_mid + (req.bb_std * bb_std_v)
        bb_lower = bb_mid - (req.bb_std * bb_std_v)

        for i in range(req.bb_period, len(df)):
            d_str  = df["date"].iloc[i]
            curr_c = df["close"].iloc[i]
            prev_c = df["close"].iloc[i-1]
            curr_u = bb_upper.iloc[i]
            prev_u = bb_upper.iloc[i-1]
            curr_m = bb_mid.iloc[i]

            if pd.notna(curr_u) and pd.notna(prev_u):
                if prev_c <= prev_u and curr_c > curr_u:
                    buy_signals_map[d_str] = f"Bollinger Bands Breakout Upper (+{req.bb_std} STD: {round(float(curr_u), 0):,.0f})"
                elif curr_c < curr_m and prev_c >= curr_m:
                    sell_signals_map[d_str] = f"Close di bawah BB Middle Line ({round(float(curr_m), 0):,.0f})"

    # ── 3. Simulasi Trading Harian dengan Risk Management (RR, TP, SL) ─────────
    # IDX: 1 lot = 100 lembar saham; Pasar lain (crypto/forex/commodity/index): 1 lot = 1 unit
    shares_per_lot = 100 if market_type == "stocks_idx" else 1
    capital        = req.initial_capital
    trades         = []
    equity_curve   = [{"date": df["date"].iloc[0], "value": round(capital, 0)}]
    chart_signals  = []  # list of {time, type: BUY/SELL/TP/SL, price, reason}

    in_position    = False
    buy_price      = 0.0
    buy_date       = ""
    buy_reason_str = ""
    cur_shares     = req.lot_size * shares_per_lot
    sl_price       = 0.0
    tp_price       = 0.0
    highest_since_entry = 0.0

    for i in range(len(df)):
        d_str   = df["date"].iloc[i]
        c_open  = df["open"].iloc[i]
        c_high  = df["high"].iloc[i]
        c_low   = df["low"].iloc[i]
        c_close = df["close"].iloc[i]

        # 3.1. Jika sedang HOLD posisi, cek trigger TP / SL / Trailing Stop terlebih dahulu
        if in_position:
            # Update Trailing Stop jika aktif
            if req.enable_trailing_stop:
                if c_high > highest_since_entry:
                    highest_since_entry = c_high
                trail_sl = round(highest_since_entry * (1.0 - (req.trailing_stop_pct / 100.0)), 0)
                if trail_sl > sl_price:
                    sl_price = trail_sl

            executed_exit = False
            exit_price    = 0.0
            exit_reason   = ""
            exit_type     = ""

            # Check A: Stop Loss Hit (Pessimistic: check SL first)
            if req.enable_tp_sl and c_low <= sl_price:
                # Harga keluar adalah SL price (atau Open jika gap down)
                exit_price  = min(c_open, sl_price)
                pct_loss    = ((exit_price - buy_price) / buy_price) * 100 if buy_price else 0
                exit_reason = f"SL Hit: Stop Loss terpicu di Rp {int(exit_price):,} ({pct_loss:+.2f}%)"
                exit_type   = "SL"
                executed_exit = True

            # Check B: Take Profit Hit
            elif req.enable_tp_sl and c_high >= tp_price:
                # Harga keluar adalah TP price (atau Open jika gap up)
                exit_price  = max(c_open, tp_price)
                pct_gain    = ((exit_price - buy_price) / buy_price) * 100 if buy_price else 0
                exit_reason = f"TP Hit: Target RR 1:{req.rr_ratio} tercapai di Rp {int(exit_price):,} ({pct_gain:+.2f}%)"
                exit_type   = "TP"
                executed_exit = True

            # Check C: Strategy Sell Signal
            elif d_str in sell_signals_map:
                exit_price  = c_close
                exit_reason = sell_signals_map[d_str]
                exit_type   = "SELL"
                executed_exit = True

            # Proses Penutupan Trade jika terjadi exit
            if executed_exit:
                revenue   = exit_price * cur_shares
                gross_pnl = revenue - (buy_price * cur_shares)
                pnl_pct   = ((exit_price - buy_price) / buy_price) * 100 if buy_price else 0
                capital  += revenue

                trades.append({
                    "no":          len(trades) + 1,
                    "buy_date":    buy_date,
                    "buy_price":   int(buy_price),
                    "buy_reason":  buy_reason_str,
                    "sell_date":   d_str,
                    "sell_price":  int(exit_price),
                    "sell_reason": exit_reason,
                    "exit_type":   exit_type,
                    "sl_target":   int(sl_price) if req.enable_tp_sl else None,
                    "tp_target":   int(tp_price) if req.enable_tp_sl else None,
                    "lots":        cur_shares // shares_per_lot,
                    "shares":      cur_shares,
                    "gross_pnl":   int(round(gross_pnl, 0)),
                    "pnl_pct":     round(pnl_pct, 2),
                    "result":      "WIN" if gross_pnl >= 0 else "LOSS",
                })
                chart_signals.append({
                    "time":   d_str,
                    "type":   exit_type,
                    "price":  int(exit_price),
                    "reason": exit_reason,
                })
                equity_curve.append({"date": d_str, "value": round(capital, 0)})
                in_position = False
                continue

        # 3.2. Jika TIDAK HOLD, cek apakah ada sinyal BUY hari ini
        if not in_position and d_str in buy_signals_map:
            buy_price = c_close
            max_lots  = int(capital // (buy_price * shares_per_lot))
            if max_lots <= 0:
                continue
            use_lots   = min(req.lot_size, max_lots)
            cur_shares = use_lots * shares_per_lot
            cost       = buy_price * cur_shares

            # Hitung SL & TP
            if req.enable_tp_sl:
                if req.sl_mode == "swing_low":
                    lookback_idx = max(0, i - 10)
                    swing_l = df["low"].iloc[lookback_idx:i].min() if i > 0 else buy_price * 0.95
                    sl_price = round(float(swing_l), 0)
                    sl_distance = max(10, buy_price - sl_price)
                    tp_price = round(buy_price + (sl_distance * req.rr_ratio), 0)
                else:  # fixed_pct
                    sl_price = round(buy_price * (1.0 - (req.sl_pct / 100.0)), 0)
                    tp_pct   = req.sl_pct * req.rr_ratio
                    tp_price = round(buy_price * (1.0 + (tp_pct / 100.0)), 0)
            else:
                sl_price = 0.0
                tp_price = 0.0

            highest_since_entry = c_high
            buy_date       = d_str
            buy_reason_str = buy_signals_map[d_str]
            capital       -= cost
            in_position    = True

            chart_signals.append({
                "time":   d_str,
                "type":   "BUY",
                "price":  int(buy_price),
                "reason": buy_reason_str,
            })
            equity_curve.append({"date": d_str, "value": round(capital + (cur_shares * buy_price), 0)})

    # Unrealized PnL jika di hari terakhir masih memegang posisi
    unrealized = 0.0
    last_price = float(df["close"].iloc[-1])
    if in_position:
        unrealized = (last_price - buy_price) * cur_shares
        equity_curve.append({"date": df["date"].iloc[-1], "value": round(capital + (cur_shares * last_price), 0)})

    # ── 4. Summary & Risk Management Metrics ──────────────────────────────────
    final_capital = float(equity_curve[-1]["value"]) if equity_curve else req.initial_capital
    net_pnl       = final_capital - req.initial_capital
    total_trades  = len(trades)
    win_trades    = [t for t in trades if t["result"] == "WIN"]
    loss_trades   = [t for t in trades if t["result"] == "LOSS"]
    win_rate      = round(len(win_trades) / total_trades * 100, 2) if total_trades else 0

    # Exit Breakdown (TP vs SL vs Signal)
    tp_count     = len([t for t in trades if t.get("exit_type") == "TP"])
    sl_count     = len([t for t in trades if t.get("exit_type") == "SL"])
    signal_count = len([t for t in trades if t.get("exit_type") in ("SELL", "SIGNAL")])

    # Profit Factor
    total_gain = sum(t["gross_pnl"] for t in win_trades)
    total_loss = abs(sum(t["gross_pnl"] for t in loss_trades))
    profit_factor = round(total_gain / total_loss, 2) if total_loss > 0 else (99.0 if total_gain > 0 else 0.0)

    # Max Drawdown
    peak   = req.initial_capital
    max_dd = 0.0
    for pt in equity_curve:
        v = pt["value"]
        if v > peak: peak = v
        dd = v - peak
        if dd < max_dd: max_dd = dd

    pnl_list = [t["gross_pnl"] for t in trades]
    hold_days_list = []
    for t in trades:
        try:
            hold_days_list.append((pd.Timestamp(t["sell_date"]) - pd.Timestamp(t["buy_date"])).days)
        except Exception:
            pass
    avg_hold_days = round(sum(hold_days_list) / len(hold_days_list), 1) if hold_days_list else 0

    summary = {
        "initial_capital": int(req.initial_capital),
        "final_capital":   int(round(final_capital, 0)),
        "net_pnl":         int(round(net_pnl, 0)),
        "net_pnl_pct":     round(net_pnl / req.initial_capital * 100, 2) if req.initial_capital else 0,
        "total_trades":    total_trades,
        "win_trades":      len(win_trades),
        "loss_trades":     len(loss_trades),
        "win_rate":        win_rate,
        "tp_count":        tp_count,
        "sl_count":        sl_count,
        "signal_count":    signal_count,
        "profit_factor":   profit_factor,
        "rr_setting":      f"1:{req.rr_ratio}",
        "max_drawdown":    int(round(max_dd, 0)),
        "best_trade":      int(round(max(pnl_list), 0)) if pnl_list else 0,
        "worst_trade":     int(round(min(pnl_list), 0)) if pnl_list else 0,
        "avg_hold_days":   avg_hold_days,
        "still_holding":   in_position,
        "unrealized_pnl":  int(round(unrealized, 0)) if in_position else 0,
        "start_date":      df["date"].iloc[0] if not df.empty else None,
        "end_date":        df["date"].iloc[-1] if not df.empty else None,
        "total_bars":      len(df),
        "period":          req.period,
    }

    # ── 5. Candles & Overlay Lines untuk Chart ────────────────────────────────
    candles = [
        {"time": r["date"], "open": round(float(r["open"]), 0), "high": round(float(r["high"]), 0),
         "low": round(float(r["low"]), 0), "close": round(float(r["close"]), 0),
         "volume": int(r["volume"]) if pd.notna(r["volume"]) else 0}
        for _, r in df.iterrows()
    ]

    def to_pts(dates, series):
        return [{"time": str(d), "value": round(float(v), 2)} for d, v in zip(dates, series) if pd.notna(v)]

    # Moving Average Lines
    fn_ma = (lambda s, p: s.rolling(p).mean()) if req.ma_type.upper() == "SMA" else \
            (lambda s, p: s.ewm(span=p, adjust=False).mean())
    ma1_s = fn_ma(df["close"], req.ma1)
    ma2_s = fn_ma(df["close"], req.ma2)
    ma3_s = fn_ma(df["close"], req.ma3)

    # MACD lines
    ef2 = df["close"].ewm(span=req.macd_fast, adjust=False).mean()
    es2 = df["close"].ewm(span=req.macd_slow, adjust=False).mean()
    ml2 = ef2 - es2
    sl2 = ml2.ewm(span=req.macd_signal, adjust=False).mean()
    h2  = ml2 - sl2

    # VWAP Line
    tp_vol = typical_price * df["volume"]
    vwap_s = tp_vol.rolling(req.vwap_window).sum() / df["volume"].rolling(req.vwap_window).sum()

    # Bollinger Bands
    bb_m = df["close"].rolling(req.bb_period).mean()
    bb_s = df["close"].rolling(req.bb_period).std()
    bb_u = bb_m + (req.bb_std * bb_s)
    bb_l = bb_m - (req.bb_std * bb_s)

    return {
        "status":      "success",
        "ticker":      ticker_symbol,
        "market_type": market_type,
        "strategy":    req.strategy,
        "candles":     candles,
        "ma_lines":    {"ma1": to_pts(df["date"], ma1_s), "ma2": to_pts(df["date"], ma2_s), "ma3": to_pts(df["date"], ma3_s)},
        "macd": {
            "macd_line":   to_pts(df["date"], ml2),
            "signal_line": to_pts(df["date"], sl2),
            "histogram":   [{"time": str(d), "value": round(float(v), 4), "color": "#22c55e" if v >= 0 else "#ef4444"}
                            for d, v in zip(df["date"], h2) if pd.notna(v)],
        },
        "vwap":     to_pts(df["date"], vwap_s),
        "bollinger": {
            "upper":  to_pts(df["date"], bb_u),
            "middle": to_pts(df["date"], bb_m),
            "lower":  to_pts(df["date"], bb_l),
        },
        "meta": {
            "ma_type": req.ma_type, "ma1": req.ma1, "ma2": req.ma2, "ma3": req.ma3,
            "macd_fast": req.macd_fast, "macd_slow": req.macd_slow, "macd_signal": req.macd_signal,
            "vwap_window": req.vwap_window, "bb_period": req.bb_period, "bb_std": req.bb_std,
            "enable_tp_sl": req.enable_tp_sl, "rr_ratio": req.rr_ratio, "sl_pct": req.sl_pct,
        },
        "signals":      chart_signals,
        "trades":       trades,
        "equity_curve": equity_curve,
        "summary":      summary,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info",
    )