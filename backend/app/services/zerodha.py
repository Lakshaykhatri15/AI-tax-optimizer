"""
Zerodha Kite API Integration
==============================
Imports holdings directly from a Zerodha account using the Kite Connect API.

Setup:
  1. Register at https://developers.kite.trade
  2. Generate API key + secret
  3. Complete OAuth flow to get access_token (valid for 1 day)
  4. Store token securely (never in code)

pip install kiteconnect
"""

import logging
from typing import List, Optional
from datetime import date

logger = logging.getLogger(__name__)


class KiteIntegration:
    """
    Wrapper around Zerodha Kite Connect for fetching holdings.
    The access_token must be refreshed daily via OAuth.
    """

    def __init__(self, api_key: str, access_token: str):
        self.api_key      = api_key
        self.access_token = access_token
        self._kite        = None
        self._init_client()

    def _init_client(self):
        try:
            from kiteconnect import KiteConnect
            self._kite = KiteConnect(api_key=self.api_key)
            self._kite.set_access_token(self.access_token)
            logger.info("Kite Connect initialised")
        except ImportError:
            logger.warning("kiteconnect not installed — run: pip install kiteconnect")
        except Exception as e:
            logger.error(f"Kite init failed: {e}")

    def get_holdings(self) -> List[dict]:
        """
        Fetch all holdings from Zerodha demat account.
        Returns list of holding dicts compatible with our HoldingInput schema.
        """
        if not self._kite:
            raise RuntimeError("Kite Connect not initialised")

        raw = self._kite.holdings()
        holdings = []
        for h in raw:
            if h.get("quantity", 0) <= 0:
                continue
            holdings.append({
                "symbol":        h["tradingsymbol"],
                "name":          h.get("product", h["tradingsymbol"]),
                "quantity":      h["quantity"],
                "avg_buy_price": h["average_price"],
                "buy_date":      _estimate_buy_date(h),
                "current_price": h.get("last_price", h["average_price"]),
                "asset_type":    _map_asset_type(h.get("instrument_type", "EQ")),
                "isin":          h.get("isin", ""),
                "exchange":      h.get("exchange", "NSE"),
            })
        return holdings

    def get_positions(self) -> List[dict]:
        """Fetch intraday and short-term positions."""
        if not self._kite:
            raise RuntimeError("Kite Connect not initialised")
        positions = self._kite.positions()
        return positions.get("net", [])

    def get_quote(self, symbols: List[str]) -> dict:
        """
        Get current market quotes for a list of NSE symbols.
        symbols: ["NSE:RELIANCE", "NSE:INFY"]
        """
        if not self._kite:
            raise RuntimeError("Kite Connect not initialised")
        return self._kite.quote(symbols)


def _estimate_buy_date(holding: dict) -> date:
    """
    Kite holdings don't include buy date directly.
    Use t1_quantity presence as a proxy for recent purchase.
    For real FIFO cost basis, parse contract notes.
    """
    # If t1_quantity > 0, shares were bought today (T+1 settlement)
    if holding.get("t1_quantity", 0) > 0:
        return date.today()
    # Default to 13 months ago (LTCG eligible) — user should correct this
    from datetime import timedelta
    return date.today() - timedelta(days=396)


def _map_asset_type(instrument_type: str) -> str:
    mapping = {
        "EQ":  "equity",
        "MF":  "mf_equity",
        "ETF": "etf",
    }
    return mapping.get(instrument_type.upper(), "equity")


# ── OAuth flow helpers ────────────────────────────────────────────────────────

def get_login_url(api_key: str) -> str:
    """Step 1: Redirect user to this URL to authorise."""
    return f"https://kite.zerodha.com/connect/login?api_key={api_key}&v=3"


def exchange_request_token(api_key: str, api_secret: str, request_token: str) -> str:
    """
    Step 2: Exchange request_token (from OAuth callback) for access_token.
    Call this once per day after user logs in via Zerodha.
    """
    try:
        from kiteconnect import KiteConnect
        kite = KiteConnect(api_key=api_key)
        session = kite.generate_session(request_token, api_secret=api_secret)
        return session["access_token"]
    except Exception as e:
        raise RuntimeError(f"Token exchange failed: {e}")


# ── FastAPI route example ─────────────────────────────────────────────────────
# Add to app/api/integrations.py and register in main.py when ready:
#
# @router.get("/zerodha/holdings/{portfolio_id}")
# def import_from_zerodha(portfolio_id: int, access_token: str,
#                          user=Depends(get_current_user), db=Depends(get_db)):
#     from app.core.config import settings
#     kite = KiteIntegration(settings.ZERODHA_API_KEY, access_token)
#     holdings = kite.get_holdings()
#     for h in holdings:
#         holding = Holding(portfolio_id=portfolio_id, **h)
#         db.add(holding)
#     db.commit()
#     return {"imported": len(holdings)}
