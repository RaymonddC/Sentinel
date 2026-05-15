// Checkbox.jsx — accessible checkbox with optional disabled "(always on)" state.

const Checkbox = ({ checked, onChange, label, hint, disabled = false, alwaysOn = false }) => {
  const handle = () => { if (!disabled && !alwaysOn) onChange(!checked); };
  const isOn = alwaysOn || checked;
  return (
    <label
      onClick={handle}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "8px 0",
        cursor: disabled || alwaysOn ? "default" : "pointer",
        userSelect: "none",
      }}
    >
      <span style={{
        width: 18, height: 18,
        flexShrink: 0,
        marginTop: 2,
        borderRadius: 4,
        border: `1px solid ${isOn ? "var(--accent)" : "var(--border-strong)"}`,
        background: isOn ? "var(--accent)" : "var(--bg-canvas)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
        transition: "background var(--dur-base) var(--ease-out)",
      }}>
        {isOn && (
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="var(--fg-inv)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 12 10 18 20 6" />
          </svg>
        )}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}>
          <span style={{
            fontSize: "var(--fs-13)",
            color: "var(--fg-0)",
            fontWeight: "var(--fw-medium)",
            opacity: disabled ? 0.6 : 1,
          }}>{label}</span>
          {alwaysOn && (
            <span style={{
              fontSize: 10,
              color: "var(--fg-2)",
              fontFamily: "var(--font-mono)",
              padding: "1px 6px",
              border: "1px solid var(--border)",
              borderRadius: 4,
            }}>always on</span>
          )}
        </span>
        {hint && (
          <span style={{
            display: "block",
            fontSize: "var(--fs-12)",
            color: "var(--fg-2)",
            marginTop: 2,
            lineHeight: "var(--lh-body)",
          }}>{hint}</span>
        )}
      </span>
    </label>
  );
};

window.Checkbox = Checkbox;
