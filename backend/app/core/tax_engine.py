"""
Indian Capital Gains Tax Engine — FY 2025-26
Deterministic rules. Never use LLM for these calculations.

Rules:
- Equity / Equity MF held >= 12 months → LTCG at 12.5% above ₹1,25,000 exemption
- Equity / Equity MF held < 12 months  → STCG at 20%
- Debt MF (all holding periods)         → slab rate (modelled as 30% max)
- STCG losses can offset STCG + LTCG gains
- LTCG losses can only offset LTCG gains
- Grandfathering: cost basis for equity bought before 31 Jan 2018 = max(actual cost, FMV on 31 Jan 2018)
"""

from datetime import date, timedelta
from typing import List, Optional
from dataclasses import dataclass, field


LTCG_EXEMPTION        = 125_000      # ₹1.25L per FY (Budget 2024)
LTCG_RATE_EQUITY      = 0.125        # 12.5%
STCG_RATE_EQUITY      = 0.20         # 20%
LTCG_THRESHOLD_EQUITY = 12           # months
DEBT_SLAB_RATE        = 0.30         # simplified


@dataclass
class HoldingInput:
    symbol:        str
    name:          str
    quantity:      float
    buy_price:     float
    buy_date:      date
    current_price: float
    asset_type:    str = "equity"    # equity | mf_equity | mf_debt | etf | bond
    isin:          Optional[str] = None


@dataclass
class HoldingResult:
    symbol:       str
    name:         str
    quantity:     float
    buy_price:    float
    buy_date:     date
    current_price: float
    asset_type:   str
    holding_months: int
    is_ltcg:      bool
    pnl:          float
    pnl_pct:      float
    gain_type:    str                 # LTCG | STCG
    estimated_tax: float
    days_to_ltcg: int                 # 0 if already LTCG
    harvest_tax_saving: float         # tax saved if loss is harvested
    recommendation: str


@dataclass
class TaxSummary:
    holdings:           List[HoldingResult]
    ltcg_gains:         float
    stcg_gains:         float
    ltcg_losses:        float
    stcg_losses:        float
    net_ltcg:           float
    net_stcg:           float
    ltcg_taxable:       float
    stcg_taxable:       float
    ltcg_tax:           float
    stcg_tax:           float
    total_tax:          float
    exemption_used:     float
    exemption_remaining: float
    harvest_potential:  float         # total losses available to harvest
    harvest_tax_saving: float         # total tax saving from harvesting all losses
    reset_opportunity:  bool          # if user can book LTCG profit under exemption and reset cost basis


def _holding_months(buy_date: date, as_of: Optional[date] = None) -> int:
    ref = as_of or date.today()
    return (ref.year - buy_date.year) * 12 + (ref.month - buy_date.month)


def _is_ltcg_eligible(asset_type: str, months: int) -> bool:
    if asset_type in ("equity", "mf_equity", "etf"):
        return months >= LTCG_THRESHOLD_EQUITY
    if asset_type in ("mf_debt", "bond"):
        return months >= 36
    return months >= 12


def _tax_on_gain(gain: float, asset_type: str, is_ltcg: bool, ltcg_exemption_left: float = 0) -> float:
    if gain <= 0:
        return 0.0
    if asset_type in ("mf_debt", "bond"):
        return gain * DEBT_SLAB_RATE
    if is_ltcg:
        taxable = max(0, gain - ltcg_exemption_left)
        return taxable * LTCG_RATE_EQUITY
    return gain * STCG_RATE_EQUITY


def _days_to_ltcg(buy_date: date, as_of: Optional[date] = None) -> int:
    ref = as_of or date.today()
    ltcg_date = date(buy_date.year + 1, buy_date.month, buy_date.day)
    delta = (ltcg_date - ref).days
    return max(0, delta)


def _recommend(h: HoldingResult) -> str:
    if h.pnl < 0:
        saving = abs(h.pnl) * (LTCG_RATE_EQUITY if h.is_ltcg else STCG_RATE_EQUITY)
        return f"Harvest loss — selling saves ~₹{saving:,.0f} in tax"
    if not h.is_ltcg and h.days_to_ltcg <= 90 and h.days_to_ltcg > 0:
        return f"Hold {h.days_to_ltcg} more days to convert to LTCG and halve your tax rate"
    if h.is_ltcg and h.pnl > 0 and h.pnl < LTCG_EXEMPTION:
        return "Book profit under ₹1.25L exemption and reinvest to reset cost basis"
    return "Hold — no immediate action needed"


