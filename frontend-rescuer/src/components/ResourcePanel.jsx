import { useState } from 'react';

const LABELS = {
  earthmovers: 'JCB / Excavator',
  bailey_bridges: 'Bailey Bridge Unit',
  mountain_teams: 'Mountain SDRF Team',
  drone_recon: 'AI Recon Drone',
  air_drop_kits: 'Air-Drop Relief Kit',
  ambulances: '4x4 Mountain Ambulance',
};

export default function ResourcePanel({
  zone,
  resources = [],
  recommendation,
  onDispatch,
  onAddResource,
  onResetResources,
  error,
  dispatching,
}) {
  const [updatingKey, setUpdatingKey] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  if (!zone) {
    return <div className="empty-note">Select a zone to see mountain resource recommendations.</div>;
  }

  // Active target recommendation (default to standby recon if zone is low risk)
  const activeRec = recommendation && Object.values(recommendation).some((v) => v > 0)
    ? recommendation
    : { drone_recon: 1, mountain_teams: 1 };

  const parts = Object.entries(activeRec)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${v} ${LABELS[k] || k}${v > 1 ? 's' : ''}`);

  // Check if all needed units are available in inventory
  const missingItems = Object.entries(activeRec).filter(([k, v]) => {
    const avail = resources.find((r) => r.key === k)?.available ?? 0;
    return avail < v;
  });

  const canDispatch = missingItems.length === 0 && parts.length > 0;

  const handleAdd = async (key, count = 1) => {
    setUpdatingKey(key);
    setSuccessMsg('');
    try {
      if (onAddResource) await onAddResource(key, count);
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleReset = async () => {
    setUpdatingKey('reset');
    setSuccessMsg('');
    try {
      if (onResetResources) await onResetResources();
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleTriggerDispatch = async () => {
    setSuccessMsg('');
    try {
      if (onDispatch) {
        await onDispatch(activeRec);
        setSuccessMsg(`✓ Units successfully dispatched to Sector ${zone.id} (${zone.name})`);
        setTimeout(() => setSuccessMsg(''), 5000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestockAndDispatch = async () => {
    setUpdatingKey('restock_dispatch');
    setSuccessMsg('');
    try {
      if (onResetResources) await onResetResources();
      if (onDispatch) {
        await onDispatch(activeRec);
        setSuccessMsg(`✓ Restocked & dispatched units successfully to Sector ${zone.id}`);
        setTimeout(() => setSuccessMsg(''), 5000);
      }
    } finally {
      setUpdatingKey(null);
    }
  };

  return (
    <>
      <div className="res-header">
        <span className="eyebrow">Mountain Disaster Inventory</span>
        <button className="restock-btn" onClick={handleReset} disabled={updatingKey === 'reset'}>
          {updatingKey === 'reset' ? 'Restocking…' : '↻ Restock all units'}
        </button>
      </div>

      <div className="res-list">
        {resources.map((r) => {
          const pct = r.total > 0 ? Math.round((r.available / r.total) * 100) : 0;
          const isUpdating = updatingKey === r.key;
          const incrementStep = r.key === 'air_drop_kits' ? 5 : 2;

          return (
            <div className="res-item" key={r.key}>
              <div className="ic">{r.icon}</div>
              <div className="body">
                <div className="row-top">
                  <span className="name">{r.name}</span>
                  <span className="count">
                    <b style={{ color: r.available === 0 ? 'var(--critical)' : 'var(--text)' }}>
                      {r.available}
                    </b>
                    /{r.total} available
                  </span>
                </div>
                <div className="bar">
                  <i style={{
                    width: `${pct}%`,
                    background: pct < 25 ? 'var(--critical)' : pct < 50 ? 'var(--high)' : 'var(--accent)',
                  }} />
                </div>
              </div>
              <button
                className="add-btn"
                disabled={isUpdating}
                onClick={() => handleAdd(r.key, incrementStep)}
                title={`Add +${incrementStep} ${r.name}`}
              >
                {isUpdating ? '…' : `+${incrementStep}`}
              </button>
            </div>
          );
        })}
      </div>

      <div className="rec-box" style={{ marginTop: 14 }}>
        AI Predictive Dispatch for <b>Zone {zone.id} ({zone.name})</b> [{zone.early_warning || zone.priority}]:{' '}
        <b>{parts.join(', ')}</b>.
      </div>

      {canDispatch ? (
        <button
          className="dispatch-btn"
          disabled={dispatching || updatingKey !== null}
          onClick={handleTriggerDispatch}
        >
          {dispatching ? 'Dispatching Units…' : '🚀 Authorize & Dispatch Recommended Units'}
        </button>
      ) : (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            className="dispatch-btn"
            style={{ background: 'var(--high)', color: '#fff' }}
            disabled={dispatching || updatingKey !== null}
            onClick={handleRestockAndDispatch}
          >
            {updatingKey === 'restock_dispatch'
              ? 'Restocking & Deploying…'
              : '⚡ Restock Reserves & Dispatch Immediately'}
          </button>
          <div className="warn-msg" style={{ margin: 0 }}>
            {missingItems.map(([k, v]) => {
              const r = resources.find((res) => res.key === k);
              return `${r?.name || k}: need ${v}, have ${r?.available ?? 0}`;
            }).join(' | ')}
          </div>
        </div>
      )}

      {successMsg && (
        <div style={{
          marginTop: 10, padding: '8px 12px', background: 'var(--safe-soft)',
          border: '1px solid rgba(22,101,52,0.3)', borderRadius: 4,
          color: 'var(--safe)', fontSize: 12.5, fontWeight: 600, textAlign: 'center',
        }}>
          {successMsg}
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}
    </>
  );
}
