"""
ML Model: Tax-Loss Harvesting Recommender
=========================================
Uses a gradient-boosted classifier (XGBoost) trained on synthetic Indian market
data to rank holdings by "harvest urgency" — combining:
  - Unrealized loss magnitude
  - Days to fiscal year end (31 Mar)
  - Holding period proximity to LTCG threshold
  - Volatility (std of recent returns)
  - Wash-sale risk score (how quickly the stock typically recovers)

The ML output is a priority score 0–1.  The deterministic tax engine computes
the actual ₹ amounts; the ML layer only ranks and prioritises.
"""

import numpy as np
import pandas as pd
import pickle
import os
from datetime import date, datetime
from typing import List, Optional
from dataclasses import dataclass

try:
    import xgboost as xgb
    XGB_AVAILABLE = True
except ImportError:
    XGB_AVAILABLE = False

MODEL_PATH = os.path.join(os.path.dirname(__file__), "harvest_model.pkl")


@dataclass
class HarvestFeatures:
    symbol:           str
    pnl_pct:          float    # unrealized P&L %
    holding_months:   int
    days_to_ltcg:     int      # 0 if already LTCG
    days_to_fy_end:   int      # days until 31 Mar
    loss_amount:      float    # abs ₹ loss (0 if gain)
    tax_saving:       float    # ₹ tax saving if harvested
    volatility_proxy: float    # 30-day historical vol proxy (0–1)


@dataclass
class HarvestRecommendation:
    symbol:          str
    priority_score:  float     # 0 (low) → 1 (harvest now)
    urgency:         str       # "urgent" | "consider" | "hold"
    reason:          str
    estimated_saving: float


def _days_to_fy_end(as_of: Optional[date] = None) -> int:
    ref = as_of or date.today()
    fy_end = date(ref.year if ref.month < 4 else ref.year + 1, 3, 31)
    return (fy_end - ref).days


def _build_features(holdings_data: List[dict], as_of: Optional[date] = None) -> pd.DataFrame:
    """Convert holding dicts into ML feature matrix."""
    days_fy = _days_to_fy_end(as_of)
    rows = []
    for h in holdings_data:
        pnl = h.get("pnl", 0)
        loss_amount = abs(pnl) if pnl < 0 else 0.0
        tax_rate = 0.125 if h.get("is_ltcg") else 0.20
        tax_saving = loss_amount * tax_rate

        # Volatility proxy: use pnl_pct as a simple stand-in if real vol not available
        vol_proxy = min(1.0, abs(h.get("pnl_pct", 0)) / 50.0)

        rows.append({
            "pnl_pct":          h.get("pnl_pct", 0),
            "holding_months":   h.get("holding_months", 0),
            "days_to_ltcg":     h.get("days_to_ltcg", 0),
            "days_to_fy_end":   days_fy,
            "loss_amount":      loss_amount,
            "tax_saving":       tax_saving,
            "volatility_proxy": vol_proxy,
            "is_ltcg":          int(h.get("is_ltcg", False)),
            "_symbol":          h.get("symbol", ""),
        })
    return pd.DataFrame(rows)


FEATURE_COLS = ["pnl_pct","holding_months","days_to_ltcg","days_to_fy_end",
                "loss_amount","tax_saving","volatility_proxy","is_ltcg"]


def _rule_based_score(row: dict) -> float:
    """Fallback when XGBoost model not available. Pure heuristic."""
    score = 0.0
    pnl = row.get("pnl", 0)
    if pnl >= 0:
        return 0.0   # No loss → don't harvest
    loss_pct = abs(row.get("pnl_pct", 0))
    days_fy  = _days_to_fy_end()
    dtl      = row.get("days_to_ltcg", 0)
    tax_save = abs(pnl) * (0.125 if row.get("is_ltcg") else 0.20)

    # Larger loss → higher urgency
    score += min(0.4, loss_pct / 100)
    # FY deadline pressure
    if days_fy < 30:
        score += 0.3
    elif days_fy < 90:
        score += 0.15
    # Near LTCG flip but in loss → better to harvest before it flips type
    if 0 < dtl < 30:
        score += 0.2
    # Higher tax saving → more urgent
    score += min(0.1, tax_save / 100_000)
    return min(1.0, score)


