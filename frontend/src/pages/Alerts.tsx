import { useAlerts, usePriceSync } from "../hooks";
import toast from "react-hot-toast";

const SEV: Record<string, { bg: string; border: string; dot: string; label: string; text: string }> = {
  high:   { bg: "#FCEBEB", border: "#F09595", dot: "#E24B4A", label: "Urgent",  text: "#791F1F" },
  medium: { bg: "#FAEEDA", border: "#FAC775", dot: "#EF9F27", label: "Action",  text: "#633806" },
  low:    { bg: "#E1F5EE", border: "#9FE1CB", dot: "#1D9E75", label: "Info",    text: "#085041" },
};

export default function Alerts() {
  const { data: alerts = [], isLoading } = useAlerts();
  const sync = usePriceSync();

  async function handleSync() {
    try {
      await sync.mutateAsync({} as any);
      toast.success("Prices synced from NSE");
    } catch {
      toast.error("Price sync failed — check backend connection");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 2 }}>Alerts</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary,#888)" }}>
            Real-time tax action items — FY deadline, LTCG flips, harvest opportunities
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={sync.isPending}
          style={{ padding: "8px 16px", fontSize: 12, fontWeight: 500, background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", opacity: sync.isPending ? .6 : 1 }}>
          {sync.isPending ? "Syncing prices..." : "↻ Sync live prices"}
        </button>
      </div>

      {isLoading && <div style={{ textAlign: "center", paddingTop: 40, color: "var(--color-text-secondary,#888)" }}>Loading alerts...</div>}

      {!isLoading && alerts.length === 0 && (
        <div style={{ background: "#E1F5EE", border: "0.5px solid #9FE1CB", borderRadius: 12, padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#085041", marginBottom: 6 }}>All clear!</div>
          <div style={{ fontSize: 13, color: "#0F6E56" }}>No urgent tax actions needed right now. Check back closer to 31 March.</div>
        </div>
      )}

      {alerts.map((a: any, i: number) => {
        const cfg = SEV[a.severity] || SEV.low;
        return (
          <div key={i} style={{ background: cfg.bg, border: `0.5px solid ${cfg.border}`, borderRadius: 12, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: cfg.dot, marginTop: 4, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: cfg.text }}>{a.title}</span>
                  {a.symbol && (
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: cfg.border, color: cfg.text, fontWeight: 500 }}>{a.symbol}</span>
                  )}
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: cfg.border, color: cfg.text, marginLeft: "auto" }}>{cfg.label}</span>
                </div>
                <p style={{ fontSize: 13, color: cfg.text, lineHeight: 1.6, marginBottom: 8 }}>{a.body}</p>
                <div style={{ fontSize: 12, fontWeight: 500, color: cfg.text, opacity: .8 }}>→ {a.action}</div>
              </div>
            </div>
          </div>
        );
      })}

      <div style={{ fontSize: 12, color: "var(--color-text-tertiary,#aaa)", paddingTop: 4 }}>
        Prices sync automatically every 15 minutes during NSE market hours (9:15 AM – 3:30 PM IST, Mon–Fri).
      </div>
    </div>
  );
}
