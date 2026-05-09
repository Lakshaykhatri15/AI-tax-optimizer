"""
Price Sync Service
==================
Fetches current market prices from NSE/BSE via yfinance (free, no API key needed).
Falls back to Yahoo Finance suffix mapping for Indian stocks.

In production: replace with Zerodha Kite API or a paid data vendor.
Run as a background task (APScheduler) every 15 minutes during market hours.
"""

import asyncio
import logging
from datetime import datetime, date, time
from typing import Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)

# NSE market hours (IST = UTC+5:30)
MARKET_OPEN  = time(9, 15)
MARKET_CLOSE = time(15, 30)


def is_market_open() -> bool:
    """Check if NSE is currently trading."""
    now_ist = datetime.utcnow()
    current_time = now_ist.time()
    weekday = now_ist.weekday()
    if weekday >= 5:  # Saturday / Sunday
        return False
    return MARKET_OPEN <= current_time <= MARKET_CLOSE


def nse_symbol_to_yf(symbol: str) -> str:
    """Convert NSE symbol to Yahoo Finance ticker. E.g. RELIANCE → RELIANCE.NS"""
    symbol = symbol.upper().strip()
    # Some special mappings
    mappings = {
        "M&M":       "M&M.NS",
        "L&TFH":     "L&TFH.NS",
        "NIFTY50":   "^NSEI",
        "SENSEX":    "^BSESN",
    }
    return mappings.get(symbol, f"{symbol}.NS")


async def fetch_price_yfinance(symbols: List[str]) -> Dict[str, float]:
    """
    Fetch current prices from Yahoo Finance for a batch of NSE symbols.
    Returns {symbol: price} dict. Missing symbols are omitted.
    """
    prices: Dict[str, float] = {}
    yf_map = {nse_symbol_to_yf(s): s for s in symbols}
    tickers = " ".join(yf_map.keys())

    url = f"https://query1.finance.yahoo.com/v7/finance/quote"
    params = {"symbols": tickers, "fields": "regularMarketPrice,symbol"}
    headers = {"User-Agent": "Mozilla/5.0"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            for result in data.get("quoteResponse", {}).get("result", []):
                yf_ticker = result.get("symbol", "")
                price = result.get("regularMarketPrice")
                if yf_ticker in yf_map and price:
                    original_symbol = yf_map[yf_ticker]
                    prices[original_symbol] = float(price)
    except Exception as e:
        logger.warning(f"Price fetch failed: {e}")

    return prices


async def fetch_price_single(symbol: str) -> Optional[float]:
    """Fetch price for a single symbol. Returns None on failure."""
    result = await fetch_price_yfinance([symbol])
    return result.get(symbol)


async def sync_portfolio_prices(portfolio_id: int, db) -> Dict[str, float]:
    """
    Fetch and update current prices for all holdings in a portfolio.
    Returns updated {symbol: price} map.
    """
    from app.models.models import Holding

    holdings = db.query(Holding).filter(Holding.portfolio_id == portfolio_id).all()
    if not holdings:
        return {}

    symbols = list({h.symbol for h in holdings})
    prices = await fetch_price_yfinance(symbols)

    if prices:
        updated_at = datetime.utcnow()
        for h in holdings:
            if h.symbol in prices:
                h.current_price = prices[h.symbol]
                h.last_price_updated = updated_at
        db.commit()
        logger.info(f"Updated prices for {len(prices)} symbols in portfolio {portfolio_id}")

    return prices


class PriceSyncScheduler:
    """
    APScheduler-based background price sync.
    Runs every 15 minutes during NSE market hours.
    """

    def __init__(self, db_session_factory):
        self.db_factory = db_session_factory
        self._scheduler = None

    def start(self):
        try:
            from apscheduler.schedulers.asyncio import AsyncIOScheduler
            self._scheduler = AsyncIOScheduler()
            self._scheduler.add_job(
                self._sync_all_portfolios,
                trigger="interval",
                minutes=15,
                id="price_sync",
                replace_existing=True,
            )
            self._scheduler.start()
            logger.info("Price sync scheduler started (every 15 min during market hours)")
        except ImportError:
            logger.warning("APScheduler not installed — automatic price sync disabled")

    def stop(self):
        if self._scheduler:
            self._scheduler.shutdown(wait=False)

    async def _sync_all_portfolios(self):
        if not is_market_open():
            logger.debug("Market closed — skipping price sync")
            return

        from app.models.models import Portfolio, Holding
        db = self.db_factory()
        try:
            portfolio_ids = [p.id for p in db.query(Portfolio.id).all()]
            for pid in portfolio_ids:
                await sync_portfolio_prices(pid, db)
        except Exception as e:
            logger.error(f"Scheduled price sync failed: {e}")
        finally:
            db.close()
