from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.config import get_db
from app.core.security import get_current_user
from app.core.tax_engine import HoldingInput
from app.services.alert_service import generate_alerts
from app.services.price_sync import sync_portfolio_prices
from app.models.models import User, Portfolio

router = APIRouter()


def _to_inputs(holdings):
    from datetime import date
    return [
        HoldingInput(
            symbol=h.symbol, name=h.name or h.symbol,
            quantity=h.quantity, buy_price=h.avg_buy_price,
            buy_date=h.buy_date,
            current_price=h.current_price or h.avg_buy_price,
            asset_type=h.asset_type if isinstance(h.asset_type, str) else h.asset_type.value,
        )
        for h in holdings
    ]


@router.get("/{portfolio_id}/alerts")
def get_alerts(portfolio_id: int,
               user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id, Portfolio.user_id == user.id).first()
    if not p:
        raise HTTPException(404, "Portfolio not found")
    inputs = _to_inputs(p.holdings)
    alerts = generate_alerts(inputs)
    return [
        {
            "alert_type": a.alert_type,
            "severity":   a.severity,
            "symbol":     a.symbol,
            "title":      a.title,
            "body":       a.body,
            "action":     a.action,
        }
        for a in alerts
    ]


@router.post("/{portfolio_id}/sync-prices")
async def sync_prices(portfolio_id: int,
                      background_tasks: BackgroundTasks,
                      user: User = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id, Portfolio.user_id == user.id).first()
    if not p:
        raise HTTPException(404, "Portfolio not found")
    prices = await sync_portfolio_prices(portfolio_id, db)
    return {"updated": len(prices), "prices": prices}
