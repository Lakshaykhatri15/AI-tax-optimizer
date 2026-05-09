from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session
from app.core.config import get_db
from app.core.security import get_current_user
from app.core.tax_engine import HoldingInput
from app.services.itr_export import generate_schedule_cg, export_csv
from app.models.models import User, Portfolio

router = APIRouter()


def _to_inputs(holdings):
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


@router.get("/{portfolio_id}/schedule-cg")
def schedule_cg_json(portfolio_id: int,
                     user: User = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    """Return Schedule CG data as JSON."""
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id, Portfolio.user_id == user.id).first()
    if not p:
        raise HTTPException(404, "Portfolio not found")
    inputs = _to_inputs(p.holdings)
    return generate_schedule_cg(inputs)


@router.get("/{portfolio_id}/schedule-cg/csv")
def schedule_cg_csv(portfolio_id: int,
                    user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    """Download Schedule CG as CSV for ITR-2 filing."""
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id, Portfolio.user_id == user.id).first()
    if not p:
        raise HTTPException(404, "Portfolio not found")
    inputs = _to_inputs(p.holdings)
    csv_content = export_csv(inputs)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=schedule_cg_{portfolio_id}.csv"},
    )
