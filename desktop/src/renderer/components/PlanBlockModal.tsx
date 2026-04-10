import { API_BASE_URL } from "../../config";

type Variant =
  | "internet"
  | "session_expired"
  | "daily_limit"
  | "starter_hooks"
  | "free_custom_hooks"
  | "custom_hooks_limit";

const COPY: Record<
  Variant,
  { title: string; body: string; primary?: string; showPricing?: boolean }
> = {
  internet: {
    title: "Connection required",
    body: "Internet connection required to verify your subscription.",
  },
  session_expired: {
    title: "Session expired",
    body: "Your session is no longer valid. Please sign in again.",
  },
  daily_limit: {
    title: "Daily limit reached",
    body: `Daily limit reached. Upgrade your plan at ${API_BASE_URL}/pricing`,
    primary: "View pricing",
    showPricing: true,
  },
  starter_hooks: {
    title: "Starter plan limit",
    body: "Starter plan allows up to 5 custom hooks (text you type in the custom fields). Preset chips are unlimited. Upgrade to Pro for unlimited custom hooks.",
    primary: "View pricing",
    showPricing: true,
  },
  free_custom_hooks: {
    title: "Custom hooks not on Free",
    body: "Preset chips are unlimited on every plan. Custom text in the banner or full-text fields is not included on Free — upgrade to add your own lines.",
    primary: "View pricing",
    showPricing: true,
  },
  custom_hooks_limit: {
    title: "Custom hook limit",
    body: "Your plan limits how many custom lines you can type. Preset chips stay unlimited. Upgrade to raise the limit.",
    primary: "View pricing",
    showPricing: true,
  },
};

type Props = {
  variant: Variant;
  onClose: () => void;
};

export function PlanBlockModal({ variant, onClose }: Props) {
  const c = COPY[variant];
  return (
    <div
      className="plan-block-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-block-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="plan-block-modal card" onClick={(e) => e.stopPropagation()}>
        <h2 id="plan-block-modal-title" className="font-display" style={{ fontSize: "1.2rem", margin: "0 0 0.75rem" }}>
          {c.title}
        </h2>
        <p style={{ color: "var(--muted)", margin: "0 0 1.25rem", fontSize: "0.9rem", lineHeight: 1.5 }}>{c.body}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "flex-end" }}>
          {c.showPricing && c.primary && (
            <button
              type="button"
              className="btn-primary"
              onClick={async () => {
                await window.bofbot.openPricing();
                onClose();
              }}
            >
              {c.primary}
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
