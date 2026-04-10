import { FormEvent, useState } from "react";

type Props = {
  onBack: () => void;
  onLoggedIn: (email: string) => void;
};

export function LoginPage({ onBack, onLoggedIn }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await window.bofbot.login(email.trim(), password);
      if (r.ok) {
        const em = r.user.email?.trim() || email.trim();
        onLoggedIn(em);
      } else {
        setError(r.error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "1rem 1.5rem 2rem",
        maxWidth: 440,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <button type="button" className="btn-ghost" style={{ alignSelf: "flex-start", marginBottom: "1.25rem" }} onClick={onBack}>
        ← Back
      </button>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
          <div className="logo-mark" style={{ height: "2rem", width: "2rem", fontSize: "0.8rem" }}>
            B
          </div>
          <h1 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
            Log in
          </h1>
        </div>
        <p style={{ color: "var(--muted)", margin: "0 0 1.5rem", fontSize: "0.9rem", lineHeight: 1.5 }}>
          Sign in to verify your plan. Video files are processed locally — they never upload to our servers.
        </p>

        <form onSubmit={onSubmit} className="card">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          {error && <p style={{ color: "var(--coral)", fontSize: "0.85rem", margin: "0 0 1rem" }}>{error}</p>}
          <button type="submit" className="btn-primary btn-primary--large" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
