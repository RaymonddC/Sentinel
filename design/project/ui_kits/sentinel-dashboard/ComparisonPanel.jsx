// ComparisonPanel.jsx — Memory: ⚠ POSSIBLE BAN EVADER + match scores +
// "then" vs "now" side-by-side.

const ComparisonPanel = ({ memory }) => {
  const cfg = window.sevConfig[memory.severity];

  const Side = ({ side, accentColor }) => (
    <div style={{
      flex: 1,
      minWidth: 0,
      background: "var(--bg-panel)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)",
      padding: "12px 14px",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        marginBottom: 8,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: accentColor }} />
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-11)",
          color: "var(--fg-1)",
          fontWeight: "var(--fw-medium)",
        }}>{side.label}</span>
      </div>
      <ul style={{
        listStyle: "none", padding: 0, margin: 0,
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        {side.items.map((item, i) => (
          <li key={i} style={{
            fontSize: "var(--fs-13)",
            color: "var(--fg-1)",
            lineHeight: "var(--lh-body)",
            paddingLeft: 12,
            position: "relative",
          }}>
            <span style={{
              position: "absolute", left: 0, top: "0.7em",
              width: 4, height: 1, background: "var(--fg-3)",
            }} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div style={{
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)",
      background: "var(--bg-canvas)",
      padding: 14,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Left rule + tint */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: 4, background: cfg.color, pointerEvents: "none",
      }} />

      {/* Header: ⚠ badge + headline */}
      <div style={{ marginBottom: 10, paddingLeft: 6 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          marginBottom: 6, flexWrap: "wrap",
        }}>
          <SeverityBadge severity={memory.severity} label={`⚠ ${memory.tag || "POSSIBLE BAN EVADER"}`} size="small" />
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-13)",
            color: "var(--fg-0)",
            fontWeight: "var(--fw-medium)",
          }}>{memory.user}</span>
        </div>
        <div style={{
          fontSize: "var(--fs-14)",
          color: "var(--fg-0)",
          fontWeight: "var(--fw-medium)",
          lineHeight: "var(--lh-body)",
          marginBottom: 2,
        }}>
          {memory.headline} <span style={{ color: "var(--fg-2)", fontWeight: "var(--fw-regular)" }}>
            ({memory.bannedUser} · banned {memory.bannedDate} for {memory.bannedReason})
          </span>
        </div>
      </div>

      {/* Match scores */}
      <div style={{ marginBottom: 12 }}>
        <MatchScoreRow scores={memory.scores} severity={memory.severity} />
      </div>

      {/* Then / Now */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Side side={memory.then} accentColor="var(--fg-3)" />
        <Side side={memory.now}  accentColor={cfg.color} />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <Button variant="primary" size="small" icon="user-x">Ban (rule 2)</Button>
        <Button variant="secondary" size="small" icon="inbox">Modmail user</Button>
        <Button variant="ghost" size="small" icon="x">Dismiss</Button>
      </div>
    </div>
  );
};

window.ComparisonPanel = ComparisonPanel;
