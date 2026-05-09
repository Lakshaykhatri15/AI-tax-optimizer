import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { usePortfolioStore } from "../store";
import { portfolioAPI } from "../services/api";

const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function HoldingRow({ holding, portfolioId, onDelete }: any) {
  const pnl = (holding.current_price - holding.avg_buy_price) * holding.quantity;
  const pnlPct = ((holding.current_price - holding.avg_buy_price) / holding.avg_buy_price * 100).toFixed(1);
  return (
    <tr>
      <td style={{ padding: "10px 12px" }}>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{holding.symbol}</div>
        <div style={{ fontSize: 11, color: "var(--color-text-secondary,#888)" }}>{holding.name}</div>
      </td>
      <td style={{ padding: "10px 12px", fontSize: 13 }}>{holding.quantity}</td>
      <td style={{ padding: "10px 12px", fontSize: 13 }}>{fmt(holding.avg_buy_price)}</td>
      <td style={{ padding: "10px 12px", fontSize: 13 }}>{fmt(holding.current_price)}</td>
      <td style={{ padding: "10px 12px", fontSize: 13, color: pnl >= 0 ? "#0F6E56" : "#A32D2D", fontWeight: 500 }}>
        {pnl >= 0 ? "+" : ""}{fmt(pnl)}
        <div style={{ fontSize: 11, fontWeight: 400 }}>{pnlPct}%</div>
      </td>
      <td style={{ padding: "10px 12px" }}>
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, fontWeight: 500, background: holding.asset_type === "equity" ? "#E6F1FB" : "#EEEDFE", color: holding.asset_type === "equity" ? "#0C447C" : "#3C3489" }}>
          {holding.asset_type}
        </span>
      </td>
      <td style={{ padding: "10px 12px" }}>
        <button onClick={() => onDelete(holding.id)} style={{ fontSize: 11, padding: "3px 8px", border: "0.5px solid #F09595", borderRadius: 6, background: "none", cursor: "pointer", color: "#A32D2D" }}>Remove</button>
      </td>
    </tr>
  );
}

function AddHoldingForm({ portfolioId, onDone }: any) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ symbol: "", name: "", quantity: "", avg_buy_price: "", buy_date: "", current_price: "", asset_type: "equity" });
  const mut = useMutation({
    mutationFn: () => portfolioAPI.addHolding(portfolioId, { ...form, quantity: Number(form.quantity), avg_buy_price: Number(form.avg_buy_price), current_price: Number(form.current_price) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["portfolios"] }); qc.invalidateQueries({ queryKey: ["tax-summary"] }); toast.success("Holding added"); onDone(); },
    onError: () => toast.error("Failed to add holding"),
  });
  const field = (k: string, label: string, type = "text", extra?: any) => (
    <div>
      <label style={{ fontSize: 11, color: "var(--color-text-secondary,#888)", display: "block", marginBottom: 4 }}>{label}</label>
      {extra?.options ? (
        <select value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={inputStyle}>
          {extra.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={inputStyle} placeholder={extra?.placeholder} />
      )}
    </div>
  );
  return (
    <div style={{ background: "var(--color-background-secondary,#f7f7f5)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Add holding manually</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {field("symbol", "Symbol", "text", { placeholder: "RELIANCE" })}
        {field("name", "Company name")}
        {field("quantity", "Quantity", "number")}
        {field("avg_buy_price", "Buy price (₹)", "number")}
        {field("current_price", "Current price (₹)", "number")}
        {field("buy_date", "Buy date", "date")}
        {field("asset_type", "Asset type", "text", { options: ["equity", "mf_equity", "mf_debt", "etf", "bond"] })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={() => mut.mutate()} disabled={mut.isPending} style={btnPrimary}>
          {mut.isPending ? "Adding..." : "Add holding"}
        </button>
        <button onClick={onDone} style={btnSecondary}>Cancel</button>
      </div>
    </div>
  );
}

const inputStyle: any = { width: "100%", padding: "7px 10px", fontSize: 12, border: "0.5px solid var(--color-border-secondary,#ccc)", borderRadius: 6, background: "var(--color-background-primary,#fff)", color: "var(--color-text-primary,#1a1a1a)" };
const btnPrimary: any = { padding: "8px 16px", fontSize: 12, fontWeight: 500, background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" };
const btnSecondary: any = { padding: "8px 16px", fontSize: 12, border: "0.5px solid var(--color-border-secondary,#ccc)", borderRadius: 8, background: "none", cursor: "pointer", color: "var(--color-text-primary,#1a1a1a)" };

export default function Portfolio() {
  const { activePortfolioId } = usePortfolioStore();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data: portfolios = [], isLoading } = useQuery({ queryKey: ["portfolios"], queryFn: portfolioAPI.list });
  const portfolio = (portfolios as any[]).find((p: any) => p.id === activePortfolioId);

  const deleteMut = useMutation({
    mutationFn: (holdingId: number) => portfolioAPI.deleteHolding(activePortfolioId!, holdingId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["portfolios"] }); qc.invalidateQueries({ queryKey: ["tax-summary"] }); toast.success("Removed"); },
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => portfolioAPI.uploadCSV(activePortfolioId!, file),
    onSuccess: (d: any) => { qc.invalidateQueries({ queryKey: ["portfolios"] }); qc.invalidateQueries({ queryKey: ["tax-summary"] }); toast.success(`Imported ${d.holdings_imported} holdings from ${d.broker_detected}`); },
    onError: () => toast.error("Upload failed. Check CSV format."),
  });

  const onDrop = useCallback((files: File[]) => { if (files[0]) uploadMut.mutate(files[0]); }, [activePortfolioId]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { "text/csv": [".csv"] }, maxFiles: 1 });

  if (!activePortfolioId) return <div style={{ paddingTop: 80, textAlign: "center", color: "var(--color-text-secondary,#888)" }}>No portfolio selected</div>;
  if (isLoading) return <div style={{ paddingTop: 80, textAlign: "center", color: "var(--color-text-secondary,#888)" }}>Loading...</div>;

  const holdings = portfolio?.holdings || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 2 }}>Portfolio</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary,#888)" }}>{holdings.length} holdings · {portfolio?.name}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowAdd(v => !v)} style={btnPrimary}>+ Add holding</button>
        </div>
      </div>

      {/* CSV Upload */}
      <div {...getRootProps()} style={{ border: `1.5px dashed ${isDragActive ? "#534AB7" : "var(--color-border-secondary,#ccc)"}`, borderRadius: 10, padding: 20, textAlign: "center", cursor: "pointer", background: isDragActive ? "#EEEDFE22" : "transparent", transition: "all .15s" }}>
        <input {...getInputProps()} />
        <div style={{ fontSize: 24, marginBottom: 6 }}>📁</div>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{uploadMut.isPending ? "Importing..." : "Drop broker CSV here"}</div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary,#888)" }}>Zerodha · Groww · Upstox · Generic CSV</div>
      </div>

      {showAdd && <AddHoldingForm portfolioId={activePortfolioId} onDone={() => setShowAdd(false)} />}

      {/* Holdings table */}
      <div style={{ background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
              {["Symbol", "Qty", "Buy price", "CMP", "P&L", "Type", ""].map(h => (
                <th key={h} style={{ textAlign: "left", fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary,#888)", padding: "10px 12px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holdings.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary,#888)", fontSize: 13 }}>No holdings yet. Add manually or upload a CSV.</td></tr>
            ) : holdings.map((h: any) => (
              <HoldingRow key={h.id} holding={h} portfolioId={activePortfolioId} onDelete={(id: number) => deleteMut.mutate(id)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
