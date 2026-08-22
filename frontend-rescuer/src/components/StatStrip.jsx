export default function StatStrip({ summary }) {
  if (!summary) return null;
  const res = summary.resources || [];
  const stats = [
    { label: 'Red Alert (Imminent)', value: summary.critical ?? 0,  cls: 'critical' },
    { label: 'Orange Alert (High)',  value: summary.high ?? 0,      cls: 'high' },
    { label: 'Isolated Villages',    value: summary.totalIsolatedVillages ?? 0, cls: 'critical' },
    { label: 'JCBs / Excavators',    value: res.find(r => r.key === 'earthmovers')?.available ?? 0, cls: 'info' },
    { label: 'Bailey Bridges',       value: res.find(r => r.key === 'bailey_bridges')?.available ?? 0, cls: 'info' },
    { label: 'Mountain SDRF',        value: res.find(r => r.key === 'mountain_teams')?.available ?? 0, cls: 'safe' },
    { label: 'Air-Drop Kits',        value: res.find(r => r.key === 'air_drop_kits')?.available ?? 0, cls: 'info' },
  ];
  return (
    <div className="stat-strip">
      {stats.map(s => (
        <div key={s.label} className={`stat-card ${s.cls}`}>
          <div className="value">{s.value}</div>
          <div className="label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
