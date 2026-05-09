import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore, usePortfolioStore } from "../store";
import { useQuery } from "@tanstack/react-query";
import { portfolioAPI } from "../services/api";

const NAV = [
  { to: "/",          label: "Dashboard",   icon: "◈" },
  { to: "/portfolio", label: "Portfolio",   icon: "⊞" },
  { to: "/tax",       label: "Tax report",  icon: "⊟" },
  { to: "/harvest",   label: "ML harvest",  icon: "◉" },
  { to: "/scenario",  label: "Simulator",   icon: "◇" },
  { to: "/alerts",    label: "Alerts",      icon: "◎" },
  { to: "/export",    label: "ITR export",  icon: "↓" },
  { to: "/advisor",   label: "AI advisor",  icon: "✦" },
  { to: "/b2b",       label: "CA portal",   icon: "⊏" },
];

export default function Layout() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { activePortfolioId, setActivePortfolioId } = usePortfolioStore();

  const { data: portfolios = [] } = useQuery({
    queryKey: ["portfolios"],
    queryFn: portfolioAPI.list,
  } as any);

  if ((portfolios as any[]).length > 0 && !activePortfolioId) {
    setActivePortfolioId((portfolios as any[])[0].id);
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-background-tertiary,#f5f5f3)" }}>
      <aside style={{ width: 220, flexShrink: 0, background: "var(--color-background-primary,#fff)", borderRight: "0.5px solid var(--color-border-tertiary,#e5e5e5)", display: "flex", flexDirection: "column", padding: "20px 0" }}>
        <div style={{ padding: "0 20px 20px", borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
          <div style={{ fontWeight: 500, fontSize: 15 }}>TaxOptimizer</div>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary,#aaa)", marginTop: 2 }}>India · FY 2025–26</div>
        </div>

        {(portfolios as any[]).length > 0 && (
          <div style={{ padding: "12px 20px", borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
            <div style={{ fontSize: 10, color: "var(--color-text-tertiary,#aaa)", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".5px" }}>Portfolio</div>
            <select value={activePortfolioId || ""} onChange={(e) => setActivePortfolioId(Number(e.target.value))}
              style={{ width: "100%", fontSize: 12, padding: "4px 6px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary,#ccc)", background: "var(--color-background-primary,#fff)", color: "var(--color-text-primary,#1a1a1a)" }}>
              {(portfolios as any[]).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        <nav style={{ flex: 1, padding: "8px 0" }}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 20px", fontSize: 13, textDecoration: "none",
                color: isActive ? "#534AB7" : "var(--color-text-secondary,#888)",
                background: isActive ? "#EEEDFE" : "transparent",
                borderRight: isActive ? "2px solid #534AB7" : "2px solid transparent",
                fontWeight: isActive ? 500 : 400,
              })}>
              <span style={{ fontSize: 14 }}>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: "12px 20px", borderTop: "0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
          <button onClick={() => { logout(); navigate("/login"); }}
            style={{ width: "100%", padding: "7px", fontSize: 12, border: "0.5px solid var(--color-border-secondary,#ccc)", borderRadius: 6, background: "none", cursor: "pointer", color: "var(--color-text-secondary,#888)" }}>
            Sign out
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: 28, overflow: "auto" }}>
        <Outlet />
      </main>
    </div>
  );
}
