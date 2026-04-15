import { useCallback, useEffect, useState } from "react";

import { BrandedChrome } from "./components/BrandedChrome";
import { UpdateAvailableBadge } from "./components/UpdateAvailableBadge";
import { UpdateModal } from "./components/UpdateModal";
import type { BatchPayload, PlanPayload } from "./types";
import { BatchPage } from "./pages/BatchPage";
import { LoginPage } from "./pages/LoginPage";
import { MainHomePage } from "./pages/MainHomePage";
import { ProgressPage } from "./pages/ProgressPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WelcomePage } from "./pages/WelcomePage";

type Route = "welcome" | "login" | "home" | "batch" | "progress" | "settings";

type UpdateOffer = {
  version: string;
  currentVersion: string;
  releaseNotes: string | null;
};

export default function App() {
  const [route, setRoute] = useState<Route>("welcome");
  const [booting, setBooting] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanPayload | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [batchPayload, setBatchPayload] = useState<BatchPayload | null>(null);
  const [recentRefreshKey, setRecentRefreshKey] = useState(0);
  const [updatePending, setUpdatePending] = useState<UpdateOffer | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateErr, setUpdateErr] = useState<string | null>(null);
  const [updateProgressPercent, setUpdateProgressPercent] = useState<number | null>(
    null
  );

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

  useEffect(() => {
    const offAvail = window.bofbot.onUpdateAvailable((data) => {
      if (!data?.version) return;
      const rn =
        typeof data.releaseNotes === "string" ? data.releaseNotes.trim() : "";
      setUpdatePending({
        version: data.version,
        currentVersion: data.currentVersion ?? "",
        releaseNotes: rn.length > 0 ? rn : null,
      });
      setUpdateModalOpen(true);
      setUpdateErr(null);
    });
    const offErr = window.bofbot.onUpdateError((data) => {
      if (data?.message) {
        setUpdateErr(data.message);
        setUpdateBusy(false);
        setUpdateProgressPercent(null);
      }
    });
    const offProgress = window.bofbot.onUpdateDownloadProgress((data) => {
      if (typeof data?.percent === "number") {
        setUpdateProgressPercent(data.percent);
      }
    });
    return () => {
      offAvail();
      offErr();
      offProgress();
    };
  }, []);

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

  const showUpdateBadge =
    updatePending != null && !updateModalOpen && !updateBusy;

  return (
    <BrandedChrome>
      <div className="app-shell">
        {showUpdateBadge ? (
          <UpdateAvailableBadge onClick={() => setUpdateModalOpen(true)} />
        ) : null}
        {updateModalOpen && updatePending ? (
          <UpdateModal
            newVersion={updatePending.version}
            currentVersion={updatePending.currentVersion}
            releaseNotes={updatePending.releaseNotes}
            busy={updateBusy}
            progressPercent={updateProgressPercent}
            error={updateErr}
            onUpdate={async () => {
              setUpdateErr(null);
              setUpdateBusy(true);
              setUpdateProgressPercent(0);
              const r = await window.bofbot.downloadAppUpdate();
              if (!r.ok) {
                setUpdateBusy(false);
                setUpdateProgressPercent(null);
                if (!("skipped" in r) || !r.skipped) {
                  setUpdateErr(r.error ?? "Update failed.");
                }
              }
            }}
            onNotNow={() => {
              setUpdateModalOpen(false);
              setUpdateErr(null);
              setUpdateProgressPercent(null);
            }}
          />
        ) : null}
        <div className="app-shell-main">
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
      </div>
    </BrandedChrome>
  );
}
