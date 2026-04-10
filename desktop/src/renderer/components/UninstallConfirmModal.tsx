type Props = {
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function UninstallConfirmModal({
  busy,
  error,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="update-modal-backdrop" role="presentation">
      <div
        className="update-modal uninstall-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="uninstall-modal-title"
        aria-describedby="uninstall-modal-desc"
      >
        <h2 id="uninstall-modal-title" className="uninstall-modal__title">
          Uninstall BofBot?
        </h2>
        <p id="uninstall-modal-desc" className="update-modal__body">
          This will remove BofBot and all local data. Are you sure?
        </p>
        {error ? <p className="update-modal__err">{error}</p> : null}
        <div className="update-modal__actions">
          <button
            type="button"
            className="uninstall-modal__btn uninstall-modal__btn--danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Uninstalling…" : "Yes, uninstall"}
          </button>
          <button
            type="button"
            className="update-modal__btn update-modal__btn--ghost"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
