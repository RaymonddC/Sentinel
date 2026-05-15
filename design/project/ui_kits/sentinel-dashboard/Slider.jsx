// Slider.jsx — sensitivity slider. Range 0..100 with severity tick marks.

const Slider = ({ value, onChange, min = 0, max = 100, label, hint, severity }) => {
  const ref = React.useRef(null);
  const cfg = severity ? window.sevConfig[severity] : null;
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: "var(--fs-13)", color: "var(--fg-0)", fontWeight: "var(--fw-medium)" }}>{label}</span>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-13)",
            color: cfg ? cfg.color : "var(--fg-0)",
            fontWeight: "var(--fw-medium)",
          }}>{value}</span>
        </div>
      )}
      <div style={{
        position: "relative",
        height: 22,
        display: "flex",
        alignItems: "center",
      }}>
        {/* Track */}
        <div style={{
          position: "absolute", left: 0, right: 0,
          height: 4, borderRadius: 2,
          background: "var(--bg-raised-2)",
          border: "1px solid var(--border)",
        }} />
        {/* Fill */}
        <div style={{
          position: "absolute", left: 0,
          width: `${pct}%`,
          height: 4, borderRadius: 2,
          background: cfg ? cfg.color : "var(--accent)",
          opacity: 0.85,
          transition: "width var(--dur-base) var(--ease-out)",
        }} />
        {/* Tick marks at severity boundaries — for visual reference only */}
        {[40, 70, 90].map((t) => (
          <div key={t} style={{
            position: "absolute",
            left: `${t}%`, transform: "translateX(-50%)",
            width: 1, height: 8,
            background: "var(--border-strong)",
            top: "calc(50% - 4px)",
          }} />
        ))}
        {/* Handle */}
        <input
          ref={ref}
          type="range"
          min={min} max={max} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer",
            margin: 0,
          }}
        />
        <div style={{
          position: "absolute",
          left: `${pct}%`, transform: "translateX(-50%)",
          width: 16, height: 16,
          borderRadius: "50%",
          background: "var(--fg-0)",
          border: `2px solid ${cfg ? cfg.color : "var(--accent)"}`,
          pointerEvents: "none",
          transition: "left var(--dur-base) var(--ease-out)",
        }} />
      </div>
      {hint && (
        <div style={{ fontSize: "var(--fs-12)", color: "var(--fg-2)" }}>{hint}</div>
      )}
    </div>
  );
};

window.Slider = Slider;