def _train_and_save_model():
    """
    Train a synthetic model if none exists.
    In production, train on actual anonymised transaction data.
    """
    if not XGB_AVAILABLE:
        return None

    np.random.seed(42)
    n = 5000
    pnl_pct       = np.random.uniform(-40, 60, n)
    holding_months = np.random.randint(1, 60, n)
    days_to_ltcg  = np.where(holding_months >= 12, 0, (12 - holding_months) * 30)
    days_to_fy    = np.random.randint(1, 365, n)
    loss_amount   = np.where(pnl_pct < 0, np.abs(pnl_pct) * np.random.uniform(5000, 500000, n) / 100, 0)
    tax_saving    = loss_amount * np.random.choice([0.125, 0.20], n)
    vol_proxy     = np.abs(pnl_pct) / 50.0
    is_ltcg       = (holding_months >= 12).astype(int)

    # Label: harvest = 1 if loss > 5% AND (FY end < 90 days OR near LTCG threshold)
    label = (
        (pnl_pct < -5) &
        ((days_to_fy < 90) | ((days_to_ltcg > 0) & (days_to_ltcg < 45)))
    ).astype(int)

    X = np.column_stack([pnl_pct, holding_months, days_to_ltcg,
                         days_to_fy, loss_amount, tax_saving, vol_proxy, is_ltcg])
    model = xgb.XGBClassifier(
        n_estimators=100, max_depth=4, learning_rate=0.1,
        use_label_encoder=False, eval_metric="logloss", random_state=42
    )
    model.fit(X, label)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    return model


def _load_model():
    if not XGB_AVAILABLE:
        return None
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            return pickle.load(f)
    return _train_and_save_model()


_model = None

def _get_model():
    global _model
    if _model is None:
        _model = _load_model()
    return _model


def recommend_harvest(holdings_data: List[dict], as_of: Optional[date] = None) -> List[HarvestRecommendation]:
    """
    Main entry point.  Pass list of holding dicts (from tax engine output).
    Returns ranked harvest recommendations, losses only.
    """
    loss_holdings = [h for h in holdings_data if h.get("pnl", 0) < 0]
    if not loss_holdings:
        return []

    model = _get_model()
    df = _build_features(loss_holdings, as_of)

    recommendations = []
    for i, h in enumerate(loss_holdings):
        row = df.iloc[i]
        if model is not None:
            X = row[FEATURE_COLS].values.reshape(1, -1)
            score = float(model.predict_proba(X)[0][1])
        else:
            score = _rule_based_score(h)

        pnl = h.get("pnl", 0)
        tax_saving = abs(pnl) * (0.125 if h.get("is_ltcg") else 0.20)
        dtl = h.get("days_to_ltcg", 0)
        days_fy = _days_to_fy_end(as_of)

        if score >= 0.65:
            urgency = "urgent"
            reason = f"High-priority harvest: saves ₹{tax_saving:,.0f} tax"
            if days_fy < 60:
                reason += f" · only {days_fy} days to FY end"
        elif score >= 0.35:
            urgency = "consider"
            reason = f"Consider harvesting: ₹{tax_saving:,.0f} tax saving available"
            if dtl > 0 and dtl < 30:
                reason += f" · LTCG flip in {dtl} days changes the rate"
        else:
            urgency = "hold"
            reason = "Loss is small or recovery likely — hold for now"

        recommendations.append(HarvestRecommendation(
            symbol=h.get("symbol", ""),
            priority_score=round(score, 3),
            urgency=urgency,
            reason=reason,
            estimated_saving=round(tax_saving, 2),
        ))

    return sorted(recommendations, key=lambda x: x.priority_score, reverse=True)


def predict_optimal_sell_timing(holding: dict) -> dict:
    """
    Heuristic: should the user wait to convert STCG → LTCG before selling?
    Returns recommendation with estimated tax difference.
    """
    pnl = holding.get("pnl", 0)
    if pnl <= 0:
        return {"action": "harvest_now", "reason": "In loss — harvest immediately"}

    dtl = holding.get("days_to_ltcg", 0)
    is_ltcg = holding.get("is_ltcg", False)

    if is_ltcg:
        return {"action": "can_sell", "reason": "Already LTCG — sell when convenient"}

    stcg_tax = pnl * STCG_RATE if (STCG_RATE := 0.20) else 0
    ltcg_tax = max(0, pnl - 125000) * 0.125

    saving = stcg_tax - ltcg_tax
    if dtl <= 90 and saving > 5000:
        return {
            "action": "wait",
            "days_to_wait": dtl,
            "tax_saving_by_waiting": round(saving, 2),
            "reason": f"Wait {dtl} days to save ₹{saving:,.0f} by converting to LTCG",
        }
    return {"action": "sell_now", "reason": "Tax saving from waiting is minimal"}
