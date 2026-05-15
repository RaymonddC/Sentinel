// SeverityBadge.jsx — capsule. CRITICAL / HIGH / MEDIUM / HEALTHY.

const sevConfig = {
  critical: { label: "CRITICAL", color: "var(--sev-critical)", bg: "var(--tint-critical)", ring: "var(--ring-critical)" },
  high:     { label: "HIGH",     color: "var(--sev-high)",     bg: "var(--tint-high)",     ring: "var(--ring-high)" },
  medium:   { label: "MEDIUM",   color: "var(--sev-medium)",   bg: "var(--tint-medium)",   ring: "var(--ring-medium)" },
  healthy:  { label: "HEALTHY",  color: "var(--sev-healthy)",  bg: "var(--tint-healthy)",  ring: "var(--ring-healthy)" },
};

const SeverityBadge = ({ severity = "medium", label, dot = false, size = "default", style }) => {
  const cfg = sevConfig[severity] || sevConfig.medium;
  const small = size === "small";
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: small ? "2px 8px" : "3px 10px",
      borderRadius: "var(--radius-pill)",
      background: cfg.bg,
      color: cfg.color,
      border: `1px solid ${cfg.ring}`,
      fontSize: small ? 10 : "var(--fs-11)",
      fontWeight: "var(--fw-semibold)",
      letterSpacing: "var(--tracking-caps)",
      lineHeight: 1,
      whiteSpace: "nowrap",
      fontVariantNumeric: "tabular-nums",
      ...style,
    }}>
      {dot && (
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: cfg.color, display: "inline-block",
        }} />
      )}
      {label || cfg.label}
    </span>
  );
};

// Tiny colored dot — for inline severity hints (no text).
const SeverityDot = ({ severity = "medium", size = 8 }) => {
  const cfg = sevConfig[severity] || sevConfig.medium;
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%",
      background: cfg.color, display: "inline-block", flexShrink: 0,
    }} />
  );
};

window.SeverityBadge = SeverityBadge;
window.SeverityDot = SeverityDot;
window.sevConfig = sevConfig;
