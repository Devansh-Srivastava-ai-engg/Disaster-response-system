import { useState } from 'react';
import LiveMap from './LiveMap';
import DispatchModal from './DispatchModal';

export default function CitizenFeed({ reports, onStatusUpdate, lang = 'en' }) {
  const [updatingId, setUpdatingId] = useState(null);
  const [expandedMapId, setExpandedMapId] = useState(null);
  const [modalReport, setModalReport] = useState(null);

  const handleAction = async (id, status, extra = {}) => {
    setUpdatingId(id);
    try {
      if (onStatusUpdate) {
        await onStatusUpdate(id, status, extra);
      }
    } finally {
      setUpdatingId(null);
      setModalReport(null);
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
        <div className="empty-note">No active citizen emergency reports pending in the command queue.</div>
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
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--accent)', fontWeight: 700 }}>
                  {r.ticket_id || `SOS-${r.id}`}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{r.name || 'Citizen'}</span>
                {r.unit_name && (
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                    background: '#e0f2fe', color: '#0369a1',
                  }}>
                    🚤 {r.unit_name}
                  </span>
                )}
              </div>
              <span className={`sentinel-status-badge ${isPending ? 'pending' : isDispatched ? 'dispatched' : 'resolved'}`}>
                {r.status ? r.status.toUpperCase() : 'PENDING'}
              </span>
            </div>

            {/* Detail grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12.5, color: 'var(--text-dim)', marginTop: 4 }}>
              <div>
                Contact:{' '}
                {r.phone && r.phone !== 'Not Provided' ? (
                  <a href={`tel:${r.phone}`} style={{ fontWeight: 700, color: 'var(--accent)' }}>{r.phone}</a>
                ) : (
                  <span>Not provided</span>
                )}
              </div>
              <div>Location: <strong style={{ color: 'var(--text)' }}>{r.location}</strong></div>
              <div>Affected: <strong style={{ color: 'var(--text)' }}>{r.people} {r.people > 1 ? 'persons' : 'person'}</strong></div>
              <div>Hazard: <strong style={{ color: 'var(--text)' }}>{r.emergency_type}</strong></div>
            </div>

            {/* Other disaster custom details */}
            {r.other_details && (
              <div style={{ fontSize: 12, background: '#fffbeb', padding: '6px 10px', borderRadius: 4, color: '#92400e', marginTop: 6 }}>
                <strong>Custom Situation:</strong> {r.other_details}
              </div>
            )}

            {/* Alert flags & Medical */}
            {(r.medical || r.medical_details || (r.vulnerable && r.vulnerable !== 'None')) && (
              <div style={{ background: 'var(--critical-soft)', border: '1px solid rgba(185,28,28,0.25)', padding: '8px 12px', borderRadius: 4, fontSize: 12, marginTop: 6 }}>
                {r.medical && (
                  <div style={{ color: 'var(--critical)', fontWeight: 700 }}>
                    Critical — Immediate Medical / Oxygen / Ambulance required
                  </div>
                )}
                {r.medical_details && (
                  <div style={{ color: '#7f1d1d', marginTop: 2, fontSize: 11.5 }}>
                    <strong>Details:</strong> {r.medical_details}
                  </div>
                )}
                {r.vulnerable && r.vulnerable !== 'None' && (
                  <div style={{ color: 'var(--high)', marginTop: 4, fontWeight: 500 }}>
                    Vulnerable persons present: <strong>{r.vulnerable}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Access notes */}
            {r.notes && (
              <div style={{ fontSize: 12, background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-soft)', color: 'var(--text-dim)', marginTop: 6 }}>
                <strong style={{ color: 'var(--text)' }}>Landmark notes: </strong>
                <span>{r.notes}</span>
              </div>
            )}

            {/* Attached Photo */}
            {r.photo_data && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>
                  📷 Citizen Uploaded Situation Photo:
                </div>
                <img
                  src={r.photo_data}
                  alt="Citizen Upload"
                  style={{ maxHeight: 90, borderRadius: 4, border: '1px solid var(--border)' }}
                />
              </div>
            )}

            {/* Track Rescuer — expandable live map */}
            {(isDispatched || isResolved) && (
              <div style={{ marginTop: 8 }}>
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
                    🗺️ {isResolved ? 'View Operation Map' : `Track ${r.unit_name || 'Rescue Unit'} Live`}
                    {hasMap && !isResolved && (
                      <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--safe)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                        LIVE (ETA ~{r.eta_mins || 20}m)
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
                  </div>
                )}
              </div>
            )}

            {/* Action row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border-soft)', marginTop: 8 }}>
              <div className="time" style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                Received: {new Date(r.created_at).toLocaleTimeString()}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {r.phone && r.phone !== 'Not Provided' && (
                  <a
                    href={`sms:${r.phone.replace(/[^\d+]/g, '')}?body=${encodeURIComponent(
                      `[NDRF RESCUE CMD] Update on Ticket ${r.ticket_id || 'SOS-' + r.id}: ${r.unit_name || 'Rescue Unit'} is dispatched. ETA ~${r.eta_mins || 20}m. Stay in safe elevated structure.`
                    )}`}
                    style={{
                      textDecoration: 'none',
                      background: '#d97706',
                      color: '#fff',
                      fontSize: 11.5,
                      fontWeight: 700,
                      padding: '7px 12px',
                      borderRadius: 4,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    title="Send SMS update directly to citizen phone"
                  >
                    <span>📲 SMS Citizen</span>
                  </a>
                )}

                {isPending && (
                  <button
                    className="dispatch-btn"
                    style={{ width: 'auto', marginTop: 0, padding: '7px 16px', fontSize: 12 }}
                    disabled={isUpdating}
                    onClick={() => setModalReport(r)}
                  >
                    {isUpdating ? 'Dispatching…' : '🚀 Authorise & Select Response Unit'}
                  </button>
                )}
                {isDispatched && (
                  <button
                    className="dispatch-btn"
                    style={{ width: 'auto', marginTop: 0, padding: '7px 16px', fontSize: 12, background: 'var(--safe)' }}
                    disabled={isUpdating}
                    onClick={() => handleAction(r.id, 'Resolved')}
                  >
                    {isUpdating ? 'Updating…' : '✓ Mark Evacuated / Resolved'}
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

      {/* Unit Dispatch Modal */}
      {modalReport && (
        <DispatchModal
          report={modalReport}
          lang={lang}
          onClose={() => setModalReport(null)}
          onConfirm={(id, extra) => handleAction(id, 'Dispatched', extra)}
        />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
