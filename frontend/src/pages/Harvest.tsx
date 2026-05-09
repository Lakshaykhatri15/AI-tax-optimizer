import { useQuery } from "@tanstack/react-query";
import { usePortfolioStore } from "../store";
import { taxAPI } from "../services/api";

const URGENCY_CONFIG: any = {
  urgent:    { bg: "#FCEBEB", border: "#F09595", color: "#791F1F", dot: "#E24B4A", label: "Urgent" },
  consider:  { bg: "#FAEEDA", border: "#FAC775", color: "#633806", dot: "#EF9F27", label: "Consider" },
  hold:      { bg: "#F1EFE8", border: "#D3D1C7", color: "#5F5E5A", dot: "#B4B2A9", label: "Hold" },
};

function PriorityBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.65 ? "#E24B4A" : score >= 0.35 ? "#EF9F27" : "#B4B2A9";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: "var(--color-background-secondary,#f0f0f0)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", background: color, borderRadius: 99, transition: "width .4s" }} />
      </div>
      <span style={{ fontSize: 11, color: "var(--color-text-secondary,#888)", minWidth: 28 }}>{pct}%</span>
    </div>
  );
}

export default function Harvest() {
  const { activePortfolioId } = usePortfolioStore();
  const { data, isLoading, error } = useQuery({
    queryKey: ["harvest", activePortfolioId],
    queryFn: () => taxAPI.harvest(activePortfolioId!),
    enabled: !!activePortfolioId,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 2 }}>ML harvest advisor</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary,#888)" }}>
          XGBoost model ranks your loss positions by harvest urgency — factoring in FY deadline, LTCG threshold proximity, and tax saving magnitude.
        </p>
      </div>

      {/* Model info card */}
      <div style={{ background: "#EEEDFE", border: "0.5px solid #CECBF6", borderRadius: 10, padding: 14, display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#3C3489", marginBottom: 4 }}>How the ML model works</div>
          <div style={{ fontSize: 12, color: "#534AB7", lineHeight: 1.6 }}>
            Trained on synthetic Indian market data. Features: loss magnitude, days to FY end (31 Mar), 
            days to LTCG threshold, holding period, tax saving amount. Output: priority score 0–1. 
            The deterministic tax engine computes all ₹ figures — ML only ranks urgency.
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "#534AB7", marginBottom: 4 }}>Model</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#3C3489" }}>XGBoost</div>
          <div style={{ fontSize: 10, color: "#534AB7", marginTop: 6 }}>Features</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#3C3489" }}>8</div>
        </div>
      </div>

      {!activePortfolioId && <Empty msg="No portfolio selected." />}
      {isLoading && <Spinner />}
      {error && <Empty msg="Failed to load. Check backend connection." />}

      {data && data.length === 0 && (
        <div style={{ background: "#E1F5EE", border: "0.5px solid #9FE1CB", borderRadius: 10, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#085041", marginBottom: 4 }}>No loss positions found</div>
          <div style={{ fontSize: 13, color: "#0F6E56" }}>All your holdings are in profit. No harvesting needed this FY.</div>
        </div>
      )}

      {data && data.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.map((rec: any) => {
            const cfg = URGENCY_CONFIG[rec.urgency] || URGENCY_CONFIG.hold;
            return (
              <div key={rec.symbol} style={{ background: cfg.bg, border: `0.5px solid ${cfg.border}`, borderRadius: 10, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.dot, marginTop: 2 }} />
                    <div>
                      <span style={{ fontWeight: 500, fontSize: 15, color: cfg.color }}>{rec.symbol}</span>
                      <span style={{ marginLeft: 10, fontSize: 10, padding: "2px 8px", borderRadius: 99, background: cfg.border, color: cfg.color, fontWeight: 500 }}>{cfg.label}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#0F6E56" }}>Save ₹{rec.estimated_saving.toLocaleString("en-IN")}</div>
                    <div style={{ fontSize: 11, color: cfg.color, opacity: .7 }}>estimated tax saving</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: cfg.color, marginBottom: 10, lineHeight: 1.5 }}>{rec.reason}</div>
                <div>
                  <div style={{ fontSize: 10, color: cfg.color, opacity: .7, marginBottom: 4 }}>ML priority score</div>
                  <PriorityBar score={rec.priority_score} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 12, color: "var(--color-text-tertiary,#aaa)", paddingTop: 4 }}>
        In India, there are no wash-sale rules — you can sell a losing position and immediately repurchase it to harvest the loss while maintaining your exposure.
      </div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ textAlign: "center", paddingTop: 60, color: "var(--color-text-secondary,#888)", fontSize: 14 }}>{msg}</div>;
}
function Spinner() {
  return <div style={{ textAlign: "center", paddingTop: 60, color: "var(--color-text-secondary,#888)" }}>Loading...</div>;
}
