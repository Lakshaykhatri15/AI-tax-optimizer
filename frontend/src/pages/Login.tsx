// ── Login.tsx ─────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuthStore } from "../store";
import { authAPI } from "../services/api";

const card: any = { maxWidth: 380, margin: "80px auto", background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 16, padding: 28 };
const inp: any  = { width: "100%", padding: "9px 12px", fontSize: 13, border: "0.5px solid var(--color-border-secondary,#ccc)", borderRadius: 8, marginTop: 4, background: "var(--color-background-primary,#fff)", color: "var(--color-text-primary,#1a1a1a)", outline: "none" };
const lbl: any  = { fontSize: 12, color: "var(--color-text-secondary,#888)", display: "block" };
const btn: any  = { width: "100%", padding: "10px", fontSize: 13, fontWeight: 500, background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", marginTop: 20 };

export function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const setToken = useAuthStore(s => s.setToken);
  const navigate = useNavigate();

  const mut = useMutation({
    mutationFn: () => authAPI.login(email, pass),
    onSuccess: (d: any) => { setToken(d.access_token); navigate("/"); },
    onError: () => toast.error("Invalid email or password"),
  });

  return (
    <div style={card}>
      <div style={{ fontWeight: 500, fontSize: 18, marginBottom: 4 }}>TaxOptimizer India</div>
      <div style={{ fontSize: 13, color: "var(--color-text-secondary,#888)", marginBottom: 24 }}>Sign in to your account</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div><label style={lbl}>Email</label><input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div>
        <div><label style={lbl}>Password</label><input style={inp} type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && mut.mutate()} placeholder="••••••••" /></div>
      </div>
      <button style={btn} onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? "Signing in..." : "Sign in"}</button>
      <div style={{ textAlign: "center", fontSize: 12, marginTop: 16, color: "var(--color-text-secondary,#888)" }}>
        No account? <Link to="/register" style={{ color: "#534AB7" }}>Register</Link>
      </div>
    </div>
  );
}

export function Register() {
  const [email, setEmail]   = useState("");
  const [name, setName]     = useState("");
  const [pass, setPass]     = useState("");
  const setToken = useAuthStore(s => s.setToken);
  const navigate = useNavigate();

  const mut = useMutation({
    mutationFn: () => authAPI.register(email, pass, name),
    onSuccess: (d: any) => { setToken(d.access_token); navigate("/"); },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Registration failed"),
  });

  return (
    <div style={card}>
      <div style={{ fontWeight: 500, fontSize: 18, marginBottom: 4 }}>Create account</div>
      <div style={{ fontSize: 13, color: "var(--color-text-secondary,#888)", marginBottom: 24 }}>Start optimising your taxes</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div><label style={lbl}>Full name</label><input style={inp} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Arjun Sharma" /></div>
        <div><label style={lbl}>Email</label><input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div>
        <div><label style={lbl}>Password</label><input style={inp} type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Min 8 characters" /></div>
      </div>
      <button style={btn} onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? "Creating account..." : "Create account"}</button>
      <div style={{ textAlign: "center", fontSize: 12, marginTop: 16, color: "var(--color-text-secondary,#888)" }}>
        Already have an account? <Link to="/login" style={{ color: "#534AB7" }}>Sign in</Link>
      </div>
    </div>
  );
}

export default Login;
