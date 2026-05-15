// KpiTile.jsx — number + label + delta. Compact, 88px tall.

const KpiTile = ({ label, value, delta, trend = "flat", severity, style }) => {
  const sev = severity ? window.sevConfig[severity] : null;
  const trendIcon = trend === "up" ? "trending-up" : trend === "down" ? "trending-down" : "minus";
  const trendColor =
    severity && severity !== "healthy" ? "var(--fg-1)"
    : trend === "flat" ? "var(--fg-2)"
    : "var(--fg-1)";

  return (
    <div style={{
      background: "var(--bg-raised)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)",
      padding: "12px 14px",
      height: "var(--row-kpi)",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      position: "relative",
      overflow: "hidden",
      ...style,
    }}>
      {/* Severity tab — tiny indicator in top-right */}
      {sev && (
        <span style={{
          position: "absolute", top: 10, right: 10,
          width: 6, height: 6, borderRadius: "50%",
          background: sev.color,
        }} />
      )}
      <div style={{
        fontSize: "var(--fs-12)",
        color: "var(--fg-2)",
        textTransform: "uppercase",
        letterSpacing: "var(--tracking-caps)",
        fontWeight: "var(--fw-medium)",
      }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span className="t-kpi">{value}</span>
        {delta && delta !== "0" && (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
            fontSize: "var(--fs-12)",
            fontFamily: "var(--font-mono)",
            color: trendColor,
          }}>
            <Icon name={trendIcon} size={12} />
            {delta}
          </span>
        )}
      </div>
    </div>
  );
};

window.KpiTile = KpiTile;
