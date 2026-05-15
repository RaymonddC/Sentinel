// RadioGroup.jsx — Low / Medium / High segmented radio.
// 3 options · 44px tall · severity-tinted on selection.

const RadioGroup = ({ options, value, onChange, severityMap, ariaLabel }) => {
  return (
    <div role="radiogroup" aria-label={ariaLabel} style={{
      display: "inline-flex",
      border: "1px solid var(--border)",
      background: "var(--bg-canvas)",
      borderRadius: "var(--radius-sm)",
      padding: 2,
      gap: 0,
    }}>
      {options.map((opt) => {
        const selected = opt.value === value;
        const cfg = selected && severityMap ? window.sevConfig[severityMap[opt.value]] : null;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            style={{
              all: "unset",
              cursor: "pointer",
              padding: "6px 14px",
              minWidth: 56,
              textAlign: "center",
              fontSize: "var(--fs-13)",
              fontFamily: "var(--font-sans)",
              fontWeight: selected ? "var(--fw-semibold)" : "var(--fw-regular)",
              color: cfg ? cfg.color : selected ? "var(--fg-0)" : "var(--fg-2)",
              background: cfg ? cfg.bg : selected ? "var(--bg-raised)" : "transparent",
              border: cfg ? `1px solid ${cfg.ring}` : "1px solid transparent",
              borderRadius: 4,
              transition: "background var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out)",
              lineHeight: 1.2,
            }}
          >{opt.label}</button>
        );
      })}
    </div>
  );
};

window.RadioGroup = RadioGroup;
