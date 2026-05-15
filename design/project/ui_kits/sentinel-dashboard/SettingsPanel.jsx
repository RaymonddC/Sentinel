// SettingsPanel.jsx — Brief #18 (simple) + Brief #19 (advanced accordion).
//
// Simple view: master toggle, 3 engine radios, 2 delivery checkboxes, [Save].
// Advanced (collapsed by default): quiet hours, auto-actions per engine,
// exempt users/flairs, per-signal weights, calibration stats, misc gates.

const SETTINGS_LEVELS = [
  { value: "low",    label: "Low"    },
  { value: "medium", label: "Medium" },
  { value: "high",   label: "High"   },
];
const ENGINE_LEVEL_SEVERITY = { low: "healthy", medium: "medium", high: "high" };

const SettingsPanel = ({ data }) => {
  const [s, setS] = React.useState(data.settings);
  const [adv, setAdv] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  const update = (mutator) => {
    setS((prev) => {
      const next = structuredClone(prev);
      mutator(next);
      return next;
    });
    setDirty(true);
  };

  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ---------- Master toggle ---------- */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: "var(--fs-17)", fontWeight: "var(--fw-semibold)", color: "var(--fg-0)" }}>
              Sentinel {s.enabled ? "on" : "off"}
            </div>
            <div style={{ fontSize: "var(--fs-12)", color: "var(--fg-2)", marginTop: 2 }}>
              {s.enabled ? "Active · all enabled engines monitoring" : "Paused · no detection running"}
            </div>
          </div>
          <Toggle checked={s.enabled} onChange={(v) => update((n) => { n.enabled = v; })} />
        </div>
      </Card>

      {/* ---------- Engine sensitivity ---------- */}
      <Card title="Engine sensitivity"
            hint="Higher catches more, including some false positives. Lower means only high-confidence alerts.">
        {Object.entries(s.engines).map(([name, cfg]) => (
          <SettingsRow key={name} dim={!s.enabled}>
            <RowLabel title={name} hint={engineHint(name)} />
            <RadioGroup
              options={SETTINGS_LEVELS}
              value={cfg.level}
              onChange={(v) => update((n) => { n.engines[name].level = v; })}
              severityMap={ENGINE_LEVEL_SEVERITY}
              ariaLabel={`${name} sensitivity`}
            />
          </SettingsRow>
        ))}
      </Card>

      {/* ---------- Alert delivery ---------- */}
      <Card title="Alert delivery">
        <Checkbox
          checked
          alwaysOn
          label="Pinned dashboard"
          hint="Sentinel is always pinned at the top of the sub. This is the surface you're looking at."
        />
        <Checkbox
          checked={s.delivery.modmailCritical}
          onChange={(v) => update((n) => { n.delivery.modmailCritical = v; })}
          label="Modmail for critical alerts"
          hint="Sentinel sends a modmail when a CRITICAL alert opens. High and medium stay in the dashboard only."
        />
      </Card>

      {/* ---------- Advanced (accordion) ---------- */}
      <Card>
        <button
          onClick={() => setAdv((v) => !v)}
          style={{
            all: "unset", cursor: "pointer", width: "100%",
            display: "flex", alignItems: "center", gap: 8,
            color: "var(--fg-0)",
          }}
          aria-expanded={adv}
        >
          <span style={{
            display: "inline-block",
            transform: adv ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform var(--dur-base) var(--ease-out)",
            fontSize: 12, color: "var(--fg-2)",
            width: 12, textAlign: "center",
          }}>▶</span>
          <span style={{ fontSize: "var(--fs-15)", fontWeight: "var(--fw-semibold)" }}>Advanced settings</span>
          <span style={{ fontSize: "var(--fs-12)", color: "var(--fg-2)", marginLeft: "auto" }}>
            {adv ? "" : "Power-user controls · hidden by default"}
          </span>
        </button>
        {adv && <AdvancedPanel s={s} update={update} />}
      </Card>

      {/* ---------- Save ---------- */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "flex-end",
        gap: 10,
        paddingTop: 4,
      }}>
        {dirty && (
          <span style={{ fontSize: "var(--fs-12)", color: "var(--fg-2)" }}>
            Unsaved changes
          </span>
        )}
        <Button variant="secondary" size="default" onClick={() => { setS(data.settings); setDirty(false); }}>
          Discard
        </Button>
        <Button variant="primary" size="default" icon="check" onClick={() => setDirty(false)}>
          Save
        </Button>
      </div>
    </div>
  );
};

