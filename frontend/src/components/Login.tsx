import { useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { api, errorText } from "../api";
import ErrorBox from "./ErrorBox";
export default function Login({ onLogin }: { onLogin: (s: string) => void }) {
  const [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="login-card">
      <span className="circle-icon">
        <ShieldCheck />
      </span>
      <span className="eyebrow">A SPACE FOR THE OWNER</span>
      <h1>Welcome back.</h1>
      <p>
        Manage appointments, make room for your customers, and wrap up their
        visit.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const d = await api<{ token: string }>("/auth/login", {
              method: "POST",
              body: JSON.stringify({ password }),
            });
            sessionStorage.setItem("atelier-token", d.token);
            onLogin(d.token);
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Owner password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <ErrorBox message={error} />
        <button className="primary" disabled={busy}>
          {busy ? "Signing in…" : "Open owner workspace"}
          <ArrowRight size={17} />
        </button>
      </form>
      <small className="muted">
        Set your private owner password in the server environment.
      </small>
    </section>
  );
}
