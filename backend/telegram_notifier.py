import os
import json
import logging
import urllib.request
import urllib.parse
from datetime import datetime, timezone, timedelta

WIB = timezone(timedelta(hours=7))

logger = logging.getLogger("telegram_notifier")

# Cache anti-spam: (ticker, date_str)
_sent_alerts_cache = set()
_last_cache_date = None

def get_telegram_config():
    """Ambil konfigurasi Telegram terkini dari environment."""
    return {
        "bot_token": os.getenv("TELEGRAM_BOT_TOKEN", "").strip(),
        "chat_id":   os.getenv("TELEGRAM_CHAT_ID", "").strip(),
        "enabled":   os.getenv("TELEGRAM_ENABLED", "true").lower() in ("true", "1", "yes"),
        "mode":      os.getenv("TELEGRAM_MODE", "grouped").strip().lower(), # "grouped" | "individual"
    }

def update_telegram_env(bot_token: str, chat_id: str, enabled: bool, mode: str = "grouped"):
    """Simpan konfigurasi Telegram ke file .env dan update runtime os.environ."""
    os.environ["TELEGRAM_BOT_TOKEN"] = bot_token
    os.environ["TELEGRAM_CHAT_ID"]   = chat_id
    os.environ["TELEGRAM_ENABLED"]   = "true" if enabled else "false"
    os.environ["TELEGRAM_MODE"]      = mode if mode in ("grouped", "individual") else "grouped"

    env_path = os.path.join(os.path.dirname(__file__), ".env")
    lines = []
    keys_found = {
        "TELEGRAM_BOT_TOKEN": False,
        "TELEGRAM_CHAT_ID": False,
        "TELEGRAM_ENABLED": False,
        "TELEGRAM_MODE": False,
    }

    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                key = line.split("=")[0].strip() if "=" in line else ""
                if key == "TELEGRAM_BOT_TOKEN":
                    lines.append(f"TELEGRAM_BOT_TOKEN={bot_token}\n")
                    keys_found[key] = True
                elif key == "TELEGRAM_CHAT_ID":
                    lines.append(f"TELEGRAM_CHAT_ID={chat_id}\n")
                    keys_found[key] = True
                elif key == "TELEGRAM_ENABLED":
                    lines.append(f"TELEGRAM_ENABLED={'true' if enabled else 'false'}\n")
                    keys_found[key] = True
                elif key == "TELEGRAM_MODE":
                    lines.append(f"TELEGRAM_MODE={os.environ['TELEGRAM_MODE']}\n")
                    keys_found[key] = True
                else:
                    lines.append(line if line.endswith('\n') else f"{line}\n")


    for k, found in keys_found.items():
        if not found:
            if k == "TELEGRAM_BOT_TOKEN":
                val = bot_token
            elif k == "TELEGRAM_CHAT_ID":
                val = chat_id
            elif k == "TELEGRAM_ENABLED":
                val = "true" if enabled else "false"
            else:
                val = os.environ["TELEGRAM_MODE"]
            lines.append(f"{k}={val}\n")

    with open(env_path, "w", encoding="utf-8") as f:
        f.writelines(lines)

def send_telegram_message(text: str, bot_token: str = None, chat_id: str = None) -> tuple[bool, str]:
    """Kirim pesan teks ke Telegram menggunakan Telegram Bot API (HTML mode)."""
    cfg = get_telegram_config()
    token = bot_token or cfg["bot_token"]
    cid   = chat_id or cfg["chat_id"]

    if not token or not cid:
        return False, "Bot Token atau Chat ID belum diatur."

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": cid,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": False,
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode())
            if result.get("ok"):
                return True, "Pesan berhasil dikirim."
            return False, result.get("description", "Unknown error dari Telegram")
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode()
        logger.error(f"HTTPError Telegram: {err_msg}")
        return False, f"Telegram API Error ({e.code}): {err_msg}"
    except Exception as e:
        logger.error(f"Error mengirim pesan Telegram: {e}")
        return False, str(e)

def format_single_stock_alert(stock: dict) -> str:
    """Format alert 1 saham (mode dipisah-pisah / per bubble)."""
    ticker   = stock.get("ticker", "UNKNOWN").replace(".JK", "")
    name     = stock.get("name", "Emiten IHSG")
    sector   = stock.get("sector", "Lainnya")
    price    = stock.get("price", 0)
    ret_1d   = stock.get("return_1d", 0)
    vol_rat  = stock.get("vol_ratio", 1.0)
    rsi      = stock.get("rsi", "--")
    signals  = stock.get("signals", ["BULLISH"])
    now_str  = datetime.now(WIB).strftime("%d %b %Y, %H:%M WIB")

    ret_sign = "+" if ret_1d >= 0 else ""
    tv_url   = f"https://id.tradingview.com/chart/?symbol=IDX:{ticker}"

    signals_formatted = "\n".join([f"  • 🟢 <b>{s}</b>" for s in signals])

    msg = (
        f"🚨 <b>IHSG ALERT — SINYAL BUY TERDETEKSI</b> 🚨\n\n"
        f"🏢 <b>{ticker}</b> ({name})\n"
        f"🏷️ Sektor: <code>{sector}</code>\n"
        f"💵 Harga: <b>Rp {price:,.0f}</b> ({ret_sign}{ret_1d:.2f}%)\n"
        f"📊 Volume: <b>{vol_rat:.1f}x</b> MA20 | RSI(14): <b>{rsi}</b>\n\n"
        f"🎯 <b>Sinyal Teknikal:</b>\n"
        f"{signals_formatted}\n\n"
        f"⏰ <i>{now_str}</i>\n"
        f"🔗 <a href='{tv_url}'>Buka Chart di TradingView</a>"
    )
    return msg

def format_grouped_stock_alerts(stocks: list) -> str:
    """Format kumpulan saham menjadi SATU bubble chat ringkas dan padat."""
    now_str = datetime.now(WIB).strftime("%d %b %Y, %H:%M WIB")
    total = len(stocks)

    lines = [
        f"🚨 <b>IHSG ALERT — {total} SAHAM MEMICU SINYAL BUY</b> 🚨",
        f"⏰ <i>{now_str}</i>",
        "━━━━━━━━━━━━━━━━━━━━━━",
        ""
    ]

    for idx, stock in enumerate(stocks, 1):
        ticker   = stock.get("ticker", "UNKNOWN").replace(".JK", "")
        name     = stock.get("name", "Emiten IHSG")
        price    = stock.get("price", 0)
        ret_1d   = stock.get("return_1d", 0)
        vol_rat  = stock.get("vol_ratio", 1.0)
        rsi      = stock.get("rsi", "--")
        signals  = stock.get("signals", ["BULLISH"])
        ret_sign = "+" if ret_1d >= 0 else ""
        tv_url   = f"https://id.tradingview.com/chart/?symbol=IDX:{ticker}"

        sig_text = " • ".join(signals[:2])

        item_block = (
            f"<b>{idx}. {ticker}</b> — {name}\n"
            f"   💵 <b>Rp {price:,.0f}</b> ({ret_sign}{ret_1d:.2f}%) | Vol: <b>{vol_rat:.1f}x</b> | RSI: <b>{rsi}</b>\n"
            f"   🎯 <i>{sig_text}</i>\n"
            f"   🔗 <a href='{tv_url}'>Lihat Chart TradingView</a>\n"
        )
        lines.append(item_block)

    lines.append("━━━━━━━━━━━━━━━━━━━━━━")
    lines.append("💡 <i>Kirim otomatis dari IHSG Screener Bot</i>")

    return "\n".join(lines)

def send_alert_for_stocks(candidates: list) -> int:
    """
    Periksa kandidat saham yang punya sinyal dan kirim notifikasi Telegram.
    Mendukung 2 Mode:
    - 'grouped': Dirangkum menjadi 1 bubble chat
    - 'individual': Dikirim terpisah per emiten
    Menggunakan anti-spam cache agar 1 emiten tidak dikirim berkali-kali di hari yang sama.
    """
    global _sent_alerts_cache, _last_cache_date

    cfg = get_telegram_config()
    if not cfg["enabled"] or not cfg["bot_token"] or not cfg["chat_id"]:
        return 0

    today_str = datetime.now(WIB).strftime("%Y-%m-%d")

    # Reset cache jika hari sudah berganti
    if _last_cache_date != today_str:
        _sent_alerts_cache.clear()
        _last_cache_date = today_str

    # Filter kandidat yang belum pernah dikirim hari ini
    to_send = []
    for stock in candidates:
        ticker = stock.get("ticker", "").replace(".JK", "")
        signals = stock.get("signals", [])
        if not signals:
            continue

        cache_key = (ticker, today_str)
        if cache_key in _sent_alerts_cache:
            continue

        to_send.append(stock)

    if not to_send:
        return 0

    mode = cfg.get("mode", "grouped")

    # ── MODE 1: RANGKAP JADI 1 BUBBLE ──────────────────────────────────────────
    if mode == "grouped":
        # Pecah per 8 saham per bubble jika banyak untuk menghindari limit 4096 char Telegram
        chunk_size = 8
        sent_total = 0
        for i in range(0, len(to_send), chunk_size):
            chunk = to_send[i:i+chunk_size]
            msg = format_grouped_stock_alerts(chunk)
            ok, reason = send_telegram_message(msg)
            if ok:
                for s in chunk:
                    t = s.get("ticker", "").replace(".JK", "")
                    _sent_alerts_cache.add((t, today_str))
                sent_total += len(chunk)
                logger.info(f"[Telegram Grouped Alert] Berhasil kirim {len(chunk)} emiten dalam 1 bubble.")
            else:
                logger.warning(f"[Telegram Grouped Alert] Gagal kirim: {reason}")
        return sent_total

    # ── MODE 2: TERPISAH PER EMITEN ────────────────────────────────────────────
    else:
        sent_count = 0
        for stock in to_send:
            ticker = stock.get("ticker", "").replace(".JK", "")
            msg = format_single_stock_alert(stock)
            ok, reason = send_telegram_message(msg)
            if ok:
                _sent_alerts_cache.add((ticker, today_str))
                sent_count += 1
                logger.info(f"[Telegram Alert] Terkirim untuk {ticker}")
            else:
                logger.warning(f"[Telegram Alert] Gagal kirim untuk {ticker}: {reason}")
        return sent_count

def test_telegram_connection(bot_token: str = None, chat_id: str = None, mode: str = "grouped") -> tuple[bool, str]:
    """Kirim pesan test ke Telegram sesuai mode yang dipilih (grouped atau individual)."""
    now_str = datetime.now(WIB).strftime("%d %b %Y, %H:%M:%S WIB")

    if mode == "grouped":
        # Simulasi tampilan rangkap 1 bubble
        sample_stocks = [
            {
                "ticker": "BBCA",
                "name": "Bank Central Asia Tbk",
                "price": 9850,
                "return_1d": 2.60,
                "vol_ratio": 2.4,
                "rsi": 61.5,
                "signals": ["MACD Golden Cross", "Triple EMA Aligned"],
            },
            {
                "ticker": "ANTM",
                "name": "Aneka Tambang Tbk",
                "price": 1620,
                "return_1d": 3.85,
                "vol_ratio": 1.9,
                "rsi": 64.2,
                "signals": ["Breakout Swing High 20D"],
            }
        ]
        sample_body = format_grouped_stock_alerts(sample_stocks)
        test_msg = (
            f"✅ <b>IHSG Screener Bot — Tes Mode Rangkap 1 Bubble</b>\n\n"
            f"Ini adalah contoh tampilan notifikasi ketika mode <b>'Rangkap 1 Bubble'</b> aktif.\n\n"
            f"{sample_body}"
        )
    else:
        # Simulasi tampilan pesan tunggal per emiten
        sample_stock = {
            "ticker": "BBCA",
            "name": "Bank Central Asia Tbk",
            "sector": "Keuangan",
            "price": 9850,
            "return_1d": 2.60,
            "vol_ratio": 2.4,
            "rsi": 61.5,
            "signals": ["MACD Golden Cross", "Triple EMA Aligned"],
        }
        sample_body = format_single_stock_alert(sample_stock)
        test_msg = (
            f"✅ <b>IHSG Screener Bot — Tes Mode Pesan Terpisah</b>\n\n"
            f"Ini adalah contoh tampilan notifikasi ketika mode <b>'Pesan Terpisah per Emiten'</b> aktif:\n\n"
            f"{sample_body}"
        )

    return send_telegram_message(test_msg, bot_token=bot_token, chat_id=chat_id)
