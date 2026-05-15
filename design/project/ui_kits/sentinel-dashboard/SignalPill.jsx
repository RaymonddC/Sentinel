// SignalPill.jsx — ✓ velocity, ✓ age cluster, ...
// Tiny inline pill confirming one signal contributed to a detection.

const SignalPill = ({ label, severity = "critical", active = true }) => {
  const cfg = window.sevConfig[severity] || window.sevConfig.critical;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "2px 8px 2px 6px",
      borderRadius: "var(--radius-pill)",
      background: active ? cfg.bg : "transparent",
      border: `1px solid ${active ? cfg.ring : "var(--border)"}`,
      color: active ? cfg.color : "var(--fg-3)",
      fontSize: "var(--fs-11)",
      fontWeight: "var(--fw-medium)",
      lineHeight: 1,
      fontFamily: "var(--font-sans)",
      whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: 10, opacity: active ? 1 : 0.4 }}>✓</span>
      {label}
    </span>
  );
};

const SignalRow = ({ signals = [], severity = "critical", allSignals }) => {
  // If allSignals provided, render greyed-out versions for the ones NOT in `signals`.
  const universe = allSignals || signals;
  const present = new Set(signals);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {universe.map((s) => (
        <SignalPill key={s} label={s} severity={severity} active={present.has(s)} />
      ))}
    </div>
  );
};

Object.assign(window, { SignalPill, SignalRow });
