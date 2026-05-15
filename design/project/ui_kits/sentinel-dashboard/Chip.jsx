// Chip.jsx — filter / toggle chip.

const Chip = ({ children, active = false, count, icon, onClick, style }) => {
  const [hover, setHover] = React.useState(false);
  const bg = active
    ? "var(--bg-raised-2)"
    : hover ? "var(--bg-raised)" : "transparent";
  const borderColor = active ? "var(--border-strong)" : "var(--border)";
  const color = active ? "var(--fg-0)" : "var(--fg-1)";
  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 28,
        padding: "0 10px",
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${borderColor}`,
        background: bg,
        color,
        fontSize: "var(--fs-12)",
        fontWeight: active ? "var(--fw-medium)" : "var(--fw-regular)",
        fontFamily: "var(--font-sans)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out)",
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
      {count != null && (
        <span style={{
          fontFamily: "var(--font-mono)",
          color: active ? "var(--fg-0)" : "var(--fg-2)",
          fontSize: 11,
          paddingLeft: 4,
          fontVariantNumeric: "tabular-nums",
        }}>{count}</span>
      )}
    </button>
  );
};

window.Chip = Chip;