// ============================================================
// Advanced panel — Brief #19
// ============================================================
const AdvancedPanel = ({ s, update }) => {
  const a = s.advanced;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingTop: 14 }}>

      {/* ---- Quiet hours ---- */}
      <Subsection title="Quiet hours">
        <SettingsRow>
          <Checkbox
            checked={a.quietHours.enabled}
            onChange={(v) => update((n) => { n.advanced.quietHours.enabled = v; })}
            label={`Don't send modmail between ${pad(a.quietHours.fromHour)}:00 – ${pad(a.quietHours.toHour)}:00 UTC`}
          />
        </SettingsRow>
        {a.quietHours.enabled && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", paddingLeft: 28, marginTop: 2 }}>
            <NumberInput value={a.quietHours.fromHour} min={0} max={23}
              onChange={(v) => update((n) => { n.advanced.quietHours.fromHour = v; })} unit="hr" />
            <span style={{ color: "var(--fg-2)", fontSize: 13 }}>to</span>
            <NumberInput value={a.quietHours.toHour} min={0} max={23}
              onChange={(v) => update((n) => { n.advanced.quietHours.toHour = v; })} unit="hr" />
            <span style={{ color: "var(--fg-2)", fontSize: 12 }}>UTC</span>
          </div>
        )}
      </Subsection>

      {/* ---- Auto-actions per engine ---- */}
      <Subsection title="Auto-actions">
        {/* Raid Radar */}
        <EngineAutoActions
          engine="Raid Radar"
          actions={a.autoActions.raidRadar}
          fieldKey="confidence"
          unit=""
          fmt={(v) => v.toFixed(2)}
          step={0.05} min={0.5} max={1}
          onSet={(name, patch) => update((n) => {
            n.advanced.autoActions.raidRadar[name] = { ...n.advanced.autoActions.raidRadar[name], ...patch };
          })}
          actionLabels={{ slowMode: "Auto-enable slow mode", filterNew: "Auto-filter new accounts" }}
          thresholdLabel={(v) => `at confidence > ${v.toFixed(2)}`}
        />

        {/* Memory — explicit "no auto-actions" disclosure */}
        <div style={{
          marginTop: 12,
          padding: "10px 12px",
          background: "var(--bg-canvas)",
          border: "1px dashed var(--border)",
          borderRadius: "var(--radius-sm)",
        }}>
          <div style={{ fontSize: "var(--fs-13)", color: "var(--fg-0)", fontWeight: "var(--fw-medium)", marginBottom: 2 }}>Memory</div>
          <div style={{ fontSize: "var(--fs-12)", color: "var(--fg-2)" }}>
            No auto-actions available — Memory always suggests, never acts.
          </div>
        </div>

        {/* Health Score */}
        <div style={{ marginTop: 12 }}>
          <EngineAutoActions
            engine="Health Score"
            actions={a.autoActions.healthScore}
            fieldKey="risk"
            unit=""
            fmt={(v) => `${v}`}
            step={5} min={50} max={100}
            onSet={(name, patch) => update((n) => {
              n.advanced.autoActions.healthScore[name] = { ...n.advanced.autoActions.healthScore[name], ...patch };
            })}
            actionLabels={{ slowMode: "Auto-enable slow mode", filterNew: "Auto-filter new accounts" }}
            thresholdLabel={(v) => `at risk > ${v}`}
          />
        </div>
      </Subsection>

      {/* ---- Exempt users / flairs ---- */}
      <Subsection title="Exemptions">
        <FieldLabel label="Exempt users">
          <ChipList
            items={a.exemptUsers}
            onRemove={(idx) => update((n) => { n.advanced.exemptUsers.splice(idx, 1); })}
            placeholder="add username"
            mono
          />
        </FieldLabel>
        <FieldLabel label="Exempt flairs">
          <ChipList
            items={a.exemptFlairs}
            onRemove={(idx) => update((n) => { n.advanced.exemptFlairs.splice(idx, 1); })}
            placeholder="add flair"
          />
        </FieldLabel>
        <SettingsRow>
          <Checkbox
            checked={a.watchOnlyFlairs.enabled}
            onChange={(v) => update((n) => { n.advanced.watchOnlyFlairs.enabled = v; })}
            label="Only watch threads tagged with these flairs"
            hint={a.watchOnlyFlairs.enabled
              ? (a.watchOnlyFlairs.flairs.length ? `Watching: ${a.watchOnlyFlairs.flairs.join(", ")}` : "Add flairs below")
              : "Watch all threads (recommended)"}
          />
        </SettingsRow>
      </Subsection>

      {/* ---- Per-signal weights ---- */}
      <Subsection title="Signal weights">
        <WeightGroup
          title="Raid Radar"
          weights={a.raidRadarWeights}
          labels={{ velocity: "Velocity", ageCluster: "Age cluster", overlap: "Subreddit overlap", sync: "Sync (timing)" }}
          onChange={(name, v) => update((n) => { n.advanced.raidRadarWeights[name] = v; })}
        />
        <div style={{ marginTop: 14 }}>
          <WeightGroup
            title="Health Score"
            weights={a.healthScoreWeights}
            labels={{ reportRate: "Report rate", removalRate: "Removal rate", newAccountShare: "New-account share", modmailVolume: "Modmail volume" }}
            onChange={(name, v) => update((n) => { n.advanced.healthScoreWeights[name] = v; })}
          />
        </div>
      </Subsection>

      {/* ---- Calibration health ---- */}
      <Subsection title="Calibration health">
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
        }}>
          <ReadOnlyStat label="Total alerts (7d)"     value={a.calibration.totalAlerts7d} />
          <ReadOnlyStat label="False positive rate"   value={`${Math.round(a.calibration.falsePositiveRate * 100)}%`} />
          <ReadOnlyStat label="Mod actions taken"     value={a.calibration.modActionsTaken} />
        </div>
      </Subsection>

      {/* ---- Misc tuning ---- */}
      <Subsection title="Tuning">
        <SettingsRow>
          <RowLabel title="Sync banned-index to Mod Notes" hint="Sentinel writes a note when a Memory match is confirmed by a ban." />
          <Toggle checked={a.modNotesSync} onChange={(v) => update((n) => { n.advanced.modNotesSync = v; })} />
        </SettingsRow>
        <SettingsRow>
          <RowLabel title="Memory minimum comments" hint="Ignore accounts with fewer than N comments — too little signal to stylo-match." />
          <NumberInput
            value={a.memoryMinComments} min={1} max={100}
            onChange={(v) => update((n) => { n.advanced.memoryMinComments = v; })}
            unit="comments"
          />
        </SettingsRow>
        <SettingsRow>
          <RowLabel title="Slow-mode velocity impact" hint="Expected reduction in posting velocity when slow-mode triggers. Used by the forecast." />
          <NumberInput
            value={a.slowModeVelocityImpact} min={0} max={1} step={0.05}
            onChange={(v) => update((n) => { n.advanced.slowModeVelocityImpact = v; })}
            unit="×"
          />
        </SettingsRow>
      </Subsection>

    </div>
  );
};

