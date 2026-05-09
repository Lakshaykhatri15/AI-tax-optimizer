import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePortfolioStore } from "../store";
import { taxAPI, portfolioAPI } from "../services/api";
import type { TaxSummary, HarvestRec, Alert, ScenarioResult } from "../types";

// ── Portfolio ─────────────────────────────────────────────────────────────────

export function usePortfolios() {
  return useQuery({
    queryKey: ["portfolios"],
    queryFn:  portfolioAPI.list,
    staleTime: 60_000,
  });
}

export function useActivePortfolio() {
  const { activePortfolioId } = usePortfolioStore();
  const { data: portfolios = [] } = usePortfolios();
  return (portfolios as any[]).find((p: any) => p.id === activePortfolioId) ?? null;
}

// ── Tax summary ───────────────────────────────────────────────────────────────

export function useTaxSummary() {
  const { activePortfolioId } = usePortfolioStore();
  return useQuery<TaxSummary>({
    queryKey: ["tax-summary", activePortfolioId],
    queryFn:  () => taxAPI.summary(activePortfolioId!),
    enabled:  !!activePortfolioId,
    staleTime: 30_000,
  });
}

// ── ML harvest recs ───────────────────────────────────────────────────────────

export function useHarvestRecs() {
  const { activePortfolioId } = usePortfolioStore();
  return useQuery<HarvestRec[]>({
    queryKey: ["harvest", activePortfolioId],
    queryFn:  () => taxAPI.harvest(activePortfolioId!),
    enabled:  !!activePortfolioId,
    staleTime: 60_000,
  });
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export function useAlerts() {
  const { activePortfolioId } = usePortfolioStore();
  return useQuery<Alert[]>({
    queryKey: ["alerts", activePortfolioId],
    queryFn:  () => fetch(`/api/alerts/${activePortfolioId}/alerts`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }).then(r => r.json()),
    enabled:  !!activePortfolioId,
    staleTime: 120_000,
  });
}

// ── Scenario ──────────────────────────────────────────────────────────────────

export function useScenario() {
  const { activePortfolioId } = usePortfolioStore();
  const qc = useQueryClient();
  return useMutation<ScenarioResult, Error, Record<string, number>>({
    mutationFn: (sellMap) => taxAPI.scenario(activePortfolioId!, sellMap),
  });
}

// ── Price sync ────────────────────────────────────────────────────────────────

export function usePriceSync() {
  const { activePortfolioId } = usePortfolioStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fetch(`/api/alerts/${activePortfolioId}/sync-prices`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolios"] });
      qc.invalidateQueries({ queryKey: ["tax-summary"] });
      qc.invalidateQueries({ queryKey: ["harvest"] });
    },
  });
}

// ── Formatting utils ──────────────────────────────────────────────────────────

export function useFormatter() {
  return {
    currency: (n: number) => "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN"),
    pct:      (n: number) => n.toFixed(1) + "%",
    signed:   (n: number) => (n >= 0 ? "+" : "") + Math.round(n).toLocaleString("en-IN"),
  };
}
