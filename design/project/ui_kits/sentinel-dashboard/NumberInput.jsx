// NumberInput.jsx — small numeric input with optional unit.

const NumberInput = ({ value, onChange, min, max, step = 1, unit, width = 70 }) => {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      background: "var(--bg-canvas)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-sm)",
      padding: "4px 8px",
      height: 28,
      boxSizing: "border-box",
    }}>
      <input
        type="number"
        value={value}
        min={min} max={max} step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          all: "unset",
          width,
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-13)",
          color: "var(--fg-0)",
          textAlign: "right",
        }}
      />
      {unit && (
        <span style={{
          fontSize: "var(--fs-12)",
          color: "var(--fg-2)",
          fontFamily: "var(--font-mono)",
        }}>{unit}</span>
      )}
    </span>
  );
};

window.NumberInput = NumberInput;
