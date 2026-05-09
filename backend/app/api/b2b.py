"""
B2B API — CA Firm Dashboard
=============================
Allows CA firms (admin users) to manage multiple client portfolios,
view aggregate tax liabilities, and generate bulk ITR exports.

An "admin" user is identified by the is_admin flag on their User record.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from app.core.config import get_db
from app.core.security import get_current_user, hash_password
from app.core.tax_engine import analyse, HoldingInput
from app.models.models import User, Portfolio, Holding

router = APIRouter()


def _require_admin(user: User = Depends(get_current_user)) -> User:
    if not getattr(user, "is_admin", False):
        raise HTTPException(403, "Admin access required")
    return user


def _to_inputs(holdings: List[Holding]) -> List[HoldingInput]:
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


# ── Client management ─────────────────────────────────────────────────────────

class CreateClientRequest(BaseModel):
    email:     EmailStr
    full_name: str
    pan_number: Optional[str] = None
    password:   str = "ChangeMe@123"


@router.get("/clients")
def list_clients(admin: User = Depends(_require_admin), db: Session = Depends(get_db)):
    """List all clients managed by this CA firm."""
    clients = db.query(User).filter(User.is_active == True).all()
    return [
        {
            "id":         c.id,
            "email":      c.email,
            "full_name":  c.full_name,
            "pan_number": c.pan_number,
            "portfolios": len(c.portfolios),
            "created_at": c.created_at,
        }
        for c in clients
        if not getattr(c, "is_admin", False)
    ]


@router.post("/clients", status_code=201)
def create_client(req: CreateClientRequest,
                  admin: User = Depends(_require_admin),
                  db: Session = Depends(get_db)):
    """Create a new client account."""
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(400, "Email already registered")
    client = User(
        email=req.email,
        full_name=req.full_name,
        pan_number=req.pan_number,
        hashed_password=hash_password(req.password),
        is_active=True,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    # Auto-create default portfolio
    portfolio = Portfolio(user_id=client.id, name=f"{req.full_name}'s Portfolio")
    db.add(portfolio)
    db.commit()
    return {"id": client.id, "email": client.email, "portfolio_id": portfolio.id}


# ── Bulk tax overview ─────────────────────────────────────────────────────────

@router.get("/tax-overview")
def bulk_tax_overview(admin: User = Depends(_require_admin), db: Session = Depends(get_db)):
    """
    Aggregate tax liability across all clients.
    Returns a ranked list sorted by total tax liability descending.
    """
    clients = db.query(User).filter(User.is_active == True).all()
    rows = []

    for client in clients:
        if getattr(client, "is_admin", False):
            continue
        total_tax = 0.0
        harvest_saving = 0.0
        for portfolio in client.portfolios:
            if not portfolio.holdings:
                continue
            try:
                summary = analyse(_to_inputs(portfolio.holdings))
                total_tax     += summary.total_tax
                harvest_saving += summary.harvest_tax_saving
            except Exception:
                pass

        rows.append({
            "client_id":       client.id,
            "client_name":     client.full_name,
            "email":           client.email,
            "pan_number":      client.pan_number,
            "total_tax":       round(total_tax, 2),
            "harvest_saving":  round(harvest_saving, 2),
            "portfolios":      len(client.portfolios),
        })

    return sorted(rows, key=lambda r: r["total_tax"], reverse=True)


@router.get("/client/{client_id}/tax-summary")
def client_tax_summary(client_id: int,
                        admin: User = Depends(_require_admin),
                        db: Session = Depends(get_db)):
    """Detailed tax summary for a specific client."""
    client = db.query(User).filter(User.id == client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")

    result = []
    for portfolio in client.portfolios:
        inputs = _to_inputs(portfolio.holdings)
        if not inputs:
            continue
        summary = analyse(inputs)
        result.append({
            "portfolio_id":   portfolio.id,
            "portfolio_name": portfolio.name,
            "broker":         portfolio.broker,
            "ltcg_tax":       round(summary.ltcg_tax, 2),
            "stcg_tax":       round(summary.stcg_tax, 2),
            "total_tax":      round(summary.total_tax, 2),
            "harvest_saving": round(summary.harvest_tax_saving, 2),
            "holdings_count": len(inputs),
        })

    return {
        "client":     {"id": client.id, "name": client.full_name, "pan": client.pan_number},
        "portfolios": result,
        "grand_total_tax": round(sum(r["total_tax"] for r in result), 2),
    }


@router.delete("/client/{client_id}")
def deactivate_client(client_id: int,
                       admin: User = Depends(_require_admin),
                       db: Session = Depends(get_db)):
    """Deactivate a client account."""
    client = db.query(User).filter(User.id == client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")
    client.is_active = False
    db.commit()
    return {"message": f"Client {client.email} deactivated"}
