// ClusterGraph.jsx — pre-positioned node/link graph for Raid Radar.
// Hover a node to highlight its edges + show the username.

const ClusterGraph = ({ cluster }) => {
  const accounts = cluster?.accounts || 12;
  const sev = window.sevConfig[cluster?.severity || "critical"];

  // Generate a deterministic radial layout: 1 central "target" + N accounts around.
  const width = 560;
  const height = 220;
  const cx = width / 2;
  const cy = height / 2;
  const nodes = React.useMemo(() => {
    const arr = [{ id: "target", kind: "target", label: "thread", x: cx, y: cy }];
    for (let i = 0; i < accounts; i++) {
      const angle = (i / accounts) * Math.PI * 2 + Math.PI / 6;
      // Two rings — half closer, half further
      const ring = i % 3 === 0 ? 88 : i % 3 === 1 ? 64 : 78;
      arr.push({
        id: `u${i}`,
        kind: "account",
        label: `u/throwaway_${4400 + i * 7}`,
        x: cx + ring * Math.cos(angle),
        y: cy + ring * Math.sin(angle) * 0.7, // ellipse — wider than tall
      });
    }
    return arr;
  }, [accounts]);

  const links = React.useMemo(() => {
    const arr = [];
    // Every account → target
    for (let i = 0; i < accounts; i++) arr.push(["target", `u${i}`]);
    // Cross-links: every account → next 2 accounts (suggests coordination)
    for (let i = 0; i < accounts; i++) {
      arr.push([`u${i}`, `u${(i + 1) % accounts}`]);
      if (i % 2 === 0) arr.push([`u${i}`, `u${(i + 2) % accounts}`]);
    }
    return arr;
  }, [accounts]);

  const [hoverId, setHoverId] = React.useState(null);
  const byId = React.useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);

  return (
    <div style={{
      background: "var(--bg-canvas)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)",
      padding: 12,
      position: "relative",
    }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: "block" }}>
        {/* Links */}
        {links.map(([a, b], i) => {
          const na = byId[a]; const nb = byId[b];
          if (!na || !nb) return null;
          const involves = hoverId && (a === hoverId || b === hoverId);
          return (
            <line
              key={i}
              x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
              stroke={involves ? sev.color : "var(--border-strong)"}
              strokeWidth={involves ? 1.4 : 0.8}
              opacity={hoverId && !involves ? 0.25 : 0.85}
              style={{ transition: "all 120ms var(--ease-out)" }}
            />
          );
        })}
        {/* Nodes */}
        {nodes.map((n) => {
          const isTarget = n.kind === "target";
          const isHover = hoverId === n.id;
          return (
            <g key={n.id}
              onMouseEnter={() => setHoverId(n.id)}
              onMouseLeave={() => setHoverId(null)}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={n.x} cy={n.y}
                r={isTarget ? 10 : isHover ? 6 : 4.5}
                fill={isTarget ? "var(--bg-raised-2)" : sev.color}
                stroke={isTarget ? "var(--fg-1)" : "var(--bg-canvas)"}
                strokeWidth={isTarget ? 1.5 : 1.5}
                style={{ transition: "r 120ms var(--ease-out)" }}
              />
              {isTarget && (
                <text x={n.x} y={n.y + 22}
                  textAnchor="middle"
                  style={{
                    fontFamily: "var(--font-mono)", fontSize: 10,
                    fill: "var(--fg-1)",
                  }}>{n.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      {/* Hover label */}
      <div style={{
        position: "absolute",
        bottom: 10, left: 14,
        fontFamily: "var(--font-mono)",
        fontSize: "var(--fs-12)",
        color: hoverId ? "var(--fg-0)" : "var(--fg-2)",
        transition: "color var(--dur-base) var(--ease-out)",
        pointerEvents: "none",
      }}>
        {hoverId && byId[hoverId]?.kind === "account"
          ? byId[hoverId].label
          : `${accounts} accounts · 1 target`}
      </div>
      <div style={{
        position: "absolute", top: 10, right: 14,
        display: "flex", gap: 10, alignItems: "center",
      }}>
        <SeverityDot severity={cluster?.severity || "critical"} />
        <span style={{ fontSize: "var(--fs-12)", color: "var(--fg-2)" }}>
          coordination strength <span style={{ color: "var(--fg-0)", fontFamily: "var(--font-mono)" }}>0.81</span>
        </span>
      </div>
    </div>
  );
};

window.ClusterGraph = ClusterGraph;
