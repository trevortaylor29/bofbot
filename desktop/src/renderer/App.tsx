import { useCallback, useEffect, useState } from "react";

import { BrandedChrome } from "./components/BrandedChrome";
import type { BatchPayload, PlanPayload } from "./types";
import { BatchPage } from "./pages/BatchPage";
import { LoginPage } from "./pages/LoginPage";
import { MainHomePage } from "./pages/MainHomePage";
import { ProgressPage } from "./pages/ProgressPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WelcomePage } from "./pages/WelcomePage";

type Route = "welcome" | "login" | "home" | "batch" | "progress" | "settings";

export default function App() {
  const [route, setRoute] = useState<Route>("welcome");
  const [booting, setBooting] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanPayload | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [batchPayload, setBatchPayload] = useState<BatchPayload | null>(null);
  const [recentRefreshKey, setRecentRefreshKey] = useState(0);

  const loadPlan = useCallback(async () => {
    const r = await window.bofbot.getPlan();
    if (r.ok) {
      setPlan(r.plan);
      setPlanError(null);
    } else {
      setPlanError(
        r.error === "not_signed_in"
          ? "Session expired. Sign in again."
          : r.error || "Could not load plan."
      );
    }
  }, []);

  useEffect(() => {
    (async () => {
      const s = await window.bofbot.getSession();
      const email = s?.user?.email ?? null;
      setUserEmail(email);
      if (email) {
        setRoute("home");
        await loadPlan();
      } else {
        setRoute("welcome");
      }
      setBooting(false);
    })();
  }, [loadPlan]);

  useEffect(() => {
    const off = window.bofbot.onPlanSnapshot((data) => {
      if (typeof data?.videosProcessedToday !== "number") return;
      setPlan((prev) =>
        prev ? { ...prev, videosProcessedToday: data.videosProcessedToday } : prev
      );
    });
    return off;
  }, []);

  useEffect(() => {
    if (route === "home" && userEmail) {
      void loadPlan();
    }
  }, [route, userEmail, loadPlan]);

  async function handleLogout() {
    await window.bofbot.logout();
    setUserEmail(null);
    setPlan(null);
    setPlanError(null);
    setBatchPayload(null);
    setRoute("welcome");
  }

  async function openSignup() {
    await window.bofbot.openSignup();
  }

  if (booting) {
    return (
      <BrandedChrome>
        <div className="app-shell" style={{ alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Loading…</p>
        </div>
      </BrandedChrome>
    );
  }

  return (
    <BrandedChrome>
      <div className="app-shell">
        {route === "welcome" && (
          <WelcomePage onLogin={() => setRoute("login")} onCreateAccount={openSignup} />
        )}
        {route === "login" && (
          <LoginPage
            onBack={() => setRoute("welcome")}
            onLoggedIn={async (email) => {
              setUserEmail(email);
              setRoute("home");
              await loadPlan();
            }}
          />
        )}
        {route === "home" && userEmail && (
          <MainHomePage
            email={userEmail}
            plan={plan}
            planError={planError}
            onRefreshPlan={loadPlan}
            onLogout={handleLogout}
            onSettings={() => setRoute("settings")}
            onStartBatch={() => setRoute("batch")}
            recentRefreshKey={recentRefreshKey}
          />
        )}
        {route === "batch" && (
          <BatchPage
            onBack={() => setRoute("home")}
            onStart={(payload) => {
              setBatchPayload(payload);
              setRoute("progress");
            }}
          />
        )}
        {route === "progress" && batchPayload && (
          <ProgressPage
            payload={batchPayload}
            onDone={() => {
              setBatchPayload(null);
              setRoute("home");
              setRecentRefreshKey((k) => k + 1);
              void loadPlan();
            }}
            onBack={() => {
              setBatchPayload(null);
              setRoute("batch");
            }}
          />
        )}
        {route === "settings" && userEmail && (
          <SettingsPage
            email={userEmail}
            onBack={() => setRoute("home")}
            onLogout={handleLogout}
          />
        )}
      </div>
    </BrandedChrome>
  );
}
