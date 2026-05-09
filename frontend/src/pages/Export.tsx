import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePortfolioStore } from "../store";
import toast from "react-hot-toast";

export default function Export() {
  const { activePortfolioId } = usePortfolioStore();
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["schedule-cg", activePortfolioId],
    queryFn: () =>
      fetch(`/api/export/${activePortfolioId}/schedule-cg`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      }).then(r => r.json()),
    enabled: !!activePortfolioId,
  });

  async function downloadCSV() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/export/${activePortfolioId}/schedule-cg/csv`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `schedule_cg_fy${data?.fy || "2025-26"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Schedule CG downloaded");
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(false);
    }
  }

  const fmt = (n: number) => "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 2 }}>ITR-2 Export</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary,#888)" }}>
            Schedule CG data ready for ITR-2 filing · FY 2025–26
          </p>
        </div>
        <button onClick={downloadCSV} disabled={!data || downloading}
          style={{ padding: "9px 18px", fontSize: 13, fontWeight: 500, background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", opacity: data ? 1 : .5 }}>
          {downloading ? "Downloading..." : "Download Schedule CG CSV"}
        </button>
      </div>

      {isLoading && <div style={{ textAlign: "center", paddingTop: 40, color: "var(--color-text-secondary,#888)" }}>Loading...</div>}

      {data && (
        <>
          {/* STCG Section */}
          <div style={{ background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", background: "#FAEEDA", borderBottom: "0.5px solid #FAC775" }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#633806" }}>Section A — STCG under Section 111A (20%)</div>
              <div style={{ fontSize: 12, color: "#854F0B", marginTop: 2 }}>Equity held less than 12 months</div>
            </div>
            <SectionTable section={data.schedule_cg.A_stcg_111a} />
          </div>

          {/* LTCG Section */}
          <div style={{ background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", background: "#E1F5EE", borderBottom: "0.5px solid #9FE1CB" }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#085041" }}>Section B — LTCG under Section 112A (12.5%)</div>
              <div style={{ fontSize: 12, color: "#0F6E56", marginTop: 2 }}>Equity held 12+ months · ₹1,25,000 exemption applied</div>
            </div>
            <SectionTable section={data.schedule_cg.B_ltcg_112a} showExemption />
          </div>

          {/* Summary */}
          <div style={{ background: "var(--color-background-secondary,#f7f7f5)", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Filing summary</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                { label: "STCG tax payable", value: fmt(data.summary.total_stcg_tax), color: "#A32D2D" },
                { label: "LTCG tax payable", value: fmt(data.summary.total_ltcg_tax), color: "#A32D2D" },
                { label: "Total (Schedule CG)", value: fmt(data.summary.total_tax), color: "#A32D2D" },
              ].map(m => (
                <div key={m.label} style={{ background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary,#888)", marginBottom: 6 }}>{m.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 500, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 12, color: "var(--color-text-tertiary,#aaa)", lineHeight: 1.7 }}>
            <strong>Note:</strong> This export maps to Schedule CG of ITR-2 (AY 2026-27). 
            Verify with your CA before filing. Grandfathering provisions for pre-Jan 2018 purchases 
            may alter cost basis. STT charges and brokerage adjustments are not included.
          </div>
        </>
      )}
    </div>
  );
}

function SectionTable({ section, showExemption }: any) {
  const fmt = (n: number) => "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN");
  const txns = section.transactions || [];

  return (
    <div>
      {txns.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
              {["Scrip", "Purchase date", "Sale date", "Consideration", "Cost", "Gain/Loss"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontWeight: 500, color: "var(--color-text-secondary,#888)", fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {txns.map((t: any, i: number) => (
              <tr key={i} style={{ borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
                <td style={{ padding: "9px 12px", fontWeight: 500 }}>{t.name_of_scrip}</td>
                <td style={{ padding: "9px 12px", color: "var(--color-text-secondary,#888)" }}>{t.date_of_purchase}</td>
                <td style={{ padding: "9px 12px", color: "var(--color-text-secondary,#888)" }}>{t.date_of_sale}</td>
                <td style={{ padding: "9px 12px" }}>{fmt(t.full_value_of_consideration)}</td>
                <td style={{ padding: "9px 12px" }}>{fmt(t.cost_of_acquisition_total)}</td>
                <td style={{ padding: "9px 12px", fontWeight: 500, color: t.gain_loss >= 0 ? "#0F6E56" : "#A32D2D" }}>
                  {t.gain_loss >= 0 ? "+" : ""}{fmt(t.gain_loss)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ padding: "20px 16px", fontSize: 13, color: "var(--color-text-secondary,#888)" }}>No transactions in this category</div>
      )}
      <div style={{ padding: "12px 16px", borderTop: "0.5px solid var(--color-border-tertiary,#e5e5e5)", display: "flex", justifyContent: "flex-end", gap: 24, fontSize: 12 }}>
        {showExemption && <span style={{ color: "var(--color-text-secondary,#888)" }}>Exemption: {fmt(section.exemption_claimed || 0)}</span>}
        <span style={{ color: "var(--color-text-secondary,#888)" }}>Taxable: {fmt(section.taxable_amount ?? section.net ?? 0)}</span>
        <span style={{ fontWeight: 500 }}>Tax: {fmt(section.tax)}</span>
      </div>
    </div>
  );
}
