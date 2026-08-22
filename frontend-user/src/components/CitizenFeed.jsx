import { useState, useCallback } from 'react';
import UserLiveMap from './UserLiveMap';

const TYPES = [
  'Landslide / Rockfall',
  'Flash Flood / River Breach',
  'Slope Failure / Sinking Ground',
  'Road Blockage / Isolated Village',
  'Mudslide / Debris Flow',
  'Cloudburst / Building Collapse',
];

function getGpsCoords() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 6000, maximumAge: 30000 }
    );
  });
}

export default function CitizenFeed({ onSubmit, reports = [], userId }) {
  const [name,       setName]       = useState('');
  const [phone,      setPhone]      = useState('');
  const [location,   setLocation]   = useState('');
  const [people,     setPeople]     = useState(1);
  const [type,       setType]       = useState('Landslide / Rockfall');
  const [vulnerable, setVulnerable] = useState('');
  const [notes,      setNotes]      = useState('');
  const [medical,    setMedical]    = useState(false);
  const [isIsolated, setIsIsolated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success,    setSuccess]    = useState(null);
  const [gpsStatus,  setGpsStatus]  = useState('idle');

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !location.trim()) return;
    setSubmitting(true);
    setGpsStatus('fetching');

    let gps = null;
    try {
      gps = await getGpsCoords();
      setGpsStatus(gps ? 'ok' : 'denied');
    } catch {
      setGpsStatus('denied');
    }

    try {
      const payload = {
        name: name.trim(), phone: phone.trim(), location: location.trim(),
        people: Number(people), emergency_type: type,
        vulnerable: vulnerable.trim() || 'None', notes: notes.trim(),
        medical, is_isolated: isIsolated,
        ...(gps ? { lat: gps.lat, lng: gps.lng } : {}),
      };
      const res = await onSubmit(payload);
      setSuccess(res?.ticket_id || 'NER-' + Math.floor(1000 + Math.random() * 9000));
      setName(''); setPhone(''); setLocation(''); setPeople(1);
      setType('Landslide / Rockfall'); setVulnerable(''); setNotes('');
      setMedical(false); setIsIsolated(false);
      setGpsStatus('idle');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }, [name, phone, location, people, type, vulnerable, notes, medical, isIsolated, onSubmit]);

  const statusInfo = (r) => {
    if (r.status === 'Resolved')   return { label: 'Resolved / Cleared', cls: 'resolved' };
    if (r.status === 'Dispatched') return { label: 'Mountain Unit Dispatched', cls: 'dispatched' };
    return { label: 'Pending Assessment', cls: 'pending' };
  };

  return (
    <div>
      {/* ── Active Regional Early Warning Advisory ── */}
      <div style={{
        background: '#fff', border: '1px solid #d1d5db',
        borderLeft: '4px solid #b91c1c', borderRadius: 6,
        padding: '12px 16px', marginBottom: 16, fontSize: 13,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <strong style={{ color: '#b91c1c' }}>IMD / NDMA North Eastern Region Monsoon Advisory</strong>
        </div>
        <p style={{ color: '#4b5563', margin: 0, fontSize: 12, lineHeight: 1.5 }}>
          Heavy precipitation &amp; high soil saturation active across Dima Hasao, East Khasi Hills, Teesta Valley, and Tawang corridors.
          Avoid travelling near vulnerable mountain cuts or active rockfall zones. In case of cutoff, submit your SOS below.
        </p>
      </div>

      {/* ── Report Form ── */}
      <div className="card">
        <div className="card-title">Report a Mountain Emergency / Landslide</div>

        {success && (
          <div className="alert-success">
            <div className="alert-success-text">
              <h4>SOS Broadcasted to NER-Sentinel EOC</h4>
              <p>Tracking Ticket: <span className="ticket-ref">{success}</span> — SDRF &amp; JCB clearing units alerted.</p>
            </div>
            <button className="btn-ghost" onClick={() => setSuccess(null)} aria-label="Dismiss">✕</button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="section-label"><span className="num">01</span> Contact Details</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Full name / Village Head *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Tenzing Norbu" required />
            </div>
            <div className="form-group">
              <label>Contact number / Satellite phone *</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="e.g. +91 94350 12345" required />
            </div>
          </div>

          <div className="section-label"><span className="num">02</span> Terrain &amp; Incident Location</div>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Village / Mountain Pass / Highway Landmark *</label>
              <input value={location} onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Sector A, Haflong-Silchar Hill Cut, KM 42" required />
            </div>
            <div className="form-group">
              <label>Hazard / Disaster Type</label>
              <select value={type} onChange={e => setType(e.target.value)}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Number of stranded / affected persons</label>
              <input type="number" min="1" value={people}
                onChange={e => setPeople(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Vulnerable individuals (elderly, infants)</label>
              <input value={vulnerable} onChange={e => setVulnerable(e.target.value)}
                placeholder="e.g. 2 elderly, 1 injured" />
            </div>
            <div className="form-group">
              <label>Slope condition / Debris notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="e.g. 50m road washed away, mudslide ongoing" />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
            <label className="medical-toggle" style={{ margin: 0 }}>
              <input type="checkbox" checked={medical} onChange={e => setMedical(e.target.checked)} />
              Requires 4x4 Mountain Ambulance &amp; urgent medical evacuation
            </label>

            <label className="medical-toggle" style={{ margin: 0, borderColor: isIsolated ? '#b91c1c' : '#d1d5db' }}>
              <input type="checkbox" checked={isIsolated} onChange={e => setIsIsolated(e.target.checked)} />
              🏔️ <strong>Remote Cutoff Hamlet:</strong> Road access completely severed (Air-Drop rations &amp; JCBs needed)
            </label>
          </div>

          {/* GPS status indicator */}
          {gpsStatus === 'fetching' && (
            <div style={{ fontSize: 12, color: '#4b5563', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📡</span>
              Locating mountain coordinates for rescue unit guidance…
            </div>
          )}
          {gpsStatus === 'ok' && (
            <div style={{ fontSize: 12, color: '#166534', marginTop: 8 }}>
              ✓ Mountain GPS captured — Live SDRF rescue tracking enabled.
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Submitting SOS to EOC…' : 'Transmit Emergency SOS to NER Command'}
          </button>
        </form>
      </div>

      {/* ── My Requests ── */}
      {reports.length > 0 && (
        <div className="card">
          <div className="requests-head">
            <div className="card-title" style={{ marginBottom: 0 }}>My Active Mountain SOS Requests</div>
            <span className="session-tag">Session: {userId?.slice(0, 14)}</span>
          </div>
          <div className="request-list">
            {reports.map(r => {
              const s = statusInfo(r);
              const isDispatched = r.status === 'Dispatched';

              return (
                <div key={r.id} className={`request-card ${s.cls}`}>
                  <div className="request-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="request-card-id">{r.ticket_id || `NER-${r.id}`}</span>
                      <span className="request-card-name">{r.name}</span>
                      {r.is_isolated === 1 && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#fee2e2', color: '#b91c1c' }}>
                          🏔️ CUTOFF HAMLET
                        </span>
                      )}
                    </div>
                    <span className={`status-badge ${s.cls}`}>{s.label}</span>
                  </div>

                  <div className="request-card-meta">
                    <div>Location: <strong>{r.location}</strong></div>
                    <div>Hazard: <strong>{r.emergency_type}</strong></div>
                    <div>Affected: <strong>{r.people} {r.people > 1 ? 'people' : 'person'}</strong></div>
                    <div>Phone: <strong>{r.phone}</strong></div>
                  </div>

                  {r.vulnerable && r.vulnerable !== 'None' && (
                    <div className="vulnerable-note">Vulnerable: {r.vulnerable}</div>
                  )}

                  {isDispatched && (
                    <div className="dispatch-alert">
                      SDRF / Mountain Clearing Team deployed from HQ — en route to your sector
                    </div>
                  )}
                  {r.status === 'Resolved' && (
                    <div className="resolved-note">Mountain lifeline restored &amp; rescue completed</div>
                  )}

                  {/* Live OpenStreetMap / Leaflet tracking */}
                  {isDispatched && (
                    <div>
                      <div style={{
                        fontSize: 11.5, fontWeight: 700, color: '#1d3557',
                        marginTop: 10, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', background: '#166534',
                          display: 'inline-block', animation: 'pulse-dot 1.5s infinite',
                        }} />
                        LIVE SDRF / MOUNTAIN UNIT TRACKING
                      </div>
                      <UserLiveMap
                        citizenLat={r.lat}
                        citizenLng={r.lng}
                        rescuerLat={r.rescuer_lat}
                        rescuerLng={r.rescuer_lng}
                        label={r.location}
                        height={230}
                      />
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, textAlign: 'center' }}>
                        🔵 Rescue Team &nbsp;|&nbsp; 🔴 Your Location &nbsp;—&nbsp; Real-time GPS sync
                      </div>
                    </div>
                  )}

                  <div className="timestamp-note">Transmitted {new Date(r.created_at).toLocaleTimeString()}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
