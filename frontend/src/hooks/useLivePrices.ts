import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthStore } from "../store";

interface PriceTick {
  symbol:     string;
  price:      number;
  change:     number;
  change_pct: number;
  ts:         string;
  cached?:    boolean;
}

interface UseLivePricesOptions {
  portfolioId: number | null;
  onTick?:     (tick: PriceTick) => void;
}

/**
 * Hook that connects to the WebSocket price stream and maintains
 * a map of { symbol → latest PriceTick }.
 *
 * Usage:
 *   const { prices, connected } = useLivePrices({ portfolioId: 1 });
 *   const reliance = prices["RELIANCE"]; // { price, change, change_pct }
 */
export function useLivePrices({ portfolioId, onTick }: UseLivePricesOptions) {
  const token = useAuthStore(s => s.token);
  const [prices, setPrices]     = useState<Record<string, PriceTick>>({});
  const [connected, setConnected] = useState(false);
  const [marketOpen, setMarketOpen] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!portfolioId || !token) return;

    const url = `ws://localhost:8000/ws/prices/${portfolioId}?token=${token}`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Keepalive ping every 30s
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 30_000);
      (ws as any)._ping = ping;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "market_closed") {
          setMarketOpen(false);
          return;
        }
        if (msg.type === "pong") return;

        const tick = msg as PriceTick;
        setPrices(prev => ({ ...prev, [tick.symbol]: tick }));
        onTick?.(tick);
        setMarketOpen(true);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      setConnected(false);
      clearInterval((ws as any)._ping);
      // Reconnect after 5s
      setTimeout(connect, 5_000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [portfolioId, token]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  return { prices, connected, marketOpen };
}

/**
 * Simpler hook: just get the live price for a single symbol.
 * Falls back to lastKnown if WebSocket not connected.
 */
export function useLivePrice(symbol: string, portfolioId: number | null, lastKnown: number) {
  const { prices } = useLivePrices({ portfolioId });
  const tick = prices[symbol];
  return {
    price:      tick?.price      ?? lastKnown,
    change:     tick?.change     ?? 0,
    change_pct: tick?.change_pct ?? 0,
    isLive:     !!tick,
  };
}
