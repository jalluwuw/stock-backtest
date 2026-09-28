import os
import io
import urllib.request
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "stock_screener_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "12345678")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

def fetch_idx_stocks():
    print("Fetching master data seluruh saham BEI dari Wikipedia...")
    url = "https://id.wikipedia.org/wiki/Daftar_perusahaan_yang_tercatat_di_Bursa_Efek_Indonesia"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    )
    html = urllib.request.urlopen(req, timeout=20).read().decode("utf-8")
    tables = pd.read_html(io.StringIO(html))
    df = tables[0]

    # Bersihkan data
    # Kolom: ['No', 'Kode', 'Nama perusahaan', 'Tanggal pencatatan', 'Jumlah Saham', 'Papan pencatatan', 'Sektor']
    stocks = []
    for _, row in df.iterrows():
        raw_code = str(row.get("Kode", "")).replace("BEI: ", "").strip()
        if not raw_code or len(raw_code) > 6:
            continue
        ticker = raw_code.upper()
        symbol = f"{ticker}.JK"
        name = str(row.get("Nama perusahaan", "")).strip()
        sector = str(row.get("Sektor", "")).strip() if pd.notna(row.get("Sektor")) else None

        stocks.append({
            "symbol": symbol,
            "ticker": ticker,
            "name": name,
            "sector": sector,
        })
    return stocks

def seed_to_database(stocks):
    print(f"Menyimpan {len(stocks)} saham ke tabel 'stocks'...")
    upsert_query = text("""
        INSERT INTO stocks (symbol, ticker, name, sector, is_active, created_at)
        VALUES (:symbol, :ticker, :name, :sector, TRUE, NOW())
        ON CONFLICT (symbol) DO UPDATE SET
            ticker = EXCLUDED.ticker,
            name = EXCLUDED.name,
            sector = EXCLUDED.sector,
            is_active = TRUE;
    """)

    with engine.begin() as conn:
        conn.execute(upsert_query, stocks)

    print(f"Berhasil menyimpan {len(stocks)} emiten ke database!")

if __name__ == "__main__":
    stock_list = fetch_idx_stocks()
    seed_to_database(stock_list)
