// ── Core domain types ─────────────────────────────────────────────────────────

export interface Holding {
  id:            number;
  portfolio_id:  number;
  symbol:        string;
  name:          string;
  quantity:      number;
  avg_buy_price: number;
  current_price: number;
  buy_date:      string;       // ISO date
  asset_type:    AssetType;
  isin?:         string;
  exchange?:     string;
}

export type AssetType = "equity" | "mf_equity" | "mf_debt" | "etf" | "bond";

export interface Portfolio {
  id:       number;
  name:     string;
  broker?:  string;
  holdings: Holding[];
}

// ── Tax engine output ─────────────────────────────────────────────────────────

export interface HoldingResult {
  symbol:          string;
  name:            string;
  quantity:        number;
  buy_price:       number;
  current_price:   number;
  pnl:             number;
  pnl_pct:         number;
  gain_type:       "STCG" | "LTCG";
  holding_months:  number;
  is_ltcg:         boolean;
  estimated_tax:   number;
  days_to_ltcg:    number;
  recommendation:  string;
}

export interface TaxSummary {
  ltcg_gains:          number;
  stcg_gains:          number;
  ltcg_losses:         number;
  stcg_losses:         number;
  ltcg_tax:            number;
  stcg_tax:            number;
  total_tax:           number;
  exemption_used:      number;
  exemption_remaining: number;
  harvest_potential:   number;
  harvest_tax_saving:  number;
  reset_opportunity:   boolean;
  holdings:            HoldingResult[];
}

export interface ScenarioResult {
  realized_pnl: number;
  tax_outgo:    number;
  net_proceeds: number;
}

// ── ML harvest ────────────────────────────────────────────────────────────────

export interface HarvestRec {
  symbol:           string;
  priority_score:   number;
  urgency:          "urgent" | "consider" | "hold";
  reason:           string;
  estimated_saving: number;
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export interface Alert {
  alert_type: "fy_deadline" | "ltcg_flip" | "large_loss" | "reset_opportunity" | "exemption_limit";
  severity:   "high" | "medium" | "low";
  symbol:     string | null;
  title:      string;
  body:       string;
  action:     string;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  token_type:   string;
}
