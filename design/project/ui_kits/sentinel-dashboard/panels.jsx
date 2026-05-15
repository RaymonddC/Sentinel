// panels.jsx — five tabs · function-named.
// SettingsPanel lives in SettingsPanel.jsx; ThreadDetail in ThreadDetail.jsx.

// ============================================================
// 1. THREATS — mixed feed. AlertCard handles cluster/evader/thread-risk uniformly.
// ============================================================
const ThreatsPanel = ({ data, filter, setFilter, expandedId, onToggleExpand }) => {
  const allSignals = ["velocity", "age cluster", "overlap", "sync"];
  const counts = data.threats.reduce(
    (a, t) => ({ ...a, [t.severity]: (a[t.severity] || 0) + 1 }),
    {}
  );
  const visible = filter === "all" ? data.threats : data.threats.filter((t) => t.severity === filter);

  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <Chip active={filter === "all"}      count={data.threats.length}   onClick={() => setFilter("all")}>All</Chip>
        <Chip active={filter === "critical"} count={counts.critical || 0} icon="alert-octagon"  onClick={() => setFilter("critical")}>Critical</Chip>
        <Chip active={filter === "high"}     count={counts.high || 0}     icon="alert-triangle" onClick={() => setFilter("high")}>High</Chip>
        <Chip active={filter === "medium"}   count={counts.medium || 0}   icon="alert-circle"   onClick={() => setFilter("medium")}>Medium</Chip>
        <span style={{ flex: 1 }} />
        <Chip icon="filter">Engine</Chip>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          glyph="✅"
          title="No active threats."
          hint="All engines are monitoring."
        />
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visible.map((t) => (
              <AlertCard
                key={t.id}
                severity={t.severity}
                id={t.id}
                engine={t.engine}
                title={t.title}
                evidence={t.evidence}
                confidence={t.confidence}
                signals={t.signals}
                allSignals={t.kind === "cluster" ? allSignals : t.signals}
                startedAgo={t.startedAgo}
                tag={t.kind === "evader" ? "⚠ POSSIBLE BAN EVADER" : null}
                expanded={expandedId === t.id}
                onToggle={() => onToggleExpand(t.id)}
              >
                <ThreatDetailBody threat={t} />
              </AlertCard>
            ))}
          </div>
          <button style={ghostFullStyle}>
            View all open threats (12) <Icon name="chevron-right" size={14} />
          </button>
        </>
      )}
    </div>
  );
};

// Kind-specific expanded body (inside an AlertCard in the Threats feed)
const ThreatDetailBody = ({ threat }) => {
  if (threat.kind === "cluster") {
    return (
      <>
        <ClusterGraph cluster={threat} />
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <MiniStat label="Target"   value={threat.target}    mono={false} />
          <MiniStat label="Accounts" value={threat.accounts} />
          <MiniStat label="Started"  value={threat.startedAgo} mono={false} />
        </div>
      </>
    );
  }
  if (threat.kind === "evader") {
    return (
      <>
        <div style={{ marginBottom: 10 }}>
          <MatchScoreRow scores={threat.scores} severity={threat.severity} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <ThenNowSide side={threat.then} accentColor="var(--fg-3)" />
          <ThenNowSide side={threat.now}  accentColor={window.sevConfig[threat.severity].color} />
        </div>
      </>
    );
  }
  if (threat.kind === "thread-risk") {
    return (
      <div style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: 14,
      }}>
        <div className="t-eyebrow" style={{ marginBottom: 8 }}>Forecast · next 90 min</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--fg-2)" }}>No intervention</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-20)", color: "var(--sev-critical)", fontWeight: 600 }}>{threat.forecast.noAction.peak}%</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--fg-2)" }}>With slow mode</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-20)", color: "var(--sev-medium)", fontWeight: 600 }}>{threat.forecast.withAction.peak}%</div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const ThenNowSide = ({ side, accentColor }) => (
  <div style={{
    background: "var(--bg-panel)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "12px 14px",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: accentColor }} />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-1)", fontWeight: 500 }}>{side.label}</span>
    </div>
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      {side.items.map((item, i) => (
        <li key={i} style={{
          fontSize: 13, color: "var(--fg-1)", lineHeight: 1.45,
          paddingLeft: 12, position: "relative",
        }}>
          <span style={{ position: "absolute", left: 0, top: ".7em", width: 4, height: 1, background: "var(--fg-3)" }} />
          {item}
        </li>
      ))}
    </ul>
  </div>
);

