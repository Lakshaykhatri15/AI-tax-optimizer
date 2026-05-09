// ── Currency & number formatting ──────────────────────────────────────────────

export const fmt = {
  currency: (n: number) =>
    "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN"),

  currencySigned: (n: number) =>
    (n >= 0 ? "+" : "-") + "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN"),

  pct: (n: number, decimals = 1) =>
    (n >= 0 ? "+" : "") + n.toFixed(decimals) + "%",

  compact: (n: number) => {
    if (Math.abs(n) >= 1_00_00_000) return "₹" + (n / 1_00_00_000).toFixed(1) + "Cr";
    if (Math.abs(n) >= 1_00_000)   return "₹" + (n / 1_00_000).toFixed(1) + "L";
    if (Math.abs(n) >= 1_000)      return "₹" + (n / 1_000).toFixed(1) + "k";
    return "₹" + Math.round(n);
  },
};


// ── Date helpers ──────────────────────────────────────────────────────────────

export function holdingMonths(buyDate: string): number {
  const buy = new Date(buyDate);
  const now = new Date();
  return (now.getFullYear() - buy.getFullYear()) * 12 + (now.getMonth() - buy.getMonth());
}

export function isLTCG(buyDate: string): boolean {
  return holdingMonths(buyDate) >= 12;
}

export function daysToLTCG(buyDate: string): number {
  const buy  = new Date(buyDate);
  const ltcg = new Date(buy.getFullYear() + 1, buy.getMonth(), buy.getDate());
  const now  = new Date();
  const days = Math.ceil((ltcg.getTime() - now.getTime()) / 86_400_000);
  return Math.max(0, days);
}

export function daysToFYEnd(): number {
  const now  = new Date();
  const fyEnd = new Date(now.getMonth() < 3 ? now.getFullYear() : now.getFullYear() + 1, 2, 31);
  return Math.ceil((fyEnd.getTime() - now.getTime()) / 86_400_000);
}

export function currentFY(): string {
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}–${String(start + 1).slice(2)}`;
}


// ── CSV client-side parser ────────────────────────────────────────────────────

export interface ParsedHolding {
  symbol:        string;
  name:          string;
  quantity:      number;
  avg_buy_price: number;
  buy_date:      string;
  current_price: number;
  asset_type:    string;
}

export function parseCSV(text: string): ParsedHolding[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
  const find    = (keys: string[]) => keys.find(k => headers.includes(k));

  const symKey   = find(["symbol","tradingsymbol","scrip","stock","ticker"]);
  const qtyKey   = find(["quantity","qty","units","net qty"]);
  const priceKey = find(["avg_buy_price","average_price","buy price","avg cost","avg buy price"]);
  const cmpKey   = find(["current_price","cmp","ltp","last_price","market price"]);
  const dateKey  = find(["buy_date","purchase_date","date","trade_date","date of purchase"]);

  if (!symKey || !qtyKey) return [];

  return lines
    .slice(1)
    .map(line => {
      const cols = line.split(",").map(c => c.trim().replace(/"/g, ""));
      const get  = (key: string | undefined) => key ? cols[headers.indexOf(key)] || "" : "";

      const symbol = get(symKey).toUpperCase();
      const qty    = parseFloat(get(qtyKey));
      const price  = parseFloat(get(priceKey || ""));
      const cmp    = parseFloat(get(cmpKey || ""));
      const dateRaw = get(dateKey || "");

      if (!symbol || isNaN(qty) || qty <= 0) return null;

      return {
        symbol,
        name:          symbol,
        quantity:      qty,
        avg_buy_price: isNaN(price) ? 0 : price,
        buy_date:      parseDateStr(dateRaw) || new Date().toISOString().split("T")[0],
        current_price: isNaN(cmp) ? (isNaN(price) ? 0 : price) : cmp,
        asset_type:    "equity",
      } as ParsedHolding;
    })
    .filter(Boolean) as ParsedHolding[];
}

function parseDateStr(raw: string): string | null {
  if (!raw) return null;
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/,          // YYYY-MM-DD
    /^(\d{2})-(\d{2})-(\d{4})$/,          // DD-MM-YYYY
    /^(\d{2})\/(\d{2})\/(\d{4})$/,        // DD/MM/YYYY
  ];
  for (const fmt of formats) {
    const m = raw.match(fmt);
    if (m) {
      const [, a, b, c] = m;
      if (c.length === 4) return `${c}-${b}-${a}`;  // YYYY-MM-DD
      return `${a}-${b}-${c}`;
    }
  }
  return null;
}


// ── Tax calculation helpers (client-side, mirrors backend) ────────────────────

const LTCG_EXEMPTION = 125_000;

export function estimateTax(pnl: number, isLtcg: boolean): number {
  if (pnl <= 0) return 0;
  if (isLtcg) return Math.max(0, pnl - LTCG_EXEMPTION) * 0.125;
  return pnl * 0.20;
}

export function harvestSaving(loss: number, isLtcg: boolean): number {
  return Math.abs(Math.min(0, loss)) * (isLtcg ? 0.125 : 0.20);
}
