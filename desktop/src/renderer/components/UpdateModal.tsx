type Props = {
  newVersion: string;
  currentVersion: string;
  releaseNotes: string | null;
  busy: boolean;
  progressPercent: number | null;
  error: string | null;
  onUpdate: () => void;
  onNotNow: () => void;
};

export function UpdateModal({
  newVersion,
  currentVersion,
  releaseNotes,
  busy,
  progressPercent,
  error,
  onUpdate,
  onNotNow,
}: Props) {
  const showProgress = busy && progressPercent !== null;

  return (
    <div
      className="update-modal-backdrop"
      role="presentation"
      aria-hidden={false}
    >
      <div
        className="update-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-modal-title"
        aria-describedby="update-modal-desc"
      >
        <h2 id="update-modal-title" className="update-modal__title">
          Update available
        </h2>
        <p id="update-modal-desc" className="update-modal__body">
          A new version of BofBot is available. Update now?
        </p>
        <p className="update-modal__versions">
          <span className="update-modal__ver-muted">Current</span>{" "}
          <span className="update-modal__ver">{currentVersion || "—"}</span>
          <span className="update-modal__ver-sep" aria-hidden>
            →
          </span>
          <span className="update-modal__ver-muted">New</span>{" "}
          <span className="update-modal__ver update-modal__ver--new">{newVersion}</span>
        </p>

        {releaseNotes ? (
          <div>
            <p className="update-modal__notes-label">What&apos;s new</p>
            <div className="update-modal__notes">{releaseNotes}</div>
          </div>
        ) : null}

        {showProgress ? (
          <div className="update-modal__progress-wrap" aria-live="polite">
            <div
              className="update-modal__progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progressPercent)}
            >
              <div
                className="update-modal__progress-bar"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
            <p className="update-modal__progress-label">
              Downloading… {Math.round(progressPercent)}%
            </p>
          </div>
        ) : null}

        {error ? <p className="update-modal__err">{error}</p> : null}

        <div className="update-modal__actions">
          <button
            type="button"
            className="update-modal__btn update-modal__btn--primary"
            onClick={onUpdate}
            disabled={busy}
          >
            {busy ? "Updating…" : "Update"}
          </button>
          <button
            type="button"
            className="update-modal__btn update-modal__btn--ghost"
            onClick={onNotNow}
            disabled={busy}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
