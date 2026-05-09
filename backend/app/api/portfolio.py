from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import date
from app.core.config import get_db
from app.core.security import get_current_user
from app.models.models import User, Portfolio, Holding

router = APIRouter()


class HoldingIn(BaseModel):
    symbol:        str
    name:          str
    quantity:      float
    avg_buy_price: float
    buy_date:      date
    current_price: float
    asset_type:    str = "equity"
    isin:          Optional[str] = None


class HoldingOut(HoldingIn):
    id:           int
    portfolio_id: int
    class Config:
        from_attributes = True


class PortfolioOut(BaseModel):
    id:       int
    name:     str
    broker:   Optional[str]
    holdings: List[HoldingOut] = []
    class Config:
        from_attributes = True


@router.get("/", response_model=List[PortfolioOut])
def list_portfolios(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Portfolio).filter(Portfolio.user_id == user.id).all()


@router.post("/", response_model=PortfolioOut, status_code=201)
def create_portfolio(name: str = "My Portfolio", broker: Optional[str] = None,
                     user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = Portfolio(user_id=user.id, name=name, broker=broker)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.post("/{portfolio_id}/holdings", response_model=HoldingOut, status_code=201)
def add_holding(portfolio_id: int, holding: HoldingIn,
                user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id, Portfolio.user_id == user.id).first()
    if not p:
        raise HTTPException(404, "Portfolio not found")
    h = Holding(portfolio_id=portfolio_id, **holding.model_dump())
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@router.put("/{portfolio_id}/holdings/{holding_id}", response_model=HoldingOut)
def update_holding(portfolio_id: int, holding_id: int, data: HoldingIn,
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id, Portfolio.user_id == user.id).first()
    if not p:
        raise HTTPException(404, "Portfolio not found")
    h = db.query(Holding).filter(Holding.id == holding_id, Holding.portfolio_id == portfolio_id).first()
    if not h:
        raise HTTPException(404, "Holding not found")
    for k, v in data.model_dump().items():
        setattr(h, k, v)
    db.commit()
    db.refresh(h)
    return h


@router.delete("/{portfolio_id}/holdings/{holding_id}", status_code=204)
def delete_holding(portfolio_id: int, holding_id: int,
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id, Portfolio.user_id == user.id).first()
    if not p:
        raise HTTPException(404, "Portfolio not found")
    h = db.query(Holding).filter(Holding.id == holding_id, Holding.portfolio_id == portfolio_id).first()
    if not h:
        raise HTTPException(404, "Holding not found")
    db.delete(h)
    db.commit()
