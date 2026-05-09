from typing import Optional
"""
ITR-2 Schedule CG Export
=========================
Generates a structured JSON / CSV that maps to Schedule CG of ITR-2.
Users can use this to fill their income tax return manually or via a CA.

Fields match the ITR-2 AY 2025-26 offline utility column names.
"""

import csv
import io
import json
from datetime import date
from typing import List
from app.core.tax_engine import analyse, HoldingInput, LTCG_EXEMPTION


def _fy_label(as_of: Optional[date] = None) -> str:
    ref = as_of or date.today()
    fy_start = ref.year if ref.month >= 4 else ref.year - 1
    return f"{fy_start}-{str(fy_start + 1)[2:]}"


def generate_schedule_cg(holdings: List[HoldingInput], as_of: Optional[date] = None) -> dict:
    """Return structured Schedule CG data."""
    summary = analyse(holdings, as_of)
    fy = _fy_label(as_of)

    ltcg_rows = []
    stcg_rows = []

    for h in summary.holdings:
        row = {
            "isin":             getattr(h, "isin", ""),
            "name_of_scrip":    h.name,
            "date_of_purchase": h.buy_date.isoformat(),
            "date_of_sale":     (as_of or date.today()).isoformat(),
            "sale_price":       round(h.current_price, 2),
            "cost_of_acquisition": round(h.buy_price, 2),
            "full_value_of_consideration": round(h.current_price * h.quantity, 2),
            "cost_of_acquisition_total":   round(h.buy_price * h.quantity, 2),
            "gain_loss": round(h.pnl, 2),
        }
        if h.is_ltcg:
            ltcg_rows.append(row)
        else:
            stcg_rows.append(row)

    return {
        "fy": fy,
        "schedule_cg": {
            "A_stcg_111a": {
                "description": "STCG on equity shares / equity-oriented MF (STT paid) — Sec 111A",
                "rate": "20%",
                "transactions": stcg_rows,
                "total_gain":   round(summary.stcg_gains, 2),
                "total_loss":   round(abs(summary.stcg_losses), 2),
                "net":          round(summary.net_stcg, 2),
                "tax":          round(summary.stcg_tax, 2),
            },
            "B_ltcg_112a": {
                "description": "LTCG on equity shares / equity-oriented MF exceeding ₹1.25L — Sec 112A",
                "rate": "12.5%",
                "exemption": LTCG_EXEMPTION,
                "transactions": ltcg_rows,
                "total_gain":   round(summary.ltcg_gains, 2),
                "total_loss":   round(abs(summary.ltcg_losses), 2),
                "net_before_exemption": round(summary.net_ltcg, 2),
                "exemption_claimed":    round(summary.exemption_used, 2),
                "taxable_amount":       round(summary.ltcg_taxable, 2),
                "tax":                  round(summary.ltcg_tax, 2),
            },
        },
        "summary": {
            "total_stcg_tax": round(summary.stcg_tax, 2),
            "total_ltcg_tax": round(summary.ltcg_tax, 2),
            "total_tax":      round(summary.total_tax, 2),
        },
    }


def export_csv(holdings: List[HoldingInput], as_of: Optional[date] = None) -> str:
    """Export Schedule CG as CSV string."""
    data = generate_schedule_cg(holdings, as_of)
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([f"Schedule CG — FY {data['fy']} (ITR-2 AY {int(data['fy'][:4]) + 1}-{str(int(data['fy'][:4]) + 2)[2:]}"])
    writer.writerow([])

    for section_key, section in data["schedule_cg"].items():
        writer.writerow([section["description"]])
        writer.writerow(["ISIN", "Scrip name", "Purchase date", "Sale date",
                         "Sale price", "Cost", "Full consideration", "Total cost", "Gain/Loss"])
        for tx in section["transactions"]:
            writer.writerow([
                tx["isin"], tx["name_of_scrip"],
                tx["date_of_purchase"], tx["date_of_sale"],
                tx["sale_price"], tx["cost_of_acquisition"],
                tx["full_value_of_consideration"],
                tx["cost_of_acquisition_total"], tx["gain_loss"],
            ])
        writer.writerow(["", "", "", "", "", "", "", "Net gain/loss:", section.get("net", section.get("net_before_exemption", ""))])
        writer.writerow(["", "", "", "", "", "", "", "Tax:", section.get("tax", "")])
        writer.writerow([])

    writer.writerow(["TOTAL TAX LIABILITY", "", "", "", "", "", "", "", data["summary"]["total_tax"]])
    return output.getvalue()
