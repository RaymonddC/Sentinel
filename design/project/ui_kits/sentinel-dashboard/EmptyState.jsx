// EmptyState.jsx — used when a tab has no content.
// Glyph + sentence. Lock-vocabulary emoji only (✅ for positive, no glyph for neutral).

const EmptyState = ({ glyph, title, hint, severity = "healthy", style }) => {
  const cfg = severity ? window.sevConfig[severity] : null;
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 24px",
      gap: 8,
      textAlign: "center",
      ...style,
    }}>
      {glyph && (
        <div style={{
          fontSize: 28,
          lineHeight: 1,
          color: cfg ? cfg.color : "var(--fg-1)",
          marginBottom: 2,
        }}>{glyph}</div>
      )}
      <div style={{
        fontSize: "var(--fs-15)",
        color: "var(--fg-0)",
        fontWeight: "var(--fw-medium)",
        lineHeight: "var(--lh-snug)",
        maxWidth: 420,
      }}>{title}</div>
      {hint && (
        <div style={{
          fontSize: "var(--fs-13)",
          color: "var(--fg-2)",
          lineHeight: "var(--lh-body)",
          maxWidth: 420,
        }}>{hint}</div>
      )}
    </div>
  );
};

window.EmptyState = EmptyState;
