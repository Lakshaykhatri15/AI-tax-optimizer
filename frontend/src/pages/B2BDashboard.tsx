import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { b2bAPI } from "../services/api";

const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function B2BDashboard() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", pan_number: "", password: "ChangeMe@123" });

  const { data: overview = [], isLoading } = useQuery({
    queryKey: ["b2b-overview"],
    queryFn:  b2bAPI.taxOverview,
  });

  const { data: clientDetail } = useQuery({
    queryKey: ["b2b-client", selected],
    queryFn:  () => b2bAPI.clientSummary(selected!),
    enabled:  !!selected,
  });

  const createMut = useMutation({
    mutationFn: () => b2bAPI.createClient(form),
    onSuccess: () => {
      toast.success("Client created");
      setShowCreate(false);
      setForm({ email: "", full_name: "", pan_number: "", password: "ChangeMe@123" });
      qc.invalidateQueries({ queryKey: ["b2b-overview"] });
    },
    onError: () => toast.error("Failed to create client"),
  });

  const totalTax     = (overview as any[]).reduce((s: number, c: any) => s + c.total_tax, 0);
  const totalSaving  = (overview as any[]).reduce((s: number, c: any) => s + c.harvest_saving, 0);

  const inp: any = { width: "100%", padding: "7px 10px", fontSize: 12, border: "0.5px solid var(--color-border-secondary,#ccc)", borderRadius: 6, background: "var(--color-background-primary,#fff)", color: "var(--color-text-primary,#1a1a1a)", marginTop: 3 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 2 }}>CA dashboard</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary,#888)" }}>
            Manage all client portfolios · Aggregate tax overview
          </p>
        </div>
        <button onClick={() => setShowCreate(v => !v)}
          style={{ padding: "8px 16px", fontSize: 12, fontWeight: 500, background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          + New client
        </button>
      </div>

      {/* Aggregate metrics */}
      <div style={{ display: "flex", gap: 12 }}>
        {[
          { label: "Total clients",     value: (overview as any[]).length, color: "var(--color-text-primary)" },
          { label: "Total tax liability", value: fmt(totalTax),  color: "#A32D2D" },
          { label: "Harvest savings",    value: fmt(totalSaving), color: "#0F6E56" },
        ].map(m => (
          <div key={m.label} style={{ flex: 1, background: "var(--color-background-secondary,#f7f7f5)", borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary,#888)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".5px" }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Create client form */}
      {showCreate && (
        <div style={{ background: "var(--color-background-secondary,#f7f7f5)", borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Create client account</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              ["full_name",   "Full name",    "text"],
              ["email",       "Email",        "email"],
              ["pan_number",  "PAN number",   "text"],
              ["password",    "Temp password","password"],
            ].map(([k, label, type]) => (
              <div key={k}>
                <label style={{ fontSize: 11, color: "var(--color-text-secondary,#888)", display: "block" }}>{label}</label>
                <input type={type} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={inp} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => createMut.mutate()} disabled={createMut.isPending}
              style={{ padding: "8px 16px", fontSize: 12, fontWeight: 500, background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
              {createMut.isPending ? "Creating..." : "Create client"}
            </button>
            <button onClick={() => setShowCreate(false)}
              style={{ padding: "8px 16px", fontSize: 12, border: "0.5px solid var(--color-border-secondary,#ccc)", borderRadius: 8, background: "none", cursor: "pointer", color: "var(--color-text-secondary,#888)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Client table */}
      <div style={{ display: "grid", gridTemplateColumns: clientDetail ? "1fr 1fr" : "1fr", gap: 16 }}>
        <div style={{ background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 12, overflow: "hidden" }}>
          {isLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary,#888)" }}>Loading clients...</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
                  {["Client", "Portfolios", "Tax liability", "Harvest saving", ""].map(h => (
                    <th key={h} style={{ textAlign: "left", fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary,#888)", padding: "10px 12px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(overview as any[]).length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--color-text-secondary,#888)", fontSize: 13 }}>No clients yet. Create one above.</td></tr>
                ) : (overview as any[]).map((c: any) => (
                  <tr key={c.client_id}
                    onClick={() => setSelected(selected === c.client_id ? null : c.client_id)}
                    style={{ borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)", cursor: "pointer", background: selected === c.client_id ? "#EEEDFE" : "transparent" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{c.client_name}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary,#888)" }}>{c.pan_number || c.email}</div>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 13 }}>{c.portfolios}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 500, color: "#A32D2D" }}>{fmt(c.total_tax)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#0F6E56" }}>{fmt(c.harvest_saving)}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 12, color: "#534AB7" }}>{selected === c.client_id ? "▲ Hide" : "▼ Detail"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Client detail panel */}
        {clientDetail && (
          <div style={{ background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{clientDetail.client.name}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary,#888)", marginBottom: 14 }}>PAN: {clientDetail.client.pan || "—"}</div>
            {clientDetail.portfolios.map((p: any) => (
              <div key={p.portfolio_id} style={{ padding: "10px 0", borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{p.portfolio_name}</span>
                  <span style={{ fontSize: 13, color: "#A32D2D", fontWeight: 500 }}>{fmt(p.total_tax)}</span>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--color-text-secondary,#888)" }}>
                  <span>LTCG: {fmt(p.ltcg_tax)}</span>
                  <span>STCG: {fmt(p.stcg_tax)}</span>
                  <span style={{ color: "#0F6E56" }}>Save: {fmt(p.harvest_saving)}</span>
                  <span>{p.holdings_count} holdings</span>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "0.5px solid var(--color-border-tertiary,#e5e5e5)", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Grand total tax</span>
              <span style={{ fontSize: 15, fontWeight: 500, color: "#A32D2D" }}>{fmt(clientDetail.grand_total_tax)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
