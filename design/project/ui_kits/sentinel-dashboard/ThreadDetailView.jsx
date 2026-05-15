// ThreadDetail.jsx — Brief #14. Opened when a thread row is tapped in the
// Threads queue. Shows the RiskGauge prominently with the forecast,
// supporting signals, recent actions taken, and quick-action buttons.

const ThreadDetail = ({ thread, onBack }) => {
  const cfg = window.sevConfig[thread.severity] || window.sevConfig.medium;
  const forecastNoAction = Math.min(99, thread.risk + 17);
  const forecastWithAction = Math.max(20, Math.round(thread.risk * 0.55));
  const trendGlyph = thread.trend === "up" ? "↑ rising" : thread.trend === "down" ? "↓ easing" : "— flat";

  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Back link */}
      <button
        onClick={onBack}
        style={{
          all: "unset", cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 6,
          color: "var(--fg-1)",
          fontSize: "var(--fs-13)",
          fontFamily: "var(--font-sans)",
          alignSelf: "flex-start",
        }}
      >
        <Icon name="chevron-left" size={14} />
        Back to threads
      </button>

      {/* Title row + severity rail */}
      <div style={{
        position: "relative",
        background: "var(--bg-canvas)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "14px 16px 14px 20px",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: 4, background: cfg.color,
        }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <SeverityBadge severity={thread.severity} size="small" />
          <span style={{
            fontSize: "var(--fs-11)",
            color: cfg.color,
            fontWeight: "var(--fw-medium)",
            letterSpacing: "var(--tracking-caps)",
            textTransform: "uppercase",
            fontFamily: "var(--font-mono)",
          }}>{trendGlyph}</span>
          <span style={{ fontSize: "var(--fs-11)", color: "var(--fg-2)" }}>· age {formatAge(thread.ageMin)}</span>
        </div>
        <div style={{ fontSize: "var(--fs-17)", color: "var(--fg-0)", fontWeight: "var(--fw-semibold)", lineHeight: "var(--lh-snug)" }}>
          "{thread.title}"
        </div>
      </div>

      {/* Gauge + forecast */}
      <div style={{
        background: "var(--bg-canvas)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: 14,
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 16,
        alignItems: "center",
      }}>
        <RiskGauge value={thread.risk} severity={thread.severity} label={severityLabel(thread.severity)} size={160} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="t-eyebrow">Forecast · next 90 min</div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <ForecastFigure
              label="No intervention"
              value={forecastNoAction}
              color="var(--sev-critical)"
            />
            <ForecastFigure
              label="With slow mode"
              value={forecastWithAction}
              color="var(--sev-medium)"
            />
          </div>
          <p style={{ fontSize: "var(--fs-13)", color: "var(--fg-1)", margin: "4px 0 0", lineHeight: "var(--lh-body)" }}>
            Risk is projected to peak at{" "}
            <span style={{ color: "var(--sev-critical)", fontFamily: "var(--font-mono)" }}>{forecastNoAction}%</span>{" "}
            within 90 minutes. Slow mode reduces predicted peak to{" "}
            <span style={{ color: "var(--sev-medium)", fontFamily: "var(--font-mono)" }}>{forecastWithAction}%</span>.
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button variant="primary" size="default" icon="zap">Enable slow mode</Button>
        <Button variant="secondary" size="default" icon="filter">Auto-filter new accounts</Button>
        <Button variant="ghost" size="default" icon="lock">Lock thread</Button>
      </div>

      {/* Signals + counts */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
        {/* Active signals */}
        <div style={{
          background: "var(--bg-canvas)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "12px 14px",
        }}>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>Active signals</div>
          {thread.signals?.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {thread.signals.map((s) => (
                <div key={s} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  background: "var(--bg-panel)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "var(--fs-13)",
                  color: "var(--fg-1)",
                  fontFamily: "var(--font-mono)",
                }}>
                  <span style={{ color: cfg.color, fontSize: 11 }}>✓</span>
                  {s}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: "var(--fs-12)", color: "var(--fg-2)" }}>No signals firing on this thread.</div>
          )}
        </div>

        {/* Stats */}
        <div style={{
          background: "var(--bg-canvas)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "12px 14px",
        }}>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>Counts</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <StatRow label="Reports"   value={thread.reports} />
            <StatRow label="Removed"   value={thread.removals} />
            <StatRow label="Age"       value={formatAge(thread.ageMin)} />
          </div>
        </div>
      </div>

      {/* Recent actions on this thread */}
      <div style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
      }}>
        <div className="t-eyebrow" style={{ padding: "12px 14px 6px" }}>Recent actions on this thread</div>
        <AuditLogRow entry={{
          time: "14:23", actor: "u/mod_jane", actorKind: "mod",
          action: `enabled slow mode on "${thread.title}"`,
          trigger: { engine: "Raid Radar", value: "89% confidence" },
          chips: ["Undo"],
        }} />
        <AuditLogRow entry={{
          time: "13:47", actor: "Sentinel", actorKind: "sentinel",
          action: `auto-filtered new accounts on "${thread.title}"`,
          trigger: { engine: "Health Score", value: `risk ${thread.risk}` },
          chips: ["Undo"],
        }} last />
      </div>
    </div>
  );
};

// ---------- helpers ----------
const ForecastFigure = ({ label, value, color }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
    <span style={{ fontSize: 11, color: "var(--fg-2)" }}>{label}</span>
    <span style={{
      fontFamily: "var(--font-mono)",
      fontSize: "var(--fs-24)",
      fontWeight: 600,
      color,
      lineHeight: 1,
      letterSpacing: "-0.01em",
    }}>{value}%</span>
  </div>
);

const StatRow = ({ label, value }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
    <span style={{ fontSize: "var(--fs-12)", color: "var(--fg-2)" }}>{label}</span>
    <span style={{
      fontFamily: "var(--font-mono)",
      fontSize: "var(--fs-15)",
      color: "var(--fg-0)",
      fontWeight: 500,
    }}>{value}</span>
  </div>
);

function formatAge(min) {
  if (min < 60) return `${min}m`;
  if (min < 24 * 60) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / (24 * 60))}d`;
}
function severityLabel(sev) {
  return ({ critical: "critical", high: "rising", medium: "watch", healthy: "ok" })[sev] || sev;
}

window.ThreadDetail = ThreadDetail;
