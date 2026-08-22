import { useState } from 'react';
import LiveMap from './LiveMap';

export default function CitizenFeed({ reports, onStatusUpdate }) {
  const [updatingId, setUpdatingId] = useState(null);
  const [expandedMapId, setExpandedMapId] = useState(null);

  const handleAction = async (id, status) => {
    setUpdatingId(id);
    try {
      if (onStatusUpdate) {
        await onStatusUpdate(id, status);
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const borderColor = (r) => {
    if (r.medical) return 'var(--critical)';
    if (r.is_isolated) return 'var(--critical)';
    if (r.status === 'Dispatched') return 'var(--accent)';
    if (r.status === 'Resolved') return 'var(--safe)';
    return 'var(--high)';
  };

  return (
    <div id="feed">
      {reports.length === 0 && (
        <div className="empty-note">No active citizen emergency reports pending in the NER corridor.</div>
      )}
      {reports.map((r) => {
        const isPending    = r.status === 'Pending';
        const isDispatched = r.status === 'Dispatched';
        const isResolved   = r.status === 'Resolved';
        const isUpdating   = updatingId === r.id;
        const mapOpen      = expandedMapId === r.id;
        const hasMap       = (isDispatched || isResolved) && r.rescuer_lat != null;

        return (
          <div
            className="feed-item"
            key={r.id}
            style={{ borderLeftColor: borderColor(r) }}
          >
            {/* Top row: ticket + name + status badge */}
            <div className="top">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                  {r.ticket_id || `NER-${r.id}`}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{r.name || 'Citizen'}</span>
                {r.is_isolated === 1 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                    background: 'var(--critical-soft)', color: 'var(--critical)', border: '1px solid rgba(185,28,28,0.3)'
                  }}>
                    🏔️ CUTOFF VILLAGE
                  </span>
                )}
              </div>
              <span className={`sentinel-status-badge ${isPending ? 'pending' : isDispatched ? 'dispatched' : 'resolved'}`}>
                {r.status ? r.status.toUpperCase() : 'PENDING'}
              </span>
            </div>

            {/* Detail grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12.5, color: 'var(--text-dim)' }}>
              <div>
                Contact:{' '}
                {r.phone && r.phone !== 'Not Provided' ? (
                  <a href={`tel:${r.phone}`} style={{ fontWeight: 600 }}>{r.phone}</a>
                ) : (
                  <span>Not provided</span>
                )}
              </div>
              <div>Location: <strong style={{ color: 'var(--text)' }}>{r.location}</strong></div>
              <div>Affected: <strong style={{ color: 'var(--text)' }}>{r.people} {r.people > 1 ? 'people' : 'person'}</strong></div>
              <div>Hazard: <strong style={{ color: 'var(--text)' }}>{r.emergency_type}</strong></div>
            </div>

            {/* Alert flags */}
            {(r.medical || (r.vulnerable && r.vulnerable !== 'None') || r.is_isolated) && (
              <div style={{ background: 'var(--critical-soft)', border: '1px solid rgba(185,28,28,0.25)', padding: '8px 12px', borderRadius: 4, fontSize: 12 }}>
                {r.is_isolated === 1 && (
                  <div style={{ color: 'var(--critical)', fontWeight: 700, marginBottom: r.medical ? 4 : 0 }}>
                    🏔️ Village access roads severed — Air-drop relief / JCB clearing required
                  </div>
                )}
                {r.medical && (
                  <div style={{ color: 'var(--critical)', fontWeight: 700 }}>
                    Critical — 4x4 Mountain Ambulance &amp; immediate medical personnel needed
                  </div>
                )}
                {r.vulnerable && r.vulnerable !== 'None' && (
                  <div style={{ color: 'var(--high)', marginTop: (r.medical || r.is_isolated) ? 4 : 0, fontWeight: 500 }}>
                    Vulnerable persons present: <strong>{r.vulnerable}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Access notes */}
            {r.notes && (
              <div style={{ fontSize: 12, background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 4, border: '1px solid var(--border-soft)', color: 'var(--text-dim)' }}>
                <strong style={{ color: 'var(--text)' }}>Ground situation: </strong>
                <span style={{ fontStyle: 'italic' }}>{r.notes}</span>
              </div>
            )}

            {/* Track Rescuer — expandable live map */}
            {(isDispatched || isResolved) && (
              <div>
                <button
                  onClick={() => setExpandedMapId(mapOpen ? null : r.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    background: mapOpen ? 'var(--accent-soft)' : 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderColor: mapOpen ? 'rgba(29,53,87,0.3)' : 'var(--border)',
                    color: mapOpen ? 'var(--accent)' : 'var(--text-dim)',
                    padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%',
                    justifyContent: 'space-between', transition: 'all 0.15s',
                  }}
                >
                  <span>
                    🗺️ {isResolved ? 'View Mountain Operation Map' : 'Track SDRF / Mountain Unit Live'}
                    {hasMap && !isResolved && (
                      <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--safe)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                        LIVE
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 10 }}>{mapOpen ? '▲ Hide' : '▼ Show'}</span>
                </button>

                {mapOpen && (
                  <div style={{ marginTop: 8 }}>
                    <LiveMap
                      citizenLat={r.lat}
                      citizenLng={r.lng}
                      rescuerLat={r.rescuer_lat}
                      rescuerLng={r.rescuer_lng}
                      label={r.location}
                      height={240}
                    />
                    {r.lat == null && (
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6, textAlign: 'center' }}>
                        Sector fallback coordinates active.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Action row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border-soft)' }}>
              <div className="time" style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                Received: {new Date(r.created_at).toLocaleTimeString()}
              </div>

              <div>
                {isPending && (
                  <button
                    className="dispatch-btn"
                    style={{ width: 'auto', marginTop: 0, padding: '7px 16px', fontSize: 12 }}
                    disabled={isUpdating}
                    onClick={() => handleAction(r.id, 'Dispatched')}
                  >
                    {isUpdating ? 'Dispatching…' : 'Authorise & Deploy Mountain Units'}
                  </button>
                )}
                {isDispatched && (
                  <button
                    className="dispatch-btn"
                    style={{ width: 'auto', marginTop: 0, padding: '7px 16px', fontSize: 12, background: 'var(--safe)' }}
                    disabled={isUpdating}
                    onClick={() => handleAction(r.id, 'Resolved')}
                  >
                    {isUpdating ? 'Updating…' : 'Mark Route Cleared / Rescued'}
                  </button>
                )}
                {isResolved && (
                  <span style={{ fontSize: 12, color: 'var(--safe)', fontWeight: 700 }}>✓ Operation Complete</span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
