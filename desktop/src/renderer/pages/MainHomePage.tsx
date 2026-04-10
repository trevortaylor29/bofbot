import { useEffect, useState } from "react";

import appIcon from "../../../icon.png";
import type { PlanPayload, RecentBatch } from "../types";

type Props = {
  email: string;
  plan: PlanPayload | null;
  planError: string | null;
  onRefreshPlan: () => void;
  onLogout: () => void;
  onSettings: () => void;
  onStartBatch: () => void;
  recentRefreshKey: number;
};

function normalizePlanId(id: string) {
  if (id === "basic") return "starter";
  return id;
}

function planDisplayName(id: string) {
  const n = normalizePlanId(id);
  if (n === "pro") return "Pro";
  if (n === "starter") return "Starter";
  if (n === "free") return "Free";
  return id.replace(/_/g, " ");
}

function formatBatchWhen(ts: number) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/** First segment of local part, title-cased — for a short greeting. */
function displayNameFromEmail(email: string): string | null {
  const local = email.split("@")[0]?.trim() ?? "";
  if (!local || local.length > 48) return null;
  const first = local.split(/[._-]/)[0];
  if (!first || !/^[a-zA-Z]/.test(first)) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function EmptyBatchesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M7 9h6M7 12h10" opacity="0.55" />
      <path d="M10 3v2M14 3v2" />
      <rect x="5" y="17" width="14" height="3.5" rx="1" opacity="0.4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
    </svg>
  );
}

export function MainHomePage({
  email,
  plan,
  planError,
  onRefreshPlan,
  onLogout,
  onSettings,
  onStartBatch,
  recentRefreshKey,
}: Props) {
  const [recent, setRecent] = useState<RecentBatch[]>([]);
  const [clearBusy, setClearBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const list = await window.bofbot.getRecentBatches();
      setRecent(Array.isArray(list) ? list : []);
    })();
  }, [recentRefreshKey, plan?.videosProcessedToday]);

  const maxDay = plan?.limits.maxVideosPerDay ?? 0;
  const used = plan?.videosProcessedToday ?? 0;
  const capped = maxDay !== -1 && maxDay > 0;
  const usagePct = capped ? Math.min(100, Math.round((used / maxDay) * 100)) : 0;
  const usageSnippet =
    plan && maxDay === -1 ? `${used} videos today` : plan && capped ? `${used}/${maxDay} videos today` : plan ? `${used} videos today` : "…";

  const firstName = displayNameFromEmail(email);

  async function openFolder(dir: string) {
    await window.bofbot.openPath(dir);
  }

  async function clearAllOutputFolders() {
    const ok = window.confirm(
      "Delete all videos and folders for every batch listed below? This removes each batch’s output folder and its matching raw folder under your BofBot media directory. This cannot be undone."
    );
    if (!ok) return;
    setClearBusy(true);
    try {
      const r = await window.bofbot.deleteAllRecentOutput();
      if (!r.ok) {
        window.alert(r.error || "Could not delete output folders.");
        return;
      }
      setRecent([]);
    } finally {
      setClearBusy(false);
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <header className="app-top-bar">
        <div className="app-top-bar__left">
          <img src={appIcon} alt="" className="logo-img" width={36} height={36} />
          <div style={{ minWidth: 0 }}>
            <div className="font-display" style={{ fontSize: "0.95rem", fontWeight: 700, lineHeight: 1.2 }}>
              BofBot
            </div>
            <div style={{ color: "var(--muted-dim)", fontSize: "0.7rem", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
          </div>
        </div>
        <div className="app-top-bar__right">
          {plan && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {capped && (
                <div className="usage-micro" title={`${usagePct}% of daily cap`}>
                  <div style={{ width: `${usagePct}%` }} />
                </div>
              )}
              <span className="plan-inline">
                <strong>{planDisplayName(plan.plan)}</strong>
                <span style={{ opacity: 0.45 }}> · </span>
                {usageSnippet}
              </span>
            </div>
          )}
          {!plan && !planError && <span className="plan-inline">Loading plan…</span>}
          {planError && (
            <span className="plan-inline" style={{ color: "var(--coral)" }}>
              {planError}
              <button type="button" className="btn-ghost" style={{ marginLeft: 8, padding: "0.25rem 0.5rem", fontSize: "0.7rem" }} onClick={onRefreshPlan}>
                Retry
              </button>
            </span>
          )}
          <button type="button" className="btn-ghost" onClick={onSettings}>
            Settings
          </button>
          <button type="button" className="btn-ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <div className="home-center-scroll scroll-hoverable">
        <div className="home-center">
          <div className="home-center__inner">
            <div className="home-welcome">
              <h1 className="home-welcome__title font-display">{firstName ? `Hi, ${firstName}` : "Ready to edit"}</h1>
              <p className="home-welcome__sub">
                {firstName ? "Your next batch is one click away." : `Signed in as ${email}`}
              </p>
            </div>

            <button type="button" className="btn-primary btn-primary--home-hero" onClick={onStartBatch}>
              Start batch
            </button>

            <section className="home-recent" aria-labelledby="home-recent-heading">
              <h2 id="home-recent-heading" className="home-recent__heading">
                Recent batches
              </h2>

              {recent.length === 0 ? (
                <div className="home-empty">
                  <div className="home-empty__icon" aria-hidden>
                    <EmptyBatchesIcon />
                  </div>
                  <h3 className="home-empty__title">No batches yet</h3>
                  <p className="home-empty__text">
                    When you finish a run, it&apos;ll show up here with a quick link to your output folder. Start a batch
                    to add videos, pick hooks, and process locally.
                  </p>
                </div>
              ) : (
                <div className="home-recent__scroll">
                  <table className="home-recent-table">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col" className="col-count">
                          Videos
                        </th>
                        <th scope="col" className="col-status">
                          Status
                        </th>
                        <th scope="col" className="col-clear">
                          <button
                            type="button"
                            className="home-trash-btn"
                            title="Delete all output for listed batches"
                            disabled={clearBusy}
                            aria-label="Delete all batch output folders and clear list"
                            onClick={() => void clearAllOutputFolders()}
                          >
                            <TrashIcon />
                          </button>
                        </th>
                        <th scope="col" className="col-action">
                          <span className="visually-hidden">Open folder</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((b) => (
                        <tr key={b.id} title={b.outputDir}>
                          <td className="col-date">{formatBatchWhen(b.completedAt)}</td>
                          <td className="col-count">{b.videoCount}</td>
                          <td className="col-status">
                            <span className="home-status-pill">Complete</span>
                          </td>
                          <td className="col-clear" aria-hidden />
                          <td className="col-action">
                            <button type="button" className="home-recent-link" onClick={() => openFolder(b.outputDir)}>
                              Open folder
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
