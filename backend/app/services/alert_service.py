from datetime import date, timedelta
from typing import List, Optional
from dataclasses import dataclass
from app.core.tax_engine import analyse, HoldingInput, LTCG_EXEMPTION


@dataclass
class Alert:
    alert_type:  str
    severity:    str
    symbol:      Optional[str]
    title:       str
    body:        str
    action:      str


def generate_alerts(holdings: List[HoldingInput], as_of: Optional[date] = None) -> List[Alert]:
    ref = as_of or date.today()
    alerts: List[Alert] = []

    fy_end = date(ref.year if ref.month < 4 else ref.year + 1, 3, 31)
    days_left = (fy_end - ref).days

    if days_left <= 90:
        summary = analyse(holdings, ref)
        loss_positions = [h for h in summary.holdings if h.pnl < 0]
        total_saving = sum(abs(h.pnl) * (0.125 if h.is_ltcg else 0.20) for h in loss_positions)

        if loss_positions and total_saving > 1000:
            severity = "high" if days_left <= 30 else "medium"
            alerts.append(Alert(
                alert_type="fy_deadline",
                severity=severity,
                symbol=None,
                title=f"FY ends in {days_left} days — harvest window closing",
                body=f"You have {len(loss_positions)} loss position(s) worth \u20b9{int(sum(abs(h.pnl) for h in loss_positions)):,} in unrealised losses. Harvesting before 31 March saves ~\u20b9{int(total_saving):,} in tax.",
                action="Go to ML Harvest to see ranked recommendations",
            ))

    summary = analyse(holdings, ref)
    for h in summary.holdings:

        if not h.is_ltcg and 0 < h.days_to_ltcg <= 45 and h.pnl > 0:
            tax_now  = h.pnl * 0.20
            tax_then = max(0, h.pnl - LTCG_EXEMPTION) * 0.125
            saving   = tax_now - tax_then
            if saving > 2000:
                alerts.append(Alert(
                    alert_type="ltcg_flip",
                    severity="medium",
                    symbol=h.symbol,
                    title=f"{h.symbol} flips to LTCG in {h.days_to_ltcg} days",
                    body=f"Waiting {h.days_to_ltcg} more days converts \u20b9{int(h.pnl):,} gain from STCG (20%) to LTCG (12.5%), saving ~\u20b9{int(saving):,} in tax.",
                    action=f"Hold {h.symbol} for {h.days_to_ltcg} more days",
                ))

        if h.pnl < 0 and h.pnl_pct < -10:
            alerts.append(Alert(
                alert_type="large_loss",
                severity="medium" if h.pnl_pct < -20 else "low",
                symbol=h.symbol,
                title=f"{h.symbol} down {abs(h.pnl_pct):.1f}% — harvest candidate",
                body=f"Unrealised loss of \u20b9{int(abs(h.pnl)):,}. Selling saves ~\u20b9{int(h.harvest_tax_saving):,} in tax. In India, you can repurchase immediately (no wash-sale rule).",
                action=f"Sell {h.symbol} to crystallise loss",
            ))

    summary = analyse(holdings, ref)
    if 0 < summary.ltcg_gains < LTCG_EXEMPTION:
        remaining = LTCG_EXEMPTION - summary.ltcg_gains
        alerts.append(Alert(
            alert_type="reset_opportunity",
            severity="low",
            symbol=None,
            title=f"\u20b9{int(remaining):,} of LTCG exemption unused this FY",
            body=f"You've used \u20b9{int(summary.ltcg_gains):,} of your \u20b91,25,000 annual LTCG exemption. Consider booking more LTCG profits under the limit and reinvesting to reset your cost basis.",
            action="Review LTCG positions on the Tax Report page",
        ))

    elif summary.ltcg_gains >= LTCG_EXEMPTION * 0.90 and summary.ltcg_gains < LTCG_EXEMPTION:
        alerts.append(Alert(
            alert_type="exemption_limit",
            severity="medium",
            symbol=None,
            title="Approaching \u20b91.25L LTCG exemption limit",
            body=f"LTCG gains of \u20b9{int(summary.ltcg_gains):,} are close to the \u20b91,25,000 threshold. Any additional LTCG realised this FY will be taxed at 12.5%.",
            action="Consider deferring further LTCG sales to next FY",
        ))

    order = {"high": 0, "medium": 1, "low": 2}
    return sorted(alerts, key=lambda a: order.get(a.severity, 3))