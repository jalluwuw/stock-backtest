import os
import sys
import logging
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import pandas as pd
import numpy as np
import yfinance as yf
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "stock_screener_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "12345678")

DATABASE_URL = f"postgresql+psycopg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=15, max_overflow=20)

DEFAULT_TICKERS = [
    "BBCA.JK", "BBRI.JK", "BMRI.JK", "BBNI.JK", "TLKM.JK", 
    "ASII.JK", "AMMN.JK", "BREN.JK", "TPIA.JK", "PGAS.JK", 
    "UNTR.JK", "MEDC.JK", "ADRO.JK", "ANTM.JK", "CPIN.JK", 
    "GOTO.JK", "ICBP.JK", "INDF.JK", "KLBF.JK", "MDKA.JK"
]

def get_all_tickers():
    """Mengambil seluruh daftar ticker aktif dari tabel stocks di database."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT symbol FROM stocks WHERE is_active = TRUE ORDER BY symbol ASC"))
            symbols = [row[0] for row in result.fetchall()]
            if symbols:
                return symbols
    except Exception as e:
        logging.warning(f"Gagal mengambil tickers dari DB, fallback ke default: {e}")
    return DEFAULT_TICKERS

def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.rolling(window=period).mean()
    avg_loss = loss.rolling(window=period).mean()
    rs = avg_gain / (avg_loss + 1e-10)
    return 100 - (100 / (1 + rs))

def process_and_store(symbol: str) -> bool:
    """Download data 60 hari terakhir dan simpan indikator teknikal ke DB."""
    try:
        stock = yf.Ticker(symbol)
        df = stock.history(period="100d", timeout=10)
        if df.empty or len(df) < 20:
            return False

        df.index = pd.to_datetime(df.index).date
        df['ticker'] = symbol.replace('.JK', '')
        df['date'] = df.index
        df['close'] = df['Close']
        df['open'] = df['Open']
        df['high'] = df['High']
        df['low'] = df['Low']
        df['volume'] = df['Volume'].astype(int)
        
        df['value'] = df['close'] * df['volume']
        df['return_1d'] = df['close'].pct_change() * 100
        df['volume_ma20'] = df['volume'].rolling(window=20).mean()
        df['rsi_14'] = calculate_rsi(df['close'], 14)
        df['ema_5'] = df['close'].ewm(span=5, adjust=False).mean()
        df['ema_20'] = df['close'].ewm(span=20, adjust=False).mean()

        df_to_save = df.tail(60).replace({np.nan: None, np.inf: None, -np.inf: None})

        upsert_query = text("""
            INSERT INTO daily_prices (
                ticker, date, open, high, low, close, volume, 
                value, return_1d, volume_ma20, rsi_14, ema_5, ema_20, updated_at
            ) VALUES (
                :ticker, :date, :open, :high, :low, :close, :volume, 
                :value, :return_1d, :volume_ma20, :rsi_14, :ema_5, :ema_20, NOW()
            )
            ON CONFLICT (ticker, date) DO UPDATE SET
                open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
                close = EXCLUDED.close, volume = EXCLUDED.volume, value = EXCLUDED.value,
                return_1d = EXCLUDED.return_1d, volume_ma20 = EXCLUDED.volume_ma20,
                rsi_14 = EXCLUDED.rsi_14, ema_5 = EXCLUDED.ema_5, ema_20 = EXCLUDED.ema_20,
                updated_at = NOW();
        """)

        records = [
            {
                "ticker": str(r['ticker']), "date": r['date'],
                "open": float(r['open']) if r['open'] else None,
                "high": float(r['high']) if r['high'] else None,
                "low": float(r['low']) if r['low'] else None,
                "close": float(r['close']) if r['close'] else None,
                "volume": int(r['volume']) if r['volume'] else 0,
                "value": float(r['value']) if r['value'] else 0.0,
                "return_1d": float(r['return_1d']) if r['return_1d'] else None,
                "volume_ma20": float(r['volume_ma20']) if r['volume_ma20'] else None,
                "rsi_14": float(r['rsi_14']) if r['rsi_14'] else None,
                "ema_5": float(r['ema_5']) if r['ema_5'] else None,
                "ema_20": float(r['ema_20']) if r['ema_20'] else None,
            } for _, r in df_to_save.iterrows()
        ]

        with engine.begin() as conn:
            conn.execute(upsert_query, records)
        return True
    except Exception as e:
        return False

def sync_all_stocks_parallel(tickers=None, max_workers: int = 10, status_dict=None):
    """Sinkronisasi seluruh saham menggunakan ThreadPoolExecutor untuk kecepatan maksimal."""
    if tickers is None:
        tickers = get_all_tickers()

    total = len(tickers)
    logging.info(f"=== [Batch Sync] Memulai sync {total} emiten dengan {max_workers} thread ===")

    success_count = 0
    fail_count = 0
    completed = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_symbol = {executor.submit(process_and_store, sym): sym for sym in tickers}

        for future in as_completed(future_to_symbol):
            completed += 1
            is_success = future.result()
            if is_success:
                success_count += 1
            else:
                fail_count += 1

            if status_dict is not None:
                status_dict["progress"] = f"{completed}/{total}"
                status_dict["success"] = success_count

            # Log setiap 100 ticker
            if completed % 100 == 0 or completed == total:
                pct = int((completed / total) * 100)
                logging.info(f"[Batch Sync Progress] {completed}/{total} ({pct}%) - Sukses: {success_count}, Nonaktif/Lewat: {fail_count}")

    logging.info(f"=== [Batch Sync Selesai] Total: {total} | Sukses: {success_count} | Nonaktif/Skip: {fail_count} ===")
    return success_count, fail_count

if __name__ == "__main__":
    symbols = get_all_tickers()
    print(f"Total tickers to sync: {len(symbols)}")
    sync_all_stocks_parallel(symbols, max_workers=12)