// RiskGauge.jsx — SVG arc. 0..100, severity-colored. Center shows the number.

const RiskGauge = ({ value = 50, severity = "medium", label, size = 180 }) => {
  const cfg = window.sevConfig[severity] || window.sevConfig.medium;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // Arc spans 240° (from -210 to +30) — bottom gap of 120°.
  const startAngle = -210;
  const totalSweep = 240;
  const valueSweep = (Math.max(0, Math.min(100, value)) / 100) * totalSweep;

  const polar = (deg) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const arc = (sweep) => {
    const start = polar(startAngle);
    const end = polar(startAngle + sweep);
    const large = sweep > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
  };

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size * 0.85} viewBox={`0 0 ${size} ${size * 0.92}`} style={{ display: "block" }}>
        {/* Track */}
        <path
          d={arc(totalSweep)}
          stroke="var(--border)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
        />
        {/* Value */}
        <path
          d={arc(valueSweep)}
          stroke={cfg.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          style={{ transition: "all 600ms var(--ease-out)" }}
        />
        {/* Tick marks at severity boundaries: 40 (medium), 70 (high), 90 (critical) */}
        {[40, 70, 90].map((t) => {
          const ang = startAngle + (t / 100) * totalSweep;
          const p1 = polar(ang);
          const inner = r - stroke / 2 - 3;
          const rad = (ang * Math.PI) / 180;
          const p2 = { x: cx + inner * Math.cos(rad), y: cy + inner * Math.sin(rad) };
          return (
            <line key={t}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="var(--bg-canvas)" strokeWidth={2}
            />
          );
        })}
        {/* Center number */}
        <text
          x={cx} y={cy + 4}
          textAnchor="middle"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 36,
            fontWeight: 600,
            fill: "var(--fg-0)",
            letterSpacing: "-0.02em",
          }}
        >{value}</text>
        <text
          x={cx} y={cy + 24}
          textAnchor="middle"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            fontWeight: 600,
            fill: cfg.color,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >{label || severity}</text>
      </svg>
    </div>
  );
};

window.RiskGauge = RiskGauge;
