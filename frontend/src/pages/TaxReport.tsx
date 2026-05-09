// ── TaxReport.tsx ─────────────────────────────────────────────────────────────
import { useQuery } from "@tanstack/react-query";
import { usePortfolioStore } from "../store";
import { taxAPI } from "../services/api";

const fmt = (n: number) => "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN");

export default function TaxReport() {
  const { activePortfolioId } = usePortfolioStore();
  const { data, isLoading } = useQuery({
    queryKey: ["tax-summary", activePortfolioId],
    queryFn: () => taxAPI.summary(activePortfolioId!),
    enabled: !!activePortfolioId,
  });

  if (!activePortfolioId) return <Msg text="Select a portfolio first." />;
  if (isLoading) return <Msg text="Loading..." />;
  if (!data) return <Msg text="No data." />;

  const rows = [
    { label: "LTCG gains (equity held ≥ 12 months)", value: fmt(data.ltcg_gains), note: "Gross gains before exemption" },
    { label: "LTCG losses", value: fmt(data.ltcg_losses), note: "Reduces LTCG taxable amount" },
    { label: "LTCG exemption (Budget 2024)", value: "₹1,25,000", note: "Annual flat exemption — resets every April" },
    { label: "LTCG taxable amount", value: fmt(data.ltcg_taxable), note: "After exemption and loss offset", highlight: true },
    { label: "LTCG tax @ 12.5%", value: fmt(data.ltcg_tax), note: "", bold: true },
    { label: "", value: "", note: "" },
    { label: "STCG gains (equity held < 12 months)", value: fmt(data.stcg_gains), note: "Gross gains" },
    { label: "STCG losses", value: fmt(data.stcg_losses), note: "Reduces STCG taxable amount" },
    { label: "STCG taxable amount", value: fmt(data.stcg_taxable), note: "After loss offset", highlight: true },
    { label: "STCG tax @ 20%", value: fmt(data.stcg_tax), note: "", bold: true },
    { label: "", value: "", note: "" },
    { label: "Total estimated tax liability", value: fmt(data.total_tax), note: "FY 2025–26", bold: true, big: true },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 2 }}>Tax report</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary,#888)" }}>Detailed capital gains computation · FY 2025–26</p>
      </div>

      <div style={{ background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {rows.map((r, i) => r.label ? (
              <tr key={i} style={{ borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)", background: r.highlight ? "var(--color-background-secondary,#f7f7f5)" : "transparent" }}>
                <td style={{ padding: "11px 16px", fontSize: r.big ? 14 : 13, fontWeight: r.bold ? 500 : 400, color: "var(--color-text-primary,#1a1a1a)" }}>{r.label}</td>
                <td style={{ padding: "11px 16px", fontSize: 12, color: "var(--color-text-tertiary,#aaa)" }}>{r.note}</td>
                <td style={{ padding: "11px 16px", fontSize: r.big ? 16 : 13, fontWeight: r.bold ? 500 : 400, textAlign: "right", color: r.big ? "#A32D2D" : "var(--color-text-primary,#1a1a1a)" }}>{r.value}</td>
              </tr>
            ) : <tr key={i} style={{ height: 8 }} />)}
          </tbody>
        </table>
      </div>

      <div style={{ background: "var(--color-background-secondary,#f7f7f5)", borderRadius: 10, padding: 14, fontSize: 12, color: "var(--color-text-secondary,#888)", lineHeight: 1.7 }}>
        <strong>Disclaimer:</strong> This is an estimate based on the holding data you've provided and Indian tax rules as of Budget 2024. Actual tax may differ based on grandfathering provisions, STT paid, indexation (for applicable assets), and other adjustments. Consult a CA before filing.
      </div>
    </div>
  );
}

function Msg({ text }: { text: string }) {
  return <div style={{ textAlign: "center", paddingTop: 80, color: "var(--color-text-secondary,#888)", fontSize: 14 }}>{text}</div>;
}
