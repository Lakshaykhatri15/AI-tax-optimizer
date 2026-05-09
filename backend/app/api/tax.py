from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import date
from app.core.config import get_db
from app.core.security import get_current_user
from app.core.tax_engine import analyse, scenario_sell, HoldingInput
from app.ml.harvesting_model import recommend_harvest, predict_optimal_sell_timing
from app.models.models import User, Portfolio, Holding

router = APIRouter()


def _holdings_to_inputs(holdings: List[Holding]) -> List[HoldingInput]:
    return [
        HoldingInput(
            symbol=h.symbol, name=h.name or h.symbol,
            quantity=h.quantity, buy_price=h.avg_buy_price,
            buy_date=h.buy_date,
            current_price=h.current_price or h.avg_buy_price,
            asset_type=h.asset_type.value if hasattr(h.asset_type, 'value') else h.asset_type,
        )
        for h in holdings
    ]


@router.get("/{portfolio_id}/summary")
def tax_summary(portfolio_id: int, as_of: Optional[date] = None,
                user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id, Portfolio.user_id == user.id).first()
    if not p:
        raise HTTPException(404, "Portfolio not found")
    inputs = _holdings_to_inputs(p.holdings)
    if not inputs:
        return {"message": "No holdings in portfolio"}
    result = analyse(inputs, as_of)
    return {
        "ltcg_gains":          round(result.ltcg_gains, 2),
        "stcg_gains":          round(result.stcg_gains, 2),
        "ltcg_losses":         round(result.ltcg_losses, 2),
        "stcg_losses":         round(result.stcg_losses, 2),
        "ltcg_tax":            round(result.ltcg_tax, 2),
        "stcg_tax":            round(result.stcg_tax, 2),
        "total_tax":           round(result.total_tax, 2),
        "exemption_used":      round(result.exemption_used, 2),
        "exemption_remaining": round(result.exemption_remaining, 2),
        "harvest_potential":   round(result.harvest_potential, 2),
        "harvest_tax_saving":  round(result.harvest_tax_saving, 2),
        "reset_opportunity":   result.reset_opportunity,
        "holdings": [
            {
                "symbol":          h.symbol,
                "name":            h.name,
                "quantity":        h.quantity,
                "buy_price":       h.buy_price,
                "current_price":   h.current_price,
                "pnl":             round(h.pnl, 2),
                "pnl_pct":         round(h.pnl_pct, 2),
                "gain_type":       h.gain_type,
                "holding_months":  h.holding_months,
                "is_ltcg":         h.is_ltcg,
                "estimated_tax":   round(h.estimated_tax, 2),
                "days_to_ltcg":    h.days_to_ltcg,
                "recommendation":  h.recommendation,
            }
            for h in result.holdings
        ],
    }


@router.get("/{portfolio_id}/harvest")
def harvest_recommendations(portfolio_id: int,
                             user: User = Depends(get_current_user),
                             db: Session = Depends(get_db)):
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id, Portfolio.user_id == user.id).first()
    if not p:
        raise HTTPException(404, "Portfolio not found")
    inputs = _holdings_to_inputs(p.holdings)
    summary = analyse(inputs)
    holdings_data = [
        {
            "symbol":         h.symbol,
            "pnl":            h.pnl,
            "pnl_pct":        h.pnl_pct,
            "holding_months": h.holding_months,
            "days_to_ltcg":   h.days_to_ltcg,
            "is_ltcg":        h.is_ltcg,
        }
        for h in summary.holdings
    ]
    recs = recommend_harvest(holdings_data)
    return [
        {
            "symbol":           r.symbol,
            "priority_score":   r.priority_score,
            "urgency":          r.urgency,
            "reason":           r.reason,
            "estimated_saving": r.estimated_saving,
        }
        for r in recs
    ]


class ScenarioRequest(BaseModel):
    sell_map: Dict[str, float]   # {symbol: qty_to_sell}


@router.post("/{portfolio_id}/scenario")
def scenario(portfolio_id: int, req: ScenarioRequest,
             user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id, Portfolio.user_id == user.id).first()
    if not p:
        raise HTTPException(404, "Portfolio not found")
    inputs = _holdings_to_inputs(p.holdings)
    result = scenario_sell(inputs, req.sell_map)
    return {
        "realized_pnl": round(result["realized_pnl"], 2),
        "tax_outgo":    round(result["tax_outgo"], 2),
        "net_proceeds": round(result["net_proceeds"], 2),
    }
