#!/usr/bin/env python3
"""
startup.py — Run this once before starting the app for the first time.

  python startup.py

Does:
  1. Runs all Alembic migrations (creates tables)
  2. Trains / verifies the XGBoost harvest model
  3. Verifies Redis connection
  4. Checks ANTHROPIC_API_KEY is set
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))


def step(msg: str):
    print(f"\n{'─'*50}")
    print(f"  {msg}")
    print(f"{'─'*50}")


def main():
    print("\n🚀 TaxOptimizer India — Startup Check\n")

    # ── 1. Database migrations ────────────────────────────────────────────────
    step("1/4  Running database migrations...")
    try:
        from alembic.config import Config
        from alembic import command
        alembic_cfg = Config("alembic.ini")
        command.upgrade(alembic_cfg, "head")
        print("  ✓ Migrations applied successfully")
    except Exception as e:
        print(f"  ✗ Migration failed: {e}")
        print("    → Make sure PostgreSQL is running and DATABASE_URL is correct in .env")
        sys.exit(1)

    # ── 2. ML model ───────────────────────────────────────────────────────────
    step("2/4  Training XGBoost harvest model...")
    try:
        from app.ml.harvesting_model import _train_and_save_model, MODEL_PATH
        model = _train_and_save_model()
        if model:
            print(f"  ✓ Model trained and saved to {MODEL_PATH}")
        else:
            print("  ⚠ XGBoost not installed — using rule-based fallback (still works)")
            print("    → pip install xgboost to enable ML model")
    except Exception as e:
        print(f"  ⚠ ML model training failed: {e} (rule-based fallback will be used)")

    # ── 3. Redis check ────────────────────────────────────────────────────────
    step("3/4  Checking Redis connection...")
    try:
        from app.core.cache import get_redis
        r = get_redis()
        if r:
            print("  ✓ Redis connected — caching enabled")
        else:
            print("  ⚠ Redis not available — caching disabled (app still works without it)")
    except Exception as e:
        print(f"  ⚠ Redis check failed: {e}")

    # ── 4. API key ────────────────────────────────────────────────────────────
    step("4/4  Checking environment variables...")
    from app.core.config import settings
    checks = [
        ("ANTHROPIC_API_KEY", bool(settings.ANTHROPIC_API_KEY), "AI Advisor will not work"),
        ("DATABASE_URL",      bool(settings.DATABASE_URL),      "Required"),
        ("SECRET_KEY",        len(settings.SECRET_KEY) >= 32,   "Should be 32+ chars"),
    ]
    all_ok = True
    for name, ok, note in checks:
        icon = "✓" if ok else "✗"
        print(f"  {icon} {name:<30} {'OK' if ok else f'MISSING — {note}'}")
        if not ok and note == "Required":
            all_ok = False

    print("\n" + "═"*50)
    if all_ok:
        print("  ✅ All checks passed! Start the app with:")
        print("     uvicorn app.main:app --reload")
        print("     (or: make dev)")
    else:
        print("  ❌ Some required checks failed. Fix them before starting.")
    print("═"*50 + "\n")


if __name__ == "__main__":
    main()