// ============================================================
// Subcomponents
// ============================================================
const EngineAutoActions = ({ engine, actions, fieldKey, fmt, step, min, max, onSet, actionLabels, thresholdLabel }) => (
  <div>
    <div style={{ fontSize: "var(--fs-13)", color: "var(--fg-0)", fontWeight: "var(--fw-medium)", marginBottom: 6 }}>{engine}</div>
    {Object.entries(actions).map(([name, cfg]) => (
      <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Checkbox
            checked={cfg.enabled}
            onChange={(v) => onSet(name, { enabled: v })}
            label={actionLabels[name]}
            hint={thresholdLabel(cfg[fieldKey])}
          />
        </div>
        {cfg.enabled && (
          <NumberInput
            value={cfg[fieldKey]}
            min={min} max={max} step={step}
            onChange={(v) => onSet(name, { [fieldKey]: v })}
          />
        )}
      </div>
    ))}
  </div>
);

const WeightGroup = ({ title, weights, labels, onChange }) => {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const ok = total === 100;
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 8,
      }}>
        <span style={{ fontSize: "var(--fs-13)", color: "var(--fg-0)", fontWeight: "var(--fw-medium)" }}>{title}</span>
        <span style={{
          fontSize: "var(--fs-12)",
          fontFamily: "var(--font-mono)",
          color: ok ? "var(--sev-healthy)" : "var(--sev-high)",
        }}>
          {ok ? "✓ 100%" : `Σ ${total}% — must equal 100`}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {Object.entries(weights).map(([name, v]) => (
          <div key={name} style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 80px",
            alignItems: "center",
            gap: 12,
          }}>
            <span style={{ fontSize: "var(--fs-13)", color: "var(--fg-1)" }}>{labels[name]}</span>
            <NumberInput value={v} min={0} max={100} onChange={(nv) => onChange(name, nv)} unit="%" width={36} />
          </div>
        ))}
      </div>
    </div>
  );
};

