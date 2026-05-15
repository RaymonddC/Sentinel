// PostFrame.jsx — the Reddit chrome around the Sentinel custom post.
// Subreddit header + "Pinned post" indicator. Minimal — Sentinel is the star.

const PostFrame = ({ children, summary }) => {
  return (
    <div style={{
      width: "100%",
      maxWidth: 720,
      margin: "0 auto",
    }}>
      {/* Subreddit row */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 4px 12px",
        color: "var(--fg-1)",
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "var(--bg-raised-2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--fg-0)",
          border: "1px solid var(--border)",
        }}>r/</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-13)",
            color: "var(--fg-0)",
            fontWeight: "var(--fw-medium)",
          }}>r/example</span>
          <span style={{ fontSize: "var(--fs-11)", color: "var(--fg-2)" }}>
            240k members · mod tools
          </span>
        </div>
      </div>

      {/* The custom post */}
      <article style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}>
        {/* Post title row — outside the Devvit area, this is Reddit's chrome */}
        <header style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <img src="../../assets/mark.svg" width="22" height="22" alt="" style={{ display: "block" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
            }}>
              <span style={{
                fontSize: 10,
                fontWeight: "var(--fw-semibold)",
                color: "var(--sev-healthy)",
                letterSpacing: "var(--tracking-caps)",
                textTransform: "uppercase",
                padding: "2px 6px",
                border: "1px solid var(--ring-healthy)",
                borderRadius: 4,
                background: "var(--tint-healthy)",
              }}>Pinned</span>
              <span style={{
                fontSize: "var(--fs-15)",
                color: "var(--fg-0)",
                fontWeight: "var(--fw-semibold)",
              }}>Sentinel · moderation intelligence</span>
            </div>
            {summary && (
              <div style={{
                fontSize: "var(--fs-12)",
                color: "var(--fg-2)",
                marginTop: 3,
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}>
                <span><span style={{ color: "var(--fg-0)", fontFamily: "var(--font-mono)" }}>{summary.alertsLast24h}</span> alerts · 24h</span>
                <span><span style={{ color: "var(--sev-critical)", fontFamily: "var(--font-mono)" }}>{summary.criticalActive}</span> critical active</span>
                <span>health <span style={{ color: "var(--fg-0)", fontFamily: "var(--font-mono)" }}>{summary.healthScore}</span></span>
              </div>
            )}
          </div>
          <Icon name="more-horizontal" size={18} style={{ color: "var(--fg-2)" }} />
        </header>

        {/* Devvit area — children */}
        <div style={{ background: "var(--bg-panel)" }}>
          {children}
        </div>

        {/* Post footer — Reddit chrome */}
        <footer style={{
          borderTop: "1px solid var(--border)",
          padding: "8px 16px",
          display: "flex",
          gap: 16,
          fontSize: "var(--fs-12)",
          color: "var(--fg-2)",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon name="arrow-up" size={14} /> 1
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon name="message-square" size={14} /> mods only
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon name="shield" size={14} /> mod-locked
          </span>
        </footer>
      </article>
    </div>
  );
};

window.PostFrame = PostFrame;
