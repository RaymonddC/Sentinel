// AuditLogRow.jsx — single entry.
// time · actor · action · "Triggered by: <engine> (<value>)" · [chips]

const AuditLogRow = ({ entry, last = false }) => {
  const isSentinel = entry.actorKind === "sentinel";
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      padding: "10px 14px",
      borderBottom: last ? "none" : "1px solid var(--border-subtle)",
      fontFamily: "var(--font-sans)",
    }}>
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--fs-12)",
        color: "var(--fg-2)",
        width: 44,
        flexShrink: 0,
        paddingTop: 1,
      }}>{entry.time}</span>
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--fs-12)",
        color: isSentinel ? "var(--accent)" : "var(--fg-0)",
        fontWeight: "var(--fw-medium)",
        width: 130,
        flexShrink: 0,
        paddingTop: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>{entry.actor}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "var(--fs-13)",
          color: "var(--fg-1)",
          lineHeight: "var(--lh-body)",
        }}>{entry.action}</div>
        {entry.trigger && (
          <div style={{
            fontSize: "var(--fs-12)",
            color: "var(--fg-2)",
            marginTop: 2,
          }}>
            <span style={{ color: "var(--fg-3)" }}>Triggered by:</span>{" "}
            <span style={{ color: "var(--fg-1)" }}>{entry.trigger.engine}</span>{" "}
            <span style={{ fontFamily: "var(--font-mono)" }}>({entry.trigger.value})</span>
          </div>
        )}
        {entry.note && (
          <div style={{
            fontSize: "var(--fs-12)",
            color: "var(--fg-2)",
            marginTop: 2,
          }}>
            <span style={{ color: "var(--fg-3)" }}>note:</span> "{entry.note}"
          </div>
        )}
        {entry.chips && entry.chips.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {entry.chips.map((c) => (
              <AuditChip key={c} label={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const AuditChip = ({ label }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        all: "unset",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--fs-12)",
        color: hover ? "var(--fg-0)" : "var(--fg-1)",
        padding: "3px 8px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        background: hover ? "var(--bg-raised)" : "transparent",
        lineHeight: 1.2,
        transition: "background var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out)",
      }}
    >{label}</button>
  );
};

window.AuditLogRow = AuditLogRow;
window.AuditChip = AuditChip;
