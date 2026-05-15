// RiskListRow.jsx — one user in the Users tab risk list.
// Compact, scannable. Tap-to-expand opens the Memory comparison view.

const RiskListRow = ({ user, onClick }) => {
  const cfg = window.sevConfig[user.severity] || window.sevConfig.medium;
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        background: hover ? "var(--bg-raised)" : "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        transition: "background var(--dur-base) var(--ease-out)",
      }}
    >
      {/* Risk score, mono, color-coded */}
      <div style={{
        width: 44, flexShrink: 0,
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1,
      }}>
        <span style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--fs-20)",
          fontWeight: "var(--fw-semibold)",
          color: cfg.color,
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}>{user.risk}</span>
        <span style={{
          fontSize: 10,
          fontWeight: "var(--fw-semibold)",
          letterSpacing: "var(--tracking-caps)",
          color: "var(--fg-2)",
        }}>RISK</span>
      </div>

      {/* Middle: username + summary */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-13)",
            color: "var(--fg-0)",
            fontWeight: "var(--fw-medium)",
          }}>{user.username}</span>
          <SeverityBadge severity={user.severity} label={user.tag} size="small" />
        </div>
        <div style={{
          fontSize: "var(--fs-13)",
          color: "var(--fg-1)",
          lineHeight: "var(--lh-body)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>{user.summary}</div>
      </div>

      {/* Right: last seen */}
      <div style={{
        flexShrink: 0,
        textAlign: "right",
        fontSize: "var(--fs-12)",
        color: user.lastSeen === "active now" ? cfg.color : "var(--fg-2)",
        fontFamily: "var(--font-mono)",
      }}>{user.lastSeen}</div>
    </div>
  );
};

window.RiskListRow = RiskListRow;