const ChipList = ({ items, onRemove, placeholder, mono }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
    {items.map((u, i) => (
      <span key={u + i} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "4px 6px 4px 10px",
        borderRadius: "var(--radius-sm)",
        background: "var(--bg-raised)",
        border: "1px solid var(--border)",
        fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: "var(--fs-12)",
        color: "var(--fg-1)",
      }}>
        {u}
        <button onClick={() => onRemove(i)} style={{
          all: "unset", cursor: "pointer", color: "var(--fg-2)",
          display: "inline-flex", padding: 2,
        }} aria-label={`Remove ${u}`}>
          <Icon name="x" size={12} />
        </button>
      </span>
    ))}
    <button style={{
      all: "unset", cursor: "pointer",
      padding: "4px 10px",
      borderRadius: "var(--radius-sm)",
      border: "1px dashed var(--border-strong)",
      color: "var(--fg-1)",
      fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
      fontSize: "var(--fs-12)",
    }}>+ {placeholder}</button>
  </div>
);

const ReadOnlyStat = ({ label, value }) => (
  <div style={{
    background: "var(--bg-canvas)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: "10px 12px",
  }}>
    <div className="t-eyebrow" style={{ fontSize: 10, marginBottom: 4 }}>{label}</div>
    <div style={{
      fontFamily: "var(--font-mono)",
      fontSize: "var(--fs-17)",
      fontWeight: "var(--fw-medium)",
      color: "var(--fg-0)",
    }}>{value}</div>
  </div>
);

// ----- chrome -----
const Card = ({ title, hint, children }) => (
  <section style={{
    background: "var(--bg-canvas)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "14px 16px",
  }}>
    {title && (
      <header style={{ marginBottom: 10 }}>
        <div className="t-eyebrow">{title}</div>
        {hint && <div style={{ fontSize: "var(--fs-12)", color: "var(--fg-2)", marginTop: 4 }}>{hint}</div>}
      </header>
    )}
    {children}
  </section>
);

const Subsection = ({ title, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    <div className="t-eyebrow">{title}</div>
    {children}
  </div>
);

const SettingsRow = ({ children, dim }) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 12, padding: "8px 0",
    borderBottom: "1px solid var(--border-subtle)",
    opacity: dim ? 0.45 : 1,
    pointerEvents: dim ? "none" : "auto",
  }}>
    {children}
  </div>
);

const RowLabel = ({ title, hint }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
    <span style={{ fontSize: "var(--fs-13)", color: "var(--fg-0)", fontWeight: "var(--fw-medium)" }}>{title}</span>
    {hint && <span style={{ fontSize: "var(--fs-12)", color: "var(--fg-2)" }}>{hint}</span>}
  </div>
);

const FieldLabel = ({ label, children }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: "var(--fs-13)", color: "var(--fg-0)", fontWeight: "var(--fw-medium)", marginBottom: 6 }}>{label}</div>
    {children}
  </div>
);

function engineHint(name) {
  if (name === "Raid Radar")   return "Coordinated brigades · vote rings · sockpuppet swarms";
  if (name === "Memory")       return "Returning users · ban evasion · stylometry matches";
  if (name === "Health Score") return "Subreddit-level risk · forecasts · auto-actions";
  return "";
}
function pad(n) { return String(n).padStart(2, "0"); }

window.SettingsPanel = SettingsPanel;
