// Toggle.jsx — on/off switch. Used in Settings.

const Toggle = ({ checked, onChange, label, size = "default" }) => {
  const w = size === "small" ? 28 : 34;
  const h = size === "small" ? 16 : 20;
  const knob = h - 4;
  return (
    <label style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      cursor: "pointer", userSelect: "none",
    }}>
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onChange(!checked); } }}
        style={{
          width: w, height: h,
          borderRadius: "var(--radius-pill)",
          background: checked ? "var(--accent)" : "var(--bg-raised-2)",
          border: `1px solid ${checked ? "var(--accent)" : "var(--border-strong)"}`,
          position: "relative",
          transition: "background var(--dur-base) var(--ease-out)",
          flexShrink: 0,
        }}
      >
        <span style={{
          position: "absolute",
          top: 1, left: checked ? w - knob - 3 : 1,
          width: knob, height: knob,
          borderRadius: "50%",
          background: checked ? "var(--fg-inv)" : "var(--fg-1)",
          transition: "left var(--dur-base) var(--ease-out)",
        }} />
      </span>
      {label && <span style={{ fontSize: "var(--fs-13)", color: "var(--fg-0)" }}>{label}</span>}
    </label>
  );
};

window.Toggle = Toggle;
