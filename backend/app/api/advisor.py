from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from anthropic import Anthropic
from app.core.config import settings
from app.core.security import get_current_user
from app.core.config import get_db
from app.core.tax_engine import analyse, HoldingInput
from app.models.models import User, Portfolio
from sqlalchemy.orm import Session

router = APIRouter()
client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)

SYSTEM_PROMPT = """You are TaxOptimizer's AI advisor — a knowledgeable, friendly Indian tax expert
specialising in capital gains for retail investors.

You have access to the user's portfolio and tax summary (injected per request).
Rules you follow:
- NEVER calculate tax numbers yourself. Only reference numbers from the tax summary provided.
- STCG (equity held < 12 months): 20% flat
- LTCG (equity held >= 12 months): 12.5% above ₹1,25,000 exemption per FY
- STCG losses can offset both STCG and LTCG gains; LTCG losses only offset LTCG gains
- Losses can be carried forward for 8 years
- The ₹1.25L exemption resets every FY (April–March)
- Key strategy: book LTCG profits under ₹1.25L each year and reinvest to reset cost basis
- Wash-sale rules don't exist in India (unlike the US) — you can sell and repurchase immediately
- STT (Securities Transaction Tax) applies; consider it in your net calculations

Be concise (under 200 words), practical, and specific to the user's actual data.
Use ₹ amounts from their tax summary. Avoid generic advice."""


class Message(BaseModel):
    role: str
    content: str


class AdvisorRequest(BaseModel):
    portfolio_id: int
    messages: List[Message]


@router.post("/chat")
def chat(req: AdvisorRequest,
         user: User = Depends(get_current_user),
         db: Session = Depends(get_db)):
    p = db.query(Portfolio).filter(
        Portfolio.id == req.portfolio_id,
        Portfolio.user_id == user.id
    ).first()
    if not p:
        raise HTTPException(404, "Portfolio not found")

    # Build tax context from deterministic engine
    inputs = [
        HoldingInput(
            symbol=h.symbol, name=h.name or h.symbol,
            quantity=h.quantity, buy_price=h.avg_buy_price,
            buy_date=h.buy_date,
            current_price=h.current_price or h.avg_buy_price,
            asset_type=h.asset_type.value if hasattr(h.asset_type, "value") else h.asset_type,
        )
        for h in p.holdings
    ]
    summary = analyse(inputs) if inputs else None

    context = ""
    if summary:
        context = f"""
User's portfolio ({len(inputs)} holdings):
{chr(10).join(f"- {h.symbol}: qty={h.quantity}, buy=₹{h.buy_price}, CMP=₹{h.current_price}, P&L=₹{int(h.pnl):,}, {h.gain_type}, held {h.holding_months}m, rec: {h.recommendation}" for h in summary.holdings)}

Tax summary (FY 2025-26):
- LTCG gains: ₹{int(summary.ltcg_gains):,}  |  LTCG losses: ₹{int(summary.ltcg_losses):,}
- STCG gains: ₹{int(summary.stcg_gains):,}  |  STCG losses: ₹{int(summary.stcg_losses):,}
- LTCG tax: ₹{int(summary.ltcg_tax):,}  |  STCG tax: ₹{int(summary.stcg_tax):,}
- Total tax liability: ₹{int(summary.total_tax):,}
- Exemption used: ₹{int(summary.exemption_used):,}  |  Remaining: ₹{int(summary.exemption_remaining):,}
- Harvest potential: ₹{int(summary.harvest_potential):,} in losses  → saves ₹{int(summary.harvest_tax_saving):,} in tax
- Reset opportunity: {"Yes — book profits under ₹1.25L and reinvest" if summary.reset_opportunity else "No"}
"""

    system = SYSTEM_PROMPT + ("\n\nPortfolio context:\n" + context if context else "")

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=400,
        system=system,
        messages=[{"role": m.role, "content": m.content} for m in req.messages],
    )
    return {"reply": response.content[0].text}
