"""
Redis Cache Layer
=================
Caches expensive tax computations and ML predictions.

Keys:
  tax:summary:{portfolio_id}          → TaxSummary JSON  (TTL 5 min)
  tax:harvest:{portfolio_id}          → HarvestRecs JSON (TTL 5 min)
  price:{symbol}                      → float price      (TTL 15 min)
  alerts:{portfolio_id}               → Alerts JSON      (TTL 2 min)
"""

import json
import logging
from typing import Any, Optional
from datetime import timedelta

logger = logging.getLogger(__name__)

_redis = None


def get_redis():
    """Lazy-init Redis connection. Returns None if Redis unavailable."""
    global _redis
    if _redis is not None:
        return _redis
    try:
        import redis
        from app.core.config import settings
        _redis = redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        _redis.ping()
        logger.info("Redis connected")
    except Exception as e:
        logger.warning(f"Redis unavailable ({e}) — caching disabled, app still works")
        _redis = None
    return _redis


class Cache:
    """Simple get/set/delete wrapper with JSON serialisation."""

    @staticmethod
    def get(key: str) -> Optional[Any]:
        r = get_redis()
        if not r:
            return None
        try:
            val = r.get(key)
            return json.loads(val) if val else None
        except Exception as e:
            logger.debug(f"Cache GET error {key}: {e}")
            return None

    @staticmethod
    def set(key: str, value: Any, ttl_seconds: int = 300) -> bool:
        r = get_redis()
        if not r:
            return False
        try:
            r.setex(key, ttl_seconds, json.dumps(value, default=str))
            return True
        except Exception as e:
            logger.debug(f"Cache SET error {key}: {e}")
            return False

    @staticmethod
    def delete(key: str) -> bool:
        r = get_redis()
        if not r:
            return False
        try:
            r.delete(key)
            return True
        except Exception:
            return False

    @staticmethod
    def delete_pattern(pattern: str):
        """Delete all keys matching a pattern (e.g. 'tax:*:42')."""
        r = get_redis()
        if not r:
            return
        try:
            keys = r.keys(pattern)
            if keys:
                r.delete(*keys)
        except Exception:
            pass


# ── Typed helpers ─────────────────────────────────────────────────────────────

def cache_tax_summary(portfolio_id: int, data: dict):
    Cache.set(f"tax:summary:{portfolio_id}", data, ttl_seconds=300)

def get_cached_tax_summary(portfolio_id: int) -> Optional[dict]:
    return Cache.get(f"tax:summary:{portfolio_id}")

def cache_harvest_recs(portfolio_id: int, data: list):
    Cache.set(f"tax:harvest:{portfolio_id}", data, ttl_seconds=300)

def get_cached_harvest_recs(portfolio_id: int) -> Optional[list]:
    return Cache.get(f"tax:harvest:{portfolio_id}")

def cache_price(symbol: str, price: float):
    Cache.set(f"price:{symbol}", price, ttl_seconds=900)

def get_cached_price(symbol: str) -> Optional[float]:
    return Cache.get(f"price:{symbol}")

def invalidate_portfolio(portfolio_id: int):
    """Call whenever holdings change to bust stale caches."""
    Cache.delete(f"tax:summary:{portfolio_id}")
    Cache.delete(f"tax:harvest:{portfolio_id}")
    Cache.delete(f"alerts:{portfolio_id}")