// ============================================================
// 2. USERS
// ============================================================
const UsersPanel = ({ data }) => {
  const [q, setQ] = React.useState("");
  const filtered = q ? data.users.filter((u) => u.username.toLowerCase().includes(q.toLowerCase())) : data.users;
  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Search */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "var(--bg-canvas)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: "0 12px",
        height: 36,
      }}>
        <Icon name="search" size={14} style={{ color: "var(--fg-2)" }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by username, modmail ID, or comment text…"
          style={{
            all: "unset", flex: 1,
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-13)",
            color: "var(--fg-0)",
            minWidth: 0,
          }}
        />
        {q && <button onClick={() => setQ("")} style={{ all: "unset", cursor: "pointer", color: "var(--fg-2)" }}><Icon name="x" size={14} /></button>}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <Chip active count={data.users.length}>High risk</Chip>
        <Chip>Recently active</Chip>
        <Chip>Returning</Chip>
        <Chip>New accounts</Chip>
        <span style={{ flex: 1 }} />
        <Chip icon="sliders-horizontal" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No high-risk users detected right now."
          hint="Search above to look up any user."
        />
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map((u) => <RiskListRow key={u.username} user={u} />)}
          </div>
          <button style={ghostFullStyle}>
            View all flagged users (42) <Icon name="chevron-right" size={14} />
          </button>
        </>
      )}
    </div>
  );
};

// ============================================================
// 3. THREADS — list view OR detail view (Brief #14)
// ============================================================
const ThreadsPanel = ({ data, openTitle, onOpen, onBack }) => {
  if (openTitle) {
    const t = data.threads.find((x) => x.title === openTitle) || data.threads[0];
    return <ThreadDetail thread={t} onBack={onBack} />;
  }
  if (data.threads.length === 0) {
    return (
      <div style={{ padding: 14 }}>
        <EmptyState
          title="No threads being watched."
          hint="Active threads will appear here automatically."
        />
      </div>
    );
  }
  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <Chip active count={data.threads.length}>Watched</Chip>
        <Chip>Rising</Chip>
        <Chip>Auto-actions taken</Chip>
        <span style={{ flex: 1 }} />
        <Chip icon="arrow-up-down">Sort: risk</Chip>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.threads.map((t) => (
          <ThreadRow key={t.title} thread={t} onClick={() => onOpen(t.title)} />
        ))}
      </div>
      <button style={ghostFullStyle}>
        View all threads in last 24h (28) <Icon name="chevron-right" size={14} />
      </button>
    </div>
  );
};

// ============================================================
// 4. ACTIVITY LOG
// ============================================================
const ActivityLogPanel = ({ data }) => {
  if (data.activityLog.length === 0) {
    return (
      <div style={{ padding: 14 }}>
        <EmptyState
          title="No actions recorded yet."
          hint="Actions taken by Sentinel or mods will appear here."
        />
      </div>
    );
  }
  return (
    <div style={{ padding: "14px 0 14px" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
        padding: "0 14px 12px",
      }}>
        <Chip active>All actions</Chip>
        <Chip>Mods</Chip>
        <Chip icon="radar">Sentinel</Chip>
        <Chip>Reversible</Chip>
        <span style={{ flex: 1 }} />
        <Chip icon="download">Export</Chip>
      </div>
      <div style={{
        margin: "0 14px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        background: "var(--bg-panel)",
      }}>
        {data.activityLog.map((e, i) => (
          <AuditLogRow key={i} entry={e} last={i === data.activityLog.length - 1} />
        ))}
      </div>
    </div>
  );
};

// ----- helpers shared by panels -----
const MiniStat = ({ label, value, mono = true }) => (
  <div style={{
    background: "var(--bg-panel)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: "8px 10px",
    minWidth: 0,
  }}>
    <div className="t-eyebrow" style={{ fontSize: 10, marginBottom: 3 }}>{label}</div>
    <div style={{
      fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
      fontSize: "var(--fs-13)",
      color: "var(--fg-0)",
      fontWeight: "var(--fw-medium)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    }}>{value}</div>
  </div>
);

const ghostFullStyle = {
  all: "unset",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  width: "100%",
  height: 36,
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--fg-1)",
  fontSize: "var(--fs-13)",
  fontFamily: "var(--font-sans)",
};

Object.assign(window, { ThreatsPanel, UsersPanel, ThreadsPanel, ActivityLogPanel });