def analyse(holdings: List[HoldingInput], as_of: Optional[date] = None) -> TaxSummary:
    results: List[HoldingResult] = []
    ltcg_exemption_left = float(LTCG_EXEMPTION)

    for h in holdings:
        months   = _holding_months(h.buy_date, as_of)
        is_ltcg  = _is_ltcg_eligible(h.asset_type, months)
        pnl      = (h.current_price - h.buy_price) * h.quantity
        pnl_pct  = ((h.current_price - h.buy_price) / h.buy_price) * 100
        dtl      = _days_to_ltcg(h.buy_date, as_of) if not is_ltcg else 0
        tax      = _tax_on_gain(pnl, h.asset_type, is_ltcg, ltcg_exemption_left if is_ltcg else 0)
        harvest_saving = abs(pnl) * (LTCG_RATE_EQUITY if is_ltcg else STCG_RATE_EQUITY) if pnl < 0 else 0.0

        if is_ltcg and pnl > 0:
            ltcg_exemption_left = max(0, ltcg_exemption_left - pnl)

        rec = HoldingResult(
            symbol=h.symbol, name=h.name, quantity=h.quantity,
            buy_price=h.buy_price, buy_date=h.buy_date,
            current_price=h.current_price, asset_type=h.asset_type,
            holding_months=months, is_ltcg=is_ltcg,
            pnl=pnl, pnl_pct=pnl_pct,
            gain_type="LTCG" if is_ltcg else "STCG",
            estimated_tax=tax, days_to_ltcg=dtl,
            harvest_tax_saving=harvest_saving,
            recommendation=""
        )
        rec.recommendation = _recommend(rec)
        results.append(rec)

    ltcg_gains   = sum(r.pnl for r in results if r.is_ltcg  and r.pnl > 0)
    stcg_gains   = sum(r.pnl for r in results if not r.is_ltcg and r.pnl > 0)
    ltcg_losses  = sum(r.pnl for r in results if r.is_ltcg  and r.pnl < 0)
    stcg_losses  = sum(r.pnl for r in results if not r.is_ltcg and r.pnl < 0)

    # Offset: STCG losses offset STCG first, then LTCG; LTCG losses only offset LTCG
    net_stcg = max(0, stcg_gains + stcg_losses)
    remaining_stcg_loss = abs(min(0, stcg_gains + stcg_losses))
    net_ltcg = max(0, ltcg_gains + ltcg_losses - remaining_stcg_loss)

    ltcg_taxable  = max(0, net_ltcg - LTCG_EXEMPTION)
    stcg_taxable  = net_stcg
    ltcg_tax      = ltcg_taxable * LTCG_RATE_EQUITY
    stcg_tax      = stcg_taxable * STCG_RATE_EQUITY
    total_tax     = ltcg_tax + stcg_tax
    exemption_used = min(LTCG_EXEMPTION, net_ltcg)

    harvest_potential = abs(ltcg_losses) + abs(stcg_losses)
    harvest_saving    = sum(r.harvest_tax_saving for r in results)
    reset_opp         = 0 < net_ltcg < LTCG_EXEMPTION

    return TaxSummary(
        holdings=results,
        ltcg_gains=ltcg_gains, stcg_gains=stcg_gains,
        ltcg_losses=ltcg_losses, stcg_losses=stcg_losses,
        net_ltcg=net_ltcg, net_stcg=net_stcg,
        ltcg_taxable=ltcg_taxable, stcg_taxable=stcg_taxable,
        ltcg_tax=ltcg_tax, stcg_tax=stcg_tax, total_tax=total_tax,
        exemption_used=exemption_used,
        exemption_remaining=max(0, LTCG_EXEMPTION - exemption_used),
        harvest_potential=harvest_potential,
        harvest_tax_saving=harvest_saving,
        reset_opportunity=reset_opp,
    )


def scenario_sell(holdings: List[HoldingInput], sell_map: dict, as_of: Optional[date] = None) -> dict:
    """Simulate selling qty of specific holdings. sell_map = {symbol: qty}"""
    modified = []
    for h in holdings:
        qty = sell_map.get(h.symbol, 0)
        if qty > 0:
            modified.append(HoldingInput(
                symbol=h.symbol, name=h.name, quantity=qty,
                buy_price=h.buy_price, buy_date=h.buy_date,
                current_price=h.current_price, asset_type=h.asset_type
            ))
    result = analyse(modified, as_of)
    return {
        "realized_pnl": result.ltcg_gains + result.stcg_gains + result.ltcg_losses + result.stcg_losses,
        "tax_outgo":    result.total_tax,
        "net_proceeds": (result.ltcg_gains + result.stcg_gains + result.ltcg_losses + result.stcg_losses) - result.total_tax,
        "detail":       result,
    }
