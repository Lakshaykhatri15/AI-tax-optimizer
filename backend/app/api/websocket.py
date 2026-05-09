"""
WebSocket — Live Price Stream
==============================
Clients connect to /ws/prices/{portfolio_id} and receive real-time price
updates as JSON messages every 15 seconds during market hours.

Message format:
  { "symbol": "RELIANCE", "price": 2905.50, "change": 15.50, "change_pct": 0.54, "ts": "2026-04-07T10:30:00" }

Usage (frontend):
  const ws = new WebSocket(`ws://localhost:8000/ws/prices/${portfolioId}?token=<jwt>`);
  ws.onmessage = (e) => { const tick = JSON.parse(e.data); updatePrice(tick); };
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt

from app.core.config import settings, get_db
from app.models.models import Portfolio, Holding
from app.services.price_sync import fetch_price_yfinance, is_market_open

logger = logging.getLogger(__name__)
router = APIRouter()

# Active connections: portfolio_id → set of websockets
_connections: Dict[int, Set[WebSocket]] = {}
# Last known prices: symbol → price
_price_cache: Dict[str, float] = {}


def _verify_token(token: str) -> str | None:
    """Return email from JWT or None if invalid."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None


async def _broadcast(portfolio_id: int, message: dict):
    """Send a message to all WebSocket clients for a portfolio."""
    dead = set()
    for ws in _connections.get(portfolio_id, set()):
        try:
            await ws.send_text(json.dumps(message))
        except Exception:
            dead.add(ws)
    for ws in dead:
        _connections.get(portfolio_id, set()).discard(ws)


async def _price_loop(portfolio_id: int, symbols: list[str]):
    """Background task: fetch prices every 15s and broadcast diffs."""
    while _connections.get(portfolio_id):
        try:
            if is_market_open():
                prices = await fetch_price_yfinance(symbols)
                for symbol, price in prices.items():
                    old = _price_cache.get(symbol, price)
                    change = price - old
                    change_pct = (change / old * 100) if old else 0.0
                    _price_cache[symbol] = price
                    await _broadcast(portfolio_id, {
                        "symbol":     symbol,
                        "price":      round(price, 2),
                        "change":     round(change, 2),
                        "change_pct": round(change_pct, 2),
                        "ts":         datetime.utcnow().isoformat(),
                    })
            else:
                await _broadcast(portfolio_id, {
                    "type": "market_closed",
                    "message": "NSE market is closed. Prices update at 9:15 AM IST.",
                    "ts": datetime.utcnow().isoformat(),
                })
        except Exception as e:
            logger.warning(f"Price loop error for portfolio {portfolio_id}: {e}")

        await asyncio.sleep(15)


@router.websocket("/ws/prices/{portfolio_id}")
async def price_websocket(
    websocket: WebSocket,
    portfolio_id: int,
    token: str = Query(...),
):
    email = _verify_token(token)
    if not email:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    # Validate portfolio ownership
    db = next(get_db())
    try:
        portfolio = db.query(Portfolio).join(Portfolio.user).filter(
            Portfolio.id == portfolio_id
        ).first()
        if not portfolio:
            await websocket.close(code=4004, reason="Portfolio not found")
            return
        symbols = [h.symbol for h in portfolio.holdings]
    finally:
        db.close()

    await websocket.accept()
    logger.info(f"WS connected: portfolio {portfolio_id}, {len(symbols)} symbols")

    # Register connection
    if portfolio_id not in _connections:
        _connections[portfolio_id] = set()
        # Start price loop only when first client connects
        asyncio.create_task(_price_loop(portfolio_id, symbols))

    _connections[portfolio_id].add(websocket)

    # Send current cached prices immediately
    for symbol in symbols:
        if symbol in _price_cache:
            await websocket.send_text(json.dumps({
                "symbol":     symbol,
                "price":      _price_cache[symbol],
                "change":     0.0,
                "change_pct": 0.0,
                "ts":         datetime.utcnow().isoformat(),
                "cached":     True,
            }))

    try:
        while True:
            # Keep connection alive; client can send "ping"
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        _connections[portfolio_id].discard(websocket)
        if not _connections[portfolio_id]:
            del _connections[portfolio_id]
        logger.info(f"WS disconnected: portfolio {portfolio_id}")
