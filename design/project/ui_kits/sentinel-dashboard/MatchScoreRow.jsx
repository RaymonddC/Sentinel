// MatchScoreRow.jsx — Behavioral / Stylometry / Combined as three labeled values.

const MatchScoreRow = ({ scores, severity = "high" }) => {
  const cfg = window.sevConfig[severity];
  const items = [
    { label: "Behavioral", value: scores.behavioral },
    { label: "Stylometry", value: scores.stylometry },
    { label: "Combined",   value: scores.combined, accent: true },
  ];
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 8,
    }}>
      {items.map(({ label, value, accent }) => (
        <div key={label} style={{
          background: accent ? "var(--bg-panel)" : "var(--bg-canvas)",
          border: `1px solid ${accent ? cfg.ring : "var(--border)"}`,
          borderRadius: "var(--radius-sm)",
          padding: "8px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          position: "relative",
          overflow: "hidden",
        }}>
          {accent && (
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: cfg.bg,
            }} />
          )}
          <div className="t-eyebrow" style={{ fontSize: 10, position: "relative" }}>{label}</div>
          <div style={{
            position: "relative",
            display: "flex",
            alignItems: "baseline",
            gap: 4,
          }}>
            <span style={{
              fontFamily: "var(--font-sans)",
              fontSize: accent ? "var(--fs-20)" : "var(--fs-17)",
              fontWeight: "var(--fw-semibold)",
              color: accent ? cfg.color : "var(--fg-0)",
              letterSpacing: "-0.01em",
              lineHeight: 1,
            }}>{value}</span>
            <span style={{ fontSize: "var(--fs-12)", color: "var(--fg-2)" }}>%</span>
          </div>
        </div>
      ))}
    </div>
  );
};

window.MatchScoreRow = MatchScoreRow;
