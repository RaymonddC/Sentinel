// App.jsx — top-level. Five function-named tabs. State for threats filter,
// expanded threat, open thread (drill-down), banner visibility.

const App = () => {
  const data = window.SentinelData;
  const [tab, setTab] = React.useState("threats");
  const [filter, setFilter] = React.useState("all");
  const [expandedId, setExpandedId] = React.useState("C-0442");
  const [openThread, setOpenThread] = React.useState(null);
  const [bannerOpen, setBannerOpen] = React.useState(true);

  const openCount = data.threats.length;
  const criticalCount = data.threats.filter((t) => t.severity === "critical").length;

  const tabs = [
    { id: "threats",  label: "Threats",  icon: "shield-alert", count: openCount,    severity: criticalCount ? "critical" : "high" },
    { id: "users",    label: "Users",    icon: "users",        count: null },
    { id: "threads",  label: "Threads",  icon: "list-tree",    count: null },
    { id: "activity", label: "Activity", icon: "scroll-text",  count: null },
    { id: "settings", label: "Settings", icon: "settings-2",   count: null },
  ];

  const onTab = (id) => { setTab(id); if (id !== "threads") setOpenThread(null); };

  return (
    <PostFrame summary={data.summary}>
      <TabBar tabs={tabs} active={tab} onChange={onTab} />

      {bannerOpen && data.banner && (
        <div style={{ padding: "12px 14px 0" }}>
          <Banner
            kind="calibration"
            accuracy={data.banner.accuracy}
            dismissable
            onDismiss={() => setBannerOpen(false)}
          >
            {data.banner.text}
          </Banner>
        </div>
      )}

      {tab === "threats"  && <ThreatsPanel
                                data={data}
                                filter={filter} setFilter={setFilter}
                                expandedId={expandedId}
                                onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)} />}
      {tab === "users"    && <UsersPanel       data={data} />}
      {tab === "threads"  && <ThreadsPanel     data={data}
                                                openTitle={openThread}
                                                onOpen={setOpenThread}
                                                onBack={() => setOpenThread(null)} />}
      {tab === "activity" && <ActivityLogPanel data={data} />}
      {tab === "settings" && <SettingsPanel    data={data} />}
    </PostFrame>
  );
};

window.SentinelApp = App;

(() => {
  const mount = () => {
    const el = document.getElementById("root");
    if (!el || el.__mounted) return;
    el.__mounted = true;
    const root = ReactDOM.createRoot(el);
    root.render(<App />);
    setTimeout(() => window.lucide && window.lucide.createIcons(), 30);
    setTimeout(() => window.lucide && window.lucide.createIcons(), 300);
    setTimeout(() => window.lucide && window.lucide.createIcons(), 900);
  };
  if (document.readyState === "complete") mount();
  else window.addEventListener("load", mount);
})();
