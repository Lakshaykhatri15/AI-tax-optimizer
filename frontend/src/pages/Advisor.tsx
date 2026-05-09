import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { usePortfolioStore } from "../store";
import { advisorAPI } from "../services/api";

interface Msg { role: "user" | "assistant"; content: string; }

const SUGGESTIONS = [
  "How do I save the most tax this FY?",
  "Which loss positions should I sell first?",
  "Explain LTCG vs STCG in simple terms",
  "Can I harvest a loss and rebuy immediately?",
  "How does the ₹1.25L exemption reset trick work?",
];

export default function Advisor() {
  const { activePortfolioId } = usePortfolioStore();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I'm your AI tax advisor — I have full context of your portfolio and Indian tax rules for FY 2025-26. Ask me anything about saving tax, when to sell, or how capital gains work." }
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const sendMut = useMutation({
    mutationFn: (msgs: Msg[]) => advisorAPI.chat(activePortfolioId!, msgs),
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    },
    onError: () => {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't connect to the advisor right now. Make sure the backend is running with your ANTHROPIC_API_KEY set." }]);
    },
  });

  function send(text: string) {
    if (!text.trim() || sendMut.isPending || !activePortfolioId) return;
    const userMsg: Msg = { role: "user", content: text };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    sendMut.mutate(newMsgs);
  }

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sendMut.isPending]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "calc(100vh - 120px)" }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 2 }}>AI advisor</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary,#888)" }}>Powered by Claude · Full awareness of your portfolio · Indian tax rules</p>
      </div>

      {!activePortfolioId && (
        <div style={{ textAlign: "center", paddingTop: 40, color: "var(--color-text-secondary,#888)", fontSize: 14 }}>Select a portfolio to enable the advisor.</div>
      )}

      {activePortfolioId && (
        <>
          {/* Chat window */}
          <div style={{ flex: 1, background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 12, padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                {m.role === "assistant" && (
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, marginRight: 8, flexShrink: 0, marginTop: 2, color: "#534AB7", fontWeight: 500 }}>✦</div>
                )}
                <div style={{
                  background: m.role === "user" ? "#534AB7" : "var(--color-background-secondary,#f7f7f5)",
                  color: m.role === "user" ? "#fff" : "var(--color-text-primary,#1a1a1a)",
                  borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  padding: "10px 14px", fontSize: 13, lineHeight: 1.6,
                  maxWidth: "78%", whiteSpace: "pre-wrap",
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {sendMut.isPending && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#534AB7", fontWeight: 500 }}>✦</div>
                <div style={{ background: "var(--color-background-secondary,#f7f7f5)", borderRadius: "12px 12px 12px 2px", padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {[0, 150, 300].map(d => (
                      <div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "#534AB7", animation: `bounce .9s ${d}ms infinite`, opacity: .6 }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Suggestions */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)} disabled={sendMut.isPending}
                style={{ fontSize: 11, padding: "5px 10px", borderRadius: 99, background: "var(--color-background-secondary,#f7f7f5)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", cursor: "pointer", color: "var(--color-text-secondary,#888)", transition: "all .15s" }}
                onMouseEnter={e => { (e.target as any).style.borderColor = "#534AB7"; (e.target as any).style.color = "#534AB7"; }}
                onMouseLeave={e => { (e.target as any).style.borderColor = "var(--color-border-tertiary,#e5e5e5)"; (e.target as any).style.color = "var(--color-text-secondary,#888)"; }}>
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send(input)}
              placeholder="Ask anything about your taxes..."
              style={{ flex: 1, padding: "10px 14px", fontSize: 13, border: "0.5px solid var(--color-border-secondary,#ccc)", borderRadius: 8, background: "var(--color-background-primary,#fff)", color: "var(--color-text-primary,#1a1a1a)", outline: "none" }}
            />
            <button onClick={() => send(input)} disabled={!input.trim() || sendMut.isPending}
              style={{ padding: "10px 18px", fontSize: 13, fontWeight: 500, background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", opacity: input.trim() && !sendMut.isPending ? 1 : .5 }}>
              Send
            </button>
          </div>
        </>
      )}
      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }`}</style>
    </div>
  );
}
