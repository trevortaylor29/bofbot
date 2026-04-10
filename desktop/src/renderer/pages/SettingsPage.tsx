import { useEffect, useState } from "react";

type Props = {
  email: string;
  onBack: () => void;
  onLogout: () => void;
};

export function SettingsPage({ email, onBack, onLogout }: Props) {
  const [mediaRoot, setMediaRoot] = useState<string>("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await window.bofbot.getMediaRoot();
      setMediaRoot(p);
    })();
  }, []);

  async function pickFolder() {
    const p = await window.bofbot.pickOutputFolder();
    if (!p) return;
    await window.bofbot.setMediaRoot(p);
    setMediaRoot(p);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function openDashboard() {
    await window.bofbot.openDashboard();
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <header className="app-top-bar">
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← Back
        </button>
        <h2 className="font-display" style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
          Settings
        </h2>
        <span style={{ width: 72 }} />
      </header>

      <div className="page-scroll scroll-hoverable" style={{ flex: 1, minHeight: 0 }}>
        <div className="workspace" style={{ maxWidth: 560 }}>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0 0 var(--section-gap)" }}>{email}</p>

          <div className="card" style={{ marginBottom: "var(--section-gap)" }}>
            <p style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.5rem" }}>
              Media folder
            </p>
            <p style={{ fontSize: "0.85rem", wordBreak: "break-all", margin: "0 0 0.75rem" }}>{mediaRoot || "…"}</p>
            <button type="button" className="btn-ghost" onClick={pickFolder}>
              Choose folder…
            </button>
            {saved && (
              <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0.75rem 0 0" }}>
                Saved. Restart the app for the worker to use the new path.
              </p>
            )}
          </div>

          <div className="card">
            <p style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.5rem" }}>
              Subscription
            </p>
            <p style={{ fontSize: "0.9rem", color: "var(--muted)", margin: "0 0 0.75rem" }}>
              Manage billing and plan in your browser.
            </p>
            <button type="button" className="btn-primary" onClick={openDashboard}>
              Open dashboard
            </button>
          </div>

          <button type="button" className="btn-ghost" style={{ marginTop: "var(--section-gap)" }} onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
