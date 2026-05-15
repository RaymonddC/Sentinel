// TabBar.jsx — sticky inside the custom post. 4 tabs.

const TabBar = ({ tabs, active, onChange }) => {
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        alignItems: "stretch",
        height: "var(--row-tab)",
        background: "var(--bg-panel)",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 5,
      }}
    >
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <TabButton
            key={t.id}
            label={t.label}
            icon={t.icon}
            count={t.count}
            severity={t.severity}
            active={isActive}
            onClick={() => onChange(t.id)}
          />
        );
      })}
    </div>
  );
};

const TabButton = ({ label, icon, count, severity, active, onClick }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        minWidth: 0,
        position: "relative",
        background: active ? "var(--bg-raised)" : hover ? "var(--bg-raised)" : "transparent",
        color: active ? "var(--fg-0)" : "var(--fg-1)",
        border: "none",
        borderRight: "1px solid var(--border)",
        cursor: "pointer",
        padding: "0 12px",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--fs-12)",
        fontWeight: active ? "var(--fw-semibold)" : "var(--fw-medium)",
        letterSpacing: "var(--tracking-caps)",
        textTransform: "uppercase",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        transition: "background var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out)",
      }}
    >
      {icon && <Icon name={icon} size={14} />}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      {count != null && count > 0 && (
        <span style={{
          minWidth: 18, height: 16, padding: "0 5px",
          borderRadius: 8,
          background: severity ? `var(--sev-${severity})` : "var(--bg-raised-2)",
          color: severity ? "var(--fg-inv)" : "var(--fg-1)",
          fontSize: 10,
          fontWeight: "var(--fw-semibold)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          letterSpacing: 0,
          fontVariantNumeric: "tabular-nums",
        }}>{count}</span>
      )}
      {active && (
        <span style={{
          position: "absolute",
          left: 0, right: 0, bottom: -1, height: 2,
          background: "var(--fg-0)",
        }} />
      )}
    </button>
  );
};

window.TabBar = TabBar;
