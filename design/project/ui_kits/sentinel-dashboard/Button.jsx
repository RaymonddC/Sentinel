// Button.jsx — primary / secondary / ghost. Press translates 1px.

const buttonStyles = {
  base: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-13)",
    fontWeight: "var(--fw-medium)",
    lineHeight: 1,
    border: "1px solid transparent",
    borderRadius: "var(--radius-sm)",
    padding: "0 12px",
    height: 32,
    minWidth: 44,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    cursor: "pointer",
    transition: "background-color var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out), transform var(--dur-fast) var(--ease-out)",
    userSelect: "none",
    whiteSpace: "nowrap",
  },
  primary: {
    background: "var(--accent)",
    color: "var(--fg-inv)",
    fontWeight: "var(--fw-semibold)",
  },
  secondary: {
    background: "var(--bg-raised)",
    color: "var(--fg-0)",
    borderColor: "var(--border)",
  },
  ghost: {
    background: "transparent",
    color: "var(--fg-1)",
  },
  small: { height: 28, padding: "0 10px", fontSize: "var(--fs-12)" },
  large: { height: 40, padding: "0 16px", fontSize: "var(--fs-14)" },
};

const Button = ({ variant = "secondary", size = "default", icon, children, onClick, style, type = "button" }) => {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);

  const hoverBg = {
    primary: "var(--accent-hover)",
    secondary: "var(--bg-raised-2)",
    ghost: "var(--bg-raised)",
  }[variant];

  const pressBg = {
    primary: "var(--accent-press)",
    secondary: "var(--bg-raised-2)",
    ghost: "var(--bg-raised-2)",
  }[variant];

  const composed = {
    ...buttonStyles.base,
    ...buttonStyles[variant],
    ...(size === "small" ? buttonStyles.small : {}),
    ...(size === "large" ? buttonStyles.large : {}),
    ...(hover && !press ? { background: hoverBg } : {}),
    ...(press ? { background: pressBg, transform: "translateY(1px)" } : {}),
    ...style,
  };

  return (
    <button
      type={type}
      style={composed}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      onClick={onClick}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  );
};

window.Button = Button;
