// Banner.jsx — informational system banners. Calibration, demo-mode.
// Always begin with the lockd glyph ℹ. Background tint is severity-derived but
// muted — banners are not alerts.

const bannerStyles = {
  calibration: {
    glyph: "ℹ",
    color: "var(--accent)",
    bg: "rgba(91, 141, 239, 0.08)",
    ring: "rgba(91, 141, 239, 0.28)",
  },
  demo: {
    glyph: "ℹ",
    color: "var(--fg-1)",
    bg: "var(--bg-raised)",
    ring: "var(--border-strong)",
  },
  success: {
    glyph: "✅",
    color: "var(--sev-healthy)",
    bg: "var(--tint-healthy)",
    ring: "var(--ring-healthy)",
  },
};

const Banner = ({ kind = "calibration", children, accuracy, action, dismissable = false, onDismiss }) => {
  const cfg = bannerStyles[kind] || bannerStyles.calibration;
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      padding: "10px 14px",
      background: cfg.bg,
      border: `1px solid ${cfg.ring}`,
      borderRadius: "var(--radius-sm)",
      color: "var(--fg-0)",
      fontSize: "var(--fs-13)",
      lineHeight: "var(--lh-body)",
    }}>
      <span style={{
        color: cfg.color,
        fontSize: 14,
        lineHeight: 1.3,
        flexShrink: 0,
        marginTop: 1,
        fontFamily: "var(--font-sans)",
      }}>{cfg.glyph}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "var(--fg-0)" }}>{children}</div>
        {accuracy != null && (
          <div style={{ marginTop: 4, fontSize: "var(--fs-12)", color: "var(--fg-2)" }}>
            Current accuracy estimate: <span style={{ color: cfg.color, fontFamily: "var(--font-mono)" }}>{accuracy}%</span> (improving)
          </div>
        )}
      </div>
      {action && (
        <button style={{
          all: "unset", cursor: "pointer",
          fontSize: "var(--fs-12)", color: cfg.color, fontWeight: "var(--fw-medium)",
          padding: "2px 6px",
        }} onClick={action.onClick}>{action.label}</button>
      )}
      {dismissable && (
        <button onClick={onDismiss} style={{
          all: "unset", cursor: "pointer",
          color: "var(--fg-2)", padding: 2,
        }} aria-label="Dismiss">
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
};

window.Banner = Banner;
