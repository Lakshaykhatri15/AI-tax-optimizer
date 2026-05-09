import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePortfolioStore } from "../store";
import { taxAPI, portfolioAPI } from "../services/api";

const fmt = (n: number) => "₹" + Math.round(Math.abs(n)).toLocaleString("en-IN");

export default function Scenario() {
  const { activePortfolioId } = usePortfolioStore();
  const [sellMap, setSellMap] = useState<Record<string, number>>({});
  const [result, setResult] = useState<any>(null);

  const { data: portfolios = [] } = useQuery({ queryKey: ["portfolios"], queryFn: portfolioAPI.list });
  const portfolio = (portfolios as any[]).find((p: any) => p.id === activePortfolioId);
  const holdings = portfolio?.holdings || [];

  const scenarioMut = useMutation({
    mutationFn: () => taxAPI.scenario(activePortfolioId!, sellMap),
    onSuccess: (d) => setResult(d),
  });

  function setQty(symbol: string, qty: number) {
    setSellMap(prev => qty > 0 ? { ...prev, [symbol]: qty } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== symbol)));
  }

  const totalSelected = Object.values(sellMap).reduce((s, v) => s + v, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 2 }}>Scenario simulator</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary,#888)" }}>
          Enter quantities to sell and see the real-time tax impact before you place the trade.
        </p>
      </div>

      {holdings.length === 0 && (
        <div style={{ textAlign: "center", paddingTop: 60, color: "var(--color-text-secondary,#888)", fontSize: 14 }}>Add holdings to your portfolio first.</div>
      )}

      {holdings.length > 0 && (
        <>
          <div style={{ background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
                  {["Stock", "Type", "Held", "P&L / share", "Max qty", "Sell qty", "Est. tax"].map(h => (
                    <th key={h} style={{ textAlign: "left", fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary,#888)", padding: "10px 12px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holdings.map((h: any) => {
                  const pnlPerShare = h.current_price - h.avg_buy_price;
                  const qty = sellMap[h.symbol] || 0;
                  const pnl = pnlPerShare * qty;
                  const isLtcg = (() => {
                    const buy = new Date(h.buy_date);
                    const now = new Date();
                    const months = (now.getFullYear() - buy.getFullYear()) * 12 + (now.getMonth() - buy.getMonth());
                    return months >= 12;
                  })();
                  const tax = qty > 0 ? (isLtcg ? Math.max(0, pnl - 125000) * 0.125 : pnl * 0.20) : 0;
                  return (
                    <tr key={h.id} style={{ borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{h.symbol}</div>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, fontWeight: 500, background: isLtcg ? "#E1F5EE" : "#FAEEDA", color: isLtcg ? "#085041" : "#633806" }}>
                          {isLtcg ? "LTCG" : "STCG"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--color-text-secondary,#888)" }}>
                        {(() => { const b = new Date(h.buy_date); const n = new Date(); return (n.getFullYear()-b.getFullYear())*12+(n.getMonth()-b.getMonth()); })()}m
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: pnlPerShare >= 0 ? "#0F6E56" : "#A32D2D", fontWeight: 500 }}>
                        {pnlPerShare >= 0 ? "+" : ""}{fmt(pnlPerShare)}
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 13 }}>{h.quantity}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <input
                          type="number" min={0} max={h.quantity} value={sellMap[h.symbol] || ""}
                          onChange={e => setQty(h.symbol, Math.min(h.quantity, Math.max(0, parseInt(e.target.value) || 0)))}
                          placeholder="0"
                          style={{ width: 72, padding: "5px 8px", fontSize: 12, border: `0.5px solid ${qty > 0 ? "#534AB7" : "var(--color-border-secondary,#ccc)"}`, borderRadius: 6, background: "var(--color-background-primary,#fff)", color: "var(--color-text-primary,#1a1a1a)" }}
                        />
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: tax > 0 ? "#A32D2D" : "var(--color-text-tertiary,#aaa)", fontWeight: tax > 0 ? 500 : 400 }}>
                        {qty > 0 ? fmt(tax) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => scenarioMut.mutate()}
              disabled={totalSelected === 0 || scenarioMut.isPending}
              style={{ padding: "9px 20px", fontSize: 13, fontWeight: 500, background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, cursor: totalSelected > 0 ? "pointer" : "not-allowed", opacity: totalSelected > 0 ? 1 : .5 }}>
              {scenarioMut.isPending ? "Calculating..." : "Calculate scenario"}
            </button>
            <button onClick={() => { setSellMap({}); setResult(null); }} style={{ padding: "9px 16px", fontSize: 13, border: "0.5px solid var(--color-border-secondary,#ccc)", borderRadius: 8, background: "none", cursor: "pointer", color: "var(--color-text-secondary,#888)" }}>
              Clear
            </button>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary,#888)" }}>{totalSelected} shares selected across {Object.keys(sellMap).length} stocks</span>
          </div>

          {result && (
            <div style={{ background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16 }}>Scenario result</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div style={{ background: result.realized_pnl >= 0 ? "#E1F5EE" : "#FCEBEB", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 11, color: result.realized_pnl >= 0 ? "#085041" : "#791F1F", marginBottom: 4 }}>Realized P&amp;L</div>
                  <div style={{ fontSize: 20, fontWeight: 500, color: result.realized_pnl >= 0 ? "#0F6E56" : "#A32D2D" }}>
                    {result.realized_pnl >= 0 ? "+" : "-"}{fmt(result.realized_pnl)}
                  </div>
                </div>
                <div style={{ background: "#FCEBEB", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 11, color: "#791F1F", marginBottom: 4 }}>Tax outgo</div>
                  <div style={{ fontSize: 20, fontWeight: 500, color: "#A32D2D" }}>{fmt(result.tax_outgo)}</div>
                </div>
                <div style={{ background: "#E1F5EE", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 11, color: "#085041", marginBottom: 4 }}>Net take-home</div>
                  <div style={{ fontSize: 20, fontWeight: 500, color: "#0F6E56" }}>{fmt(result.net_proceeds)}</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
