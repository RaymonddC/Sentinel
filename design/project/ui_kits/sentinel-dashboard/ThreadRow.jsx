// ThreadRow.jsx — one row in the Threads triage queue.

const ThreadRow = ({ thread, onClick }) => {
  const cfg = window.sevConfig[thread.severity] || window.sevConfig.medium;
  const [hover, setHover] = React.useState(false);
  const trendGlyph = thread.trend === "up" ? "↑" : thread.trend === "down" ? "↓" : "—";

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        background: hover ? "var(--bg-raised)" : "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "12px 14px 12px 18px",
        display: "flex",
        gap: 12,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        transition: "background var(--dur-base) var(--ease-out)",
      }}
    >
      {/* Severity rail */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: 4, background: cfg.color, pointerEvents: "none",
      }} />

      {/* Risk score + trend */}
      <div style={{
        width: 52, flexShrink: 0,
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
      }}>
        <span style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--fs-20)",
          fontWeight: "var(--fw-semibold)",
          color: cfg.color,
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}>{thread.risk}</span>
        <span style={{
          fontSize: 10,
          fontWeight: "var(--fw-semibold)",
          letterSpacing: "var(--tracking-caps)",
          color: cfg.color,
          fontFamily: "var(--font-mono)",
        }}>{trendGlyph} {thread.trend === "up" ? "rising" : thread.trend === "down" ? "easing" : "flat"}</span>
      </div>

      {/* Middle: title + summary + signals */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
          flexWrap: "wrap",
        }}>
          <span style={{
            fontSize: "var(--fs-14)",
            color: "var(--fg-0)",
            fontWeight: "var(--fw-semibold)",
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "100%",
          }}>"{thread.title}"</span>
        </div>
        <div style={{
          fontSize: "var(--fs-12)",
          color: "var(--fg-1)",
          lineHeight: "var(--lh-body)",
          marginBottom: thread.signals?.length ? 6 : 0,
        }}>{thread.summary}</div>
        {thread.signals?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {thread.signals.map((s) => (
              <span key={s} style={{
                fontSize: 11,
                padding: "1px 7px",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-canvas)",
                border: "1px solid var(--border)",
                color: "var(--fg-1)",
                fontFamily: "var(--font-mono)",
                lineHeight: 1.4,
              }}>{s}</span>
            ))}
          </div>
        )}
      </div>

      {/* Right column: counts */}
      <div style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 2,
        fontFamily: "var(--font-mono)",
        fontSize: "var(--fs-11)",
        color: "var(--fg-2)",
        minWidth: 70,
      }}>
        <span><span style={{ color: "var(--fg-0)" }}>{thread.reports}</span> reports</span>
        <span><span style={{ color: "var(--fg-0)" }}>{thread.removals}</span> removed</span>
        <span>{formatAge(thread.ageMin)}</span>
      </div>
    </div>
  );
};

function formatAge(min) {
  if (min < 60) return `${min}m`;
  if (min < 24 * 60) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / (24 * 60))}d`;
}

window.ThreadRow = ThreadRow;
