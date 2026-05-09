from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date
import csv
import io
from app.core.config import get_db
from app.core.security import get_current_user
from app.models.models import User, Portfolio, Holding

router = APIRouter()

# ─── Broker CSV format detectors ──────────────────────────────────────────────

def detect_broker(headers: List[str]) -> str:
    h = [x.lower().strip() for x in headers]
    if "tradingsymbol" in h and "instrument_type" in h:
        return "zerodha"
    if "stock name" in h and "current value" in h:
        return "groww"
    if "scrip name" in h and "net qty" in h:
        return "upstox"
    return "generic"


def parse_zerodha(reader) -> List[dict]:
    rows = []
    for row in reader:
        try:
            rows.append({
                "symbol":        row.get("tradingsymbol", "").strip(),
                "name":          row.get("tradingsymbol", "").strip(),
                "quantity":      float(row.get("quantity", 0)),
                "avg_buy_price": float(row.get("average_price", 0)),
                "buy_date":      _parse_date(row.get("buy_date") or row.get("date", "")),
                "current_price": float(row.get("last_price", 0) or row.get("close_price", 0)),
                "asset_type":    "equity",
            })
        except Exception:
            continue
    return rows


def parse_groww(reader) -> List[dict]:
    rows = []
    for row in reader:
        try:
            rows.append({
                "symbol":        row.get("Symbol", row.get("stock name", "")).strip().upper(),
                "name":          row.get("stock name", "").strip(),
                "quantity":      float(row.get("Quantity", row.get("units held", 0))),
                "avg_buy_price": float(row.get("Average Buy Price", row.get("avg buy price", 0))),
                "buy_date":      _parse_date(row.get("Date of Purchase", "")),
                "current_price": float(row.get("LTP", row.get("current nav", 0))),
                "asset_type":    "equity",
            })
        except Exception:
            continue
    return rows


def parse_generic(reader) -> List[dict]:
    """Fallback: try to map any CSV with common column names."""
    symbol_keys  = ["symbol","scrip","stock","ticker","tradingsymbol","scrip name","stock name"]
    qty_keys     = ["quantity","qty","units","net qty","shares"]
    price_keys   = ["avg_buy_price","average_price","buy price","avg cost","purchase price","avg buy price"]
    cmp_keys     = ["current_price","cmp","ltp","last_price","market price","close_price"]
    date_keys    = ["buy_date","purchase_date","date","trade_date","date of purchase"]

    def find(row, keys):
        for k in keys:
            for rk in row.keys():
                if k.lower() == rk.lower().strip():
                    return row[rk]
        return None

    rows = []
    for row in reader:
        try:
            rows.append({
                "symbol":        (find(row, symbol_keys) or "").strip().upper(),
                "name":          (find(row, symbol_keys) or "").strip(),
                "quantity":      float(find(row, qty_keys) or 0),
                "avg_buy_price": float(find(row, price_keys) or 0),
                "buy_date":      _parse_date(find(row, date_keys) or ""),
                "current_price": float(find(row, cmp_keys) or 0),
                "asset_type":    "equity",
            })
        except Exception:
            continue
    return [r for r in rows if r["symbol"] and r["quantity"] > 0]


def _parse_date(val: str) -> date:
    if not val:
        return date.today()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%d %b %Y", "%Y/%m/%d"):
        try:
            from datetime import datetime
            return datetime.strptime(val.strip(), fmt).date()
        except Exception:
            continue
    return date.today()


# ─── Upload endpoint ───────────────────────────────────────────────────────────

@router.post("/{portfolio_id}/csv")
async def upload_csv(portfolio_id: int, file: UploadFile = File(...),
                     user: User = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    p = db.query(Portfolio).filter(Portfolio.id == portfolio_id, Portfolio.user_id == user.id).first()
    if not p:
        raise HTTPException(404, "Portfolio not found")
    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only CSV files supported")

    content = await file.read()
    text = content.decode("utf-8-sig")
    reader_obj = csv.DictReader(io.StringIO(text))
    headers = reader_obj.fieldnames or []
    broker = detect_broker(headers)

    parsers = {"zerodha": parse_zerodha, "groww": parse_groww}
    parse_fn = parsers.get(broker, parse_generic)
    rows = parse_fn(reader_obj)

    if not rows:
        raise HTTPException(422, "No valid holdings found in CSV")

    added = 0
    for r in rows:
        if not r["symbol"]:
            continue
        h = Holding(portfolio_id=portfolio_id, **r)
        db.add(h)
        added += 1
    db.commit()

    return {"broker_detected": broker, "holdings_imported": added}
