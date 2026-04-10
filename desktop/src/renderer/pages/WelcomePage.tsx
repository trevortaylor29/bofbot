type Props = {
  onLogin: () => void;
  onCreateAccount: () => void;
};

export function WelcomePage({ onLogin, onCreateAccount }: Props) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.5rem 3rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
          marginBottom: "1.25rem",
        }}
      >
        <div className="logo-mark">B</div>
        <span className="font-display" style={{ fontSize: "1.65rem", fontWeight: 700, letterSpacing: "-0.03em" }}>
          BofBot
        </span>
      </div>
      <p
        style={{
          color: "var(--muted)",
          fontSize: "1rem",
          lineHeight: 1.55,
          textAlign: "center",
          maxWidth: "22.5rem",
          margin: "0 0 2rem",
        }}
      >
        Built for creators who post, not edit. Process batches on your machine — fast overlays, your files stay local.
      </p>
      <div
        style={{
          width: "100%",
          maxWidth: 320,
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <button type="button" className="btn-primary btn-primary--large" style={{ width: "100%" }} onClick={onLogin}>
          Log in
        </button>
        <button type="button" className="btn-secondary-outline" style={{ width: "100%" }} onClick={onCreateAccount}>
          Create account
          <span style={{ fontSize: "0.75rem", fontWeight: 500, opacity: 0.85 }}> (opens browser)</span>
        </button>
      </div>
    </div>
  );
}
