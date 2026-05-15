// AlertCard.jsx — the dominant component. Now driven by real spec shape:
//   title (verdict) + evidence + confidence + signal pills.

const AlertCard = ({
  severity = "medium",
  title,
  evidence,
  id,
  engine,                    // "Raid Radar" | "Memory" | "Health Score" — shows in eyebrow row
  confidence,
  signals,
  allSignals,                // optional — full signal universe; missing ones render greyed-out
  target,
  startedAgo,
  accounts,
  tag,                       // optional override for the badge label (e.g. "POSSIBLE BAN EVADER")
  expanded = false,
  onToggle,
  onAction,
  children,
}) => {
  const cfg = window.sevConfig[severity] || window.sevConfig.medium;
  const [hover, setHover] = React.useState(false);

  return (
    <div
      style={{
        background: hover && !expanded ? "var(--bg-raised)" : "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        transition: "background var(--dur-base) var(--ease-out)",
        position: "relative",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Left severity rule + tint wash */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: 4, background: cfg.color,
        }} />
        <div style={{
          position: "absolute", left: 4, top: 0, bottom: 0,
          width: 64,
          background: `linear-gradient(to right, ${cfg.bg}, transparent)`,
        }} />
      </div>

      <button
        onClick={onToggle}
        style={{
          all: "unset", display: "block", width: "100%",
          cursor: "pointer",
          padding: "12px 14px 14px 18px",
          minHeight: "var(--row-alert)",
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Eyebrow row: severity badge + id + meta */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <SeverityBadge severity={severity} label={tag} size="small" />
              {engine && (
                <span style={{
                  fontSize: "var(--fs-11)",
                  color: "var(--fg-1)",
                  fontWeight: "var(--fw-medium)",
                  textTransform: "uppercase",
                  letterSpacing: "var(--tracking-caps)",
                }}>{engine}</span>
              )}
              {id && (
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--fs-11)",
                  color: "var(--fg-2)",
                }}>· {id}</span>
              )}
              {startedAgo && (
                <span style={{ fontSize: "var(--fs-12)", color: "var(--fg-2)" }}>· {startedAgo}</span>
              )}
            </div>

            {/* Title (verdict) */}
            <div style={{
              fontSize: "var(--fs-15)",
              color: "var(--fg-0)",
              fontWeight: "var(--fw-semibold)",
              lineHeight: "var(--lh-snug)",
              marginBottom: 4,
              textAlign: "left",
              letterSpacing: "-0.005em",
            }}>
              {title}
            </div>

            {/* Evidence + confidence */}
            {evidence && (
              <div style={{
                fontSize: "var(--fs-13)",
                color: "var(--fg-1)",
                lineHeight: "var(--lh-body)",
                textAlign: "left",
              }}>
                {evidence}
                {confidence != null && (
                  <> <span style={{ color: "var(--fg-2)" }}>Confidence</span>{" "}
                  <span style={{
                    color: "var(--fg-0)",
                    fontFamily: "var(--font-mono)",
                    fontWeight: "var(--fw-medium)",
                  }}>{Math.round(confidence * 100)}%.</span></>
                )}
              </div>
            )}

            {/* Signal pills */}
            {signals && signals.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <SignalRow signals={signals} severity={severity} allSignals={allSignals} />
              </div>
            )}
          </div>

          <Icon name={expanded ? "chevron-up" : "chevron-down"} size={16}
            style={{ color: "var(--fg-2)", marginTop: 2 }} />
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          borderTop: "1px solid var(--border-subtle)",
          padding: "12px 14px 14px 18px",
          background: "var(--bg-canvas)",
          position: "relative",
        }}>
          {children}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <Button variant="primary" size="small" icon="zap" onClick={onAction}>Enable slow mode</Button>
            <Button variant="secondary" size="small" icon="filter">Auto-filter new accounts</Button>
            <Button variant="ghost" size="small" icon="archive">Dismiss</Button>
          </div>
        </div>
      )}
    </div>
  );
};

window.AlertCard = AlertCard;
