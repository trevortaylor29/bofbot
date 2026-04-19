import { useEffect, useState } from "react";

import { UninstallConfirmModal } from "../components/UninstallConfirmModal";

type Props = {
  email: string;
  onBack: () => void;
  onLogout: () => void;
};

export function SettingsPage({ email, onBack, onLogout }: Props) {
  const [mediaRoot, setMediaRoot] = useState<string>("");
  const [saved, setSaved] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [updateCheckBusy, setUpdateCheckBusy] = useState(false);
  const [updateCheckMessage, setUpdateCheckMessage] = useState<string | null>(
    null
  );
  const [canUninstallFromSettings, setCanUninstallFromSettings] =
    useState(false);
  const [uninstallModalOpen, setUninstallModalOpen] = useState(false);
  const [uninstallBusy, setUninstallBusy] = useState(false);
  const [uninstallErr, setUninstallErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const p = await window.bofbot.getMediaRoot();
      setMediaRoot(p);
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      const r = await window.bofbot.getRuntimeInfo();
      setCanUninstallFromSettings(r.platform === "win32" && r.isPackaged);
    })();
  }, []);

  const mediaFolderPermissionHint =
    "BofBot doesn't have permission to write to this folder. Try choosing a folder on your main drive, or right-click BofBot and run as administrator.";

  /** OneDrive / Dropbox / Google Drive paths often cause file locking or sync conflicts. */
  function pathLooksLikeCloudSyncFolder(folderPath: string): boolean {
    return /OneDrive|Dropbox|Google\s*Drive|GoogleDrive/i.test(folderPath);
  }

  async function pickFolder() {
    setFolderError(null);
    try {
      const p = await window.bofbot.pickOutputFolder();
      if (!p) return;
      if (pathLooksLikeCloudSyncFolder(p)) {
        const proceed = window.confirm(
          "This folder is inside a cloud sync service which can cause errors. We recommend using a local folder like C:\\BofBot instead.\n\nUse this folder anyway?"
        );
        if (!proceed) return;
      }
      const r = await window.bofbot.setMediaRoot(p);
      if (!r.ok) {
        setFolderError(
          r.error ??
            "That folder is not writable. Choose another location or fix permissions."
        );
        return;
      }
      const resolved = await window.bofbot.getMediaRoot();
      setMediaRoot(resolved);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setFolderError(mediaFolderPermissionHint);
    }
  }

  async function openDashboard() {
    await window.bofbot.openDashboard();
  }

  async function checkForUpdates() {
    setUpdateCheckMessage(null);
    setUpdateCheckBusy(true);
    try {
      const r = await window.bofbot.checkForUpdates();
      setUpdateCheckBusy(false);
      if (!r.ok) {
        setUpdateCheckMessage(r.error || "Could not check for updates.");
        return;
      }
      if (r.skipped) {
        return;
      }
      if (r.devMode) {
        setUpdateCheckMessage(
          "Update checks run in the installed app only."
        );
        return;
      }
      if (r.updateAvailable) {
        setUpdateCheckMessage(null);
        return;
      }
      setUpdateCheckMessage("You're on the latest version.");
    } catch {
      setUpdateCheckBusy(false);
      setUpdateCheckMessage("Could not check for updates.");
    }
  }

  async function confirmUninstall() {
    setUninstallErr(null);
    setUninstallBusy(true);
    try {
      const r = await window.bofbot.uninstallApp();
      setUninstallBusy(false);
      if (!r.ok) {
        setUninstallErr(r.error ?? "Uninstall failed.");
        return;
      }
      setUninstallModalOpen(false);
    } catch {
      setUninstallBusy(false);
      setUninstallErr("Uninstall failed.");
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {uninstallModalOpen ? (
        <UninstallConfirmModal
          busy={uninstallBusy}
          error={uninstallErr}
          onConfirm={() => void confirmUninstall()}
          onCancel={() => {
            if (uninstallBusy) return;
            setUninstallModalOpen(false);
            setUninstallErr(null);
          }}
        />
      ) : null}
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
            <button type="button" className="btn-ghost" onClick={() => void pickFolder()}>
              Choose folder…
            </button>
            {folderError ? (
              <p style={{ color: "var(--coral)", fontSize: "0.8rem", margin: "0.75rem 0 0", lineHeight: 1.45 }}>
                {folderError}
              </p>
            ) : null}
            {saved && !folderError ? (
              <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0.75rem 0 0" }}>
                Saved. Restart the app for the worker to use the new path.
              </p>
            ) : null}
          </div>

          <div className="card" style={{ marginBottom: "var(--section-gap)" }}>
            <p style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.5rem" }}>
              Updates
            </p>
            <p style={{ fontSize: "0.9rem", color: "var(--muted)", margin: "0 0 0.75rem" }}>
              Check whether a newer version of BofBot is available.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.65rem" }}>
              <button
                type="button"
                className="btn-ghost"
                disabled={updateCheckBusy}
                onClick={() => void checkForUpdates()}
              >
                Check for updates
              </button>
              {updateCheckBusy ? (
                <span className="settings-check-spinner" aria-hidden />
              ) : null}
            </div>
            {updateCheckMessage ? (
              <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0.75rem 0 0", lineHeight: 1.45 }}>
                {updateCheckMessage}
              </p>
            ) : null}
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

          {canUninstallFromSettings ? (
            <div style={{ marginTop: "2rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                className="btn-danger-outline"
                onClick={() => {
                  setUninstallErr(null);
                  setUninstallModalOpen(true);
                }}
              >
                Uninstall BofBot
              </button>
              <p style={{ color: "var(--muted-dim)", fontSize: "0.75rem", margin: "0.5rem 0 0", lineHeight: 1.45 }}>
                Removes the app and local data (%AppData%\Roaming\bofbot-desktop).
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
