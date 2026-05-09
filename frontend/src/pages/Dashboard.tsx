import { useQuery } from "@tanstack/react-query";
import { usePortfolioStore } from "../store";
import { taxAPI } from "../services/api";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const fmt = (n: number) => "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN");
const COLORS = ["#534AB7", "#1D9E75", "#D85A30", "#E24B4A", "#BA7517"];

function MetricCard({ label, value, sub, color }: any) {
  return (
    <div style={{ background: "var(--color-background-secondary,#f7f7f5)", borderRadius: 8, padding: 16, flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: "var(--color-text-secondary,#888)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: color || "var(--color-text-primary,#1a1a1a)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--color-text-tertiary,#aaa)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { activePortfolioId } = usePortfolioStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ["tax-summary", activePortfolioId],
    queryFn: () => taxAPI.summary(activePortfolioId!),
    enabled: !!activePortfolioId,
  });

  if (!activePortfolioId) return <Empty msg="No portfolio selected. Create one in Portfolio tab." />;
  if (isLoading) return <Spinner />;
  if (error || !data) return <Empty msg="Failed to load. Ensure your backend is running." />;

  const pieData = [
    { name: "LTCG tax", value: Math.round(data.ltcg_tax) },
    { name: "STCG tax", value: Math.round(data.stcg_tax) },
  ].filter(d => d.value > 0);

  const barData = data.holdings
    .slice()
    .sort((a: any, b: any) => b.pnl - a.pnl)
    .slice(0, 8)
    .map((h: any) => ({ name: h.symbol, pnl: Math.round(h.pnl), fill: h.pnl >= 0 ? "#1D9E75" : "#E24B4A" }));

  const exemptPct = Math.min(100, Math.round((data.exemption_used / 125000) * 100));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 2 }}>Dashboard</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary,#888)" }}>FY 2025–26 tax summary for your portfolio</p>
      </div>

      {/* Metrics */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <MetricCard label="Total tax liability" value={fmt(data.total_tax)} sub="Estimated for FY 2025–26" color="#A32D2D" />
        <MetricCard label="LTCG gains" value={fmt(data.ltcg_gains)} sub="Held ≥ 12 months · 12.5%" color="#854F0B" />
        <MetricCard label="STCG gains" value={fmt(data.stcg_gains)} sub="Held < 12 months · 20%" color="#854F0B" />
        <MetricCard label="Harvest saving" value={fmt(data.harvest_tax_saving)} sub="If all losses harvested" color="#0F6E56" />
      </div>

      {/* Exemption tracker */}
      <div style={{ background: "#E1F5EE", border: "0.5px solid #9FE1CB", borderRadius: 10, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#085041" }}>₹1.25L LTCG exemption tracker</span>
          <span style={{ fontSize: 12, color: "#0F6E56" }}>{fmt(data.exemption_used)} used · {fmt(data.exemption_remaining)} remaining</span>
        </div>
        <div style={{ height: 6, background: "#9FE1CB", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: exemptPct + "%", background: "#0F6E56", borderRadius: 99, transition: "width .5s" }} />
        </div>
        {data.reset_opportunity && (
          <div style={{ fontSize: 12, color: "#085041", marginTop: 8 }}>
            ✦ Tip: Book profits under ₹1.25L and reinvest to reset your cost basis — zero tax triggered.
          </div>
        )}
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16 }}>
        <div style={{ background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16 }}>Tax breakdown</div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ₹${value.toLocaleString("en-IN")}`} labelLine={false} fontSize={11}>
                  {pieData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => "₹" + Number(v).toLocaleString("en-IN")} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div style={{ fontSize: 13, color: "var(--color-text-secondary,#888)", textAlign: "center", paddingTop: 60 }}>No tax liability</div>}
        </div>

        <div style={{ background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16 }}>P&amp;L by holding</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => "₹" + (v / 1000).toFixed(0) + "k"} />
              <Tooltip formatter={(v: any) => "₹" + Number(v).toLocaleString("en-IN")} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {barData.map((entry: any, i: number) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top recommendations */}
      <div style={{ background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Action items</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.holdings
            .filter((h: any) => h.recommendation !== "Hold — no immediate action needed")
            .slice(0, 5)
            .map((h: any, i: number) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--color-background-secondary,#f7f7f5)", borderRadius: 8 }}>
                <div>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{h.symbol}</span>
                  <span style={{ marginLeft: 8, fontSize: 10, padding: "2px 7px", borderRadius: 99, background: h.gain_type === "LTCG" ? "#E1F5EE" : "#FAEEDA", color: h.gain_type === "LTCG" ? "#085041" : "#633806", fontWeight: 500 }}>{h.gain_type}</span>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary,#888)", marginTop: 3 }}>{h.recommendation}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: h.pnl >= 0 ? "#0F6E56" : "#A32D2D" }}>{h.pnl >= 0 ? "+" : ""}{fmt(h.pnl)}</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-tertiary,#aaa)" }}>tax: {fmt(h.estimated_tax)}</div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ textAlign: "center", paddingTop: 80, color: "var(--color-text-secondary,#888)", fontSize: 14 }}>{msg}</div>;
}
function Spinner() {
  return <div style={{ textAlign: "center", paddingTop: 80, color: "var(--color-text-secondary,#888)" }}>Loading...</div>;
}
