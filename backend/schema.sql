-- Tabel Master Saham
CREATE TABLE IF NOT EXISTS stocks (
    symbol VARCHAR(12) PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    name VARCHAR(255),
    sector VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stocks_ticker ON stocks(ticker);

-- Tabel Harga & Indikator Harian
CREATE TABLE IF NOT EXISTS daily_prices (
    ticker VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    open NUMERIC(12, 2),
    high NUMERIC(12, 2),
    low NUMERIC(12, 2),
    close NUMERIC(12, 2),
    volume BIGINT NOT NULL DEFAULT 0,
    value NUMERIC(20, 2),
    return_1d NUMERIC(6, 2),
    volume_ma20 NUMERIC(18, 2),
    rsi_14 NUMERIC(6, 2),
    ema_5 NUMERIC(12, 2),
    ema_20 NUMERIC(12, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (ticker, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_prices_lookup 
ON daily_prices (date DESC, value DESC, volume_ma20);