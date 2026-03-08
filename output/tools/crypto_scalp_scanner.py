#!/usr/bin/env python3
"""
crypto_scalp_scanner.py
=======================
A lightweight CLI tool that scans Binance spot pairs for scalp trade setups.
Uses SMA crossover + volume spike detection to surface high-probability entries.

SELLABLE: $24.99 on Gumroad | Useful for day-traders automating their watchlist.

Usage:
    python crypto_scalp_scanner.py --pairs BTC ETH SOL BNB --timeframe 15m
    python crypto_scalp_scanner.py --top 20   # scan top-20 USDT pairs by volume

Requirements:
    pip install requests pandas colorama tabulate

Author: AutonomousAI
"""

import argparse
import time
import sys
from datetime import datetime

try:
    import requests
    import pandas as pd
    from colorama import Fore, Style, init
    from tabulate import tabulate
    init(autoreset=True)
except ImportError:
    print("Missing deps. Run: pip install requests pandas colorama tabulate")
    sys.exit(1)

BASE_URL = "https://api.binance.com"

# ─────────────────────────────────────────────
# DATA FETCHING
# ─────────────────────────────────────────────

def get_klines(symbol: str, interval: str = "15m", limit: int = 50) -> pd.DataFrame:
    """Fetch OHLCV candles from Binance public API."""
    url = f"{BASE_URL}/api/v3/klines"
    params = {"symbol": symbol, "interval": interval, "limit": limit}
    r = requests.get(url, params=params, timeout=10)
    r.raise_for_status()
    data = r.json()
    df = pd.DataFrame(data, columns=[
        "open_time","open","high","low","close","volume",
        "close_time","quote_vol","trades","taker_base","taker_quote","ignore"
    ])
    for col in ["open","high","low","close","volume","quote_vol"]:
        df[col] = df[col].astype(float)
    df["open_time"] = pd.to_datetime(df["open_time"], unit="ms")
    return df


def get_top_usdt_pairs(n: int = 20) -> list:
    """Return top N USDT pairs sorted by 24h quote volume."""
    url = f"{BASE_URL}/api/v3/ticker/24hr"
    r = requests.get(url, timeout=10)
    r.raise_for_status()
    tickers = r.json()
    usdt = [t for t in tickers if t["symbol"].endswith("USDT") and float(t["quoteVolume"]) > 0]
    usdt.sort(key=lambda x: float(x["quoteVolume"]), reverse=True)
    return [t["symbol"] for t in usdt[:n]]


# ─────────────────────────────────────────────
# INDICATORS
# ─────────────────────────────────────────────

def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Add SMA9, SMA20, RSI14, volume z-score to dataframe."""
    df = df.copy()
    df["sma9"]  = df["close"].rolling(9).mean()
    df["sma20"] = df["close"].rolling(20).mean()

    # RSI
    delta = df["close"].diff()
    gain  = delta.clip(lower=0).rolling(14).mean()
    loss  = (-delta.clip(upper=0)).rolling(14).mean()
    rs    = gain / loss.replace(0, 1e-9)
    df["rsi"] = 100 - (100 / (1 + rs))

    # Volume z-score (how unusual is current volume?)
    vol_mean = df["volume"].rolling(20).mean()
    vol_std  = df["volume"].rolling(20).std().replace(0, 1e-9)
    df["vol_z"] = (df["volume"] - vol_mean) / vol_std

    # ATR (simple)
    hl  = df["high"] - df["low"]
    hcp = (df["high"] - df["close"].shift()).abs()
    lcp = (df["low"]  - df["close"].shift()).abs()
    df["atr"] = pd.concat([hl, hcp, lcp], axis=1).max(axis=1).rolling(14).mean()

    return df


# ─────────────────────────────────────────────
# SIGNAL DETECTION
# ─────────────────────────────────────────────

SIGNAL_LONG  = "🟢 LONG"
SIGNAL_SHORT = "🔴 SHORT"
SIGNAL_NONE  = "⚪ WAIT"

def detect_signal(df: pd.DataFrame) -> dict:
    """
    Strategy:
    - LONG  if SMA9 > SMA20 AND RSI 40-65 AND vol_z > 0.5
    - SHORT if SMA9 < SMA20 AND RSI 35-60 AND vol_z > 0.5
    Returns dict with signal, entry, target, stop, risk/reward.
    """
    last  = df.iloc[-1]
    prev  = df.iloc[-2]

    price  = last["close"]
    sma9   = last["sma9"]
    sma20  = last["sma20"]
    rsi    = last["rsi"]
    vol_z  = last["vol_z"]
    atr    = last["atr"]

    signal = SIGNAL_NONE
    target = stop = 0.0

    if sma9 > sma20 and 40 <= rsi <= 65 and vol_z > 0.5:
        signal = SIGNAL_LONG
        target = round(price + 1.5 * atr, 6)
        stop   = round(price - 1.0 * atr, 6)

    elif sma9 < sma20 and 35 <= rsi <= 60 and vol_z > 0.5:
        signal = SIGNAL_SHORT
        target = round(price - 1.5 * atr, 6)
        stop   = round(price + 1.0 * atr, 6)

    rr = round(abs(target - price) / abs(stop - price), 2) if stop != price else 0

    return {
        "price":  round(price, 6),
        "sma9":   round(sma9, 4),
        "sma20":  round(sma20, 4),
        "rsi":    round(rsi, 1),
        "vol_z":  round(vol_z, 2),
        "signal": signal,
        "target": target,
        "stop":   stop,
        "rr":     rr,
    }


# ─────────────────────────────────────────────
# SCANNER
# ─────────────────────────────────────────────

def scan_pairs(pairs: list, interval: str = "15m") -> list:
    results = []
    for symbol in pairs:
        try:
            df   = get_klines(symbol, interval)
            df   = add_indicators(df)
            sig  = detect_signal(df)
            sig["symbol"] = symbol
            results.append(sig)
            time.sleep(0.08)   # gentle rate-limit
        except Exception as e:
            results.append({"symbol": symbol, "signal": f"ERR: {e}"})
    return results


def format_results(results: list) -> str:
    rows = []
    for r in results:
        if "price" not in r:
            rows.append([r["symbol"], r["signal"], "-","-","-","-","-","-"])
            continue
        sig_color = {
            SIGNAL_LONG:  Fore.GREEN,
            SIGNAL_SHORT: Fore.RED,
            SIGNAL_NONE:  Fore.WHITE,
        }.get(r["signal"], Fore.WHITE)

        rows.append([
            Fore.CYAN  + r["symbol"]          + Style.RESET_ALL,
            sig_color  + r["signal"]           + Style.RESET_ALL,
            r["price"],
            r["rsi"],
            r["vol_z"],
            r["target"],
            r["stop"],
            r["rr"],
        ])

    headers = ["Symbol","Signal","Price","RSI","VolZ","Target","Stop","R:R"]
    return tabulate(rows, headers=headers, tablefmt="rounded_outline", floatfmt=".4f")


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Binance Scalp Scanner")
    parser.add_argument("--pairs",     nargs="+", default=[], help="e.g. BTC ETH SOL")
    parser.add_argument("--top",       type=int,  default=0,  help="Scan top N USDT pairs by volume")
    parser.add_argument("--timeframe", default="15m",         help="Candle interval (1m 5m 15m 1h)")
    parser.add_argument("--only-signals", action="store_true", help="Only show LONG/SHORT rows")
    args = parser.parse_args()

    pairs = []
    if args.top > 0:
        print(f"📡 Fetching top {args.top} USDT pairs by volume…")
        pairs = get_top_usdt_pairs(args.top)
    elif args.pairs:
        pairs = [p.upper() + "USDT" if not p.upper().endswith("USDT") else p.upper()
                 for p in args.pairs]
    else:
        pairs = ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","AVAXUSDT","DOTUSDT","LINKUSDT","MATICUSDT"]

    print(f"\n🔍 Scanning {len(pairs)} pairs on {args.timeframe} | {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n")
    results = scan_pairs(pairs, args.timeframe)

    if args.only_signals:
        results = [r for r in results if r.get("signal") in (SIGNAL_LONG, SIGNAL_SHORT)]

    if not results:
        print("No signals found. Try --timeframe 5m or scan more pairs.")
    else:
        print(format_results(results))
        longs  = sum(1 for r in results if r.get("signal") == SIGNAL_LONG)
        shorts = sum(1 for r in results if r.get("signal") == SIGNAL_SHORT)
        print(f"\n✅ {longs} LONG  |  🔻 {shorts} SHORT  |  ⚪ {len(results)-longs-shorts} WAIT\n")


if __name__ == "__main__":
    main()
