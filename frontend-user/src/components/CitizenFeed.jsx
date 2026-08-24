import { useState, useCallback, useRef } from 'react';
import UserLiveMap from './UserLiveMap';
import { translations } from '../translations';
import { formatSosSmsPayload, triggerSmsApp, EMERGENCY_NUMBERS } from '../offlineSms';

const DISASTER_TYPES = [
  'Trapped on Roof (Flooding)',
  'Severe Flood Surge',
  'Structural Damage / Collapse',
  'Landslide / Rockfall',
  'Medical Emergency / Oxygen Needed',
  'Fire / Hazardous Gas Leak',
  'Other Disaster Situation',
];

function getGpsCoords() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 7000, maximumAge: 30000 }
    );
  });
}

export default function CitizenFeed({ onSubmit, reports = [], userId, lang = 'en' }) {
  const t = translations[lang] || translations.en;
  const fileInputRef = useRef(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [people, setPeople] = useState(4);
  const [type, setType] = useState('Trapped on Roof (Flooding)');
  const [otherDetails, setOtherDetails] = useState('');
  const [medical, setMedical] = useState(true);
  const [medicalDetails, setMedicalDetails] = useState('Elderly patient needing oxygen.');
  const [notes, setNotes] = useState('Water reached 1st floor, 4 family members on roof.');
  const [photoData, setPhotoData] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [smsModalData, setSmsModalData] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'fetching' | 'ok' | 'denied'
  const [lockedCoords, setLockedCoords] = useState(null);

  // Direct Offline SMS Dispatch
  const handleTransmitViaSms = async (targetNumber = EMERGENCY_NUMBERS.nationalEmergency) => {
    let gps = lockedCoords;
    if (!gps) {
      try {
        gps = await getGpsCoords();
      } catch {
        gps = null;
      }
    }

    const payload = {
      name: name.trim() || 'Anonymous Citizen',
      phone: phone.trim() || 'Not Provided',
      location: location.trim() || 'Disaster Sector',
      people: Number(people) || 1,
      emergency_type: type,
      other_details: type === 'Other Disaster Situation' ? otherDetails.trim() : '',
      medical,
      medical_details: medical ? medicalDetails.trim() : '',
      notes: notes.trim(),
      ...(gps ? { lat: gps.lat, lng: gps.lng } : {}),
    };

    const smsText = formatSosSmsPayload(payload);
    triggerSmsApp(targetNumber, smsText);
    setSmsModalData({ number: targetNumber, text: smsText });
  };

  // Auto-lock GPS handler
  const handleAutoLockGps = async () => {
    setGpsStatus('fetching');
    try {
      const coords = await getGpsCoords();
      if (coords) {
        setLockedCoords(coords);
        setGpsStatus('ok');
      } else {
        setGpsStatus('denied');
      }
    } catch {
      setGpsStatus('denied');
    }
  };

  // Photo upload handler with base64 conversion
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoData(ev.target?.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoData('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !location.trim()) return;
    setSubmitting(true);

    let gps = lockedCoords;
    if (!gps) {
      try {
        gps = await getGpsCoords();
      } catch {
        gps = null;
      }
    }

    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        location: location.trim(),
        people: Number(people),
        emergency_type: type,
        other_details: type === 'Other Disaster Situation' ? otherDetails.trim() : '',
        medical,
        medical_details: medical ? medicalDetails.trim() : '',
        notes: notes.trim(),
        photo_data: photoData,
        is_isolated: false,
        ...(gps ? { lat: gps.lat, lng: gps.lng } : {}),
      };

      const res = await onSubmit(payload);
      setSuccess(res?.ticket_id || 'SOS-' + Math.floor(100 + Math.random() * 900));
      setName('');
      setPhone('');
      setLocation('');
      setPeople(1);
      setType('Trapped on Roof (Flooding)');
      setOtherDetails('');
      setMedical(false);
      setMedicalDetails('');
      setNotes('');
      setPhotoData('');
      setGpsStatus('idle');
      setLockedCoords(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }, [name, phone, location, people, type, otherDetails, medical, medicalDetails, notes, photoData, lockedCoords, onSubmit]);

  const statusInfo = (r) => {
    if (r.status === 'Resolved') return { label: t.statusResolved, cls: 'resolved' };
    if (r.status === 'Dispatched') return { label: t.statusDispatched, cls: 'dispatched' };
    return { label: t.statusPending, cls: 'pending' };
  };

  return (
    <div>
      <div className="sos-layout-grid">
        {/* ── Main SOS Form Card ── */}
        <div className="card sos-form-card">
          <div className="sos-form-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="sos-beacon-icon">((o))</span>
              <div className="card-title" style={{ margin: 0 }}>{t.formHeading}</div>
            </div>
            <span className="code-red-pill">{t.codeRedBadge}</span>
          </div>

          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 16px 0' }}>
            Dispatches directly to Central NDRF / SDRF Incident Command Room &amp; Local EOC.
          </p>

          {success && (
            <div className="alert-success" style={{ marginBottom: 16 }}>
              <div className="alert-success-text">
                <h4>✓ SOS Broadcasted to Incident Command</h4>
                <p>Tracking Ticket: <span className="ticket-ref">{success}</span> — NDRF &amp; CATS rescue units mobilized.</p>
              </div>
              <button className="btn-ghost" onClick={() => setSuccess(null)} aria-label="Dismiss">✕</button>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>{t.fullName}</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Rajesh Kumar"
                  required
                />
              </div>
              <div className="form-group">
                <label>{t.phone}</label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  required
                />
              </div>
            </div>

            {/* Disaster Type Selector */}
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>{t.disasterType} *</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                style={{ fontSize: 13.5, fontWeight: 600, color: '#1d3557' }}
              >
                {DISASTER_TYPES.map(tOption => (
                  <option key={tOption} value={tOption}>{tOption}</option>
                ))}
              </select>
            </div>

            {/* Other Disaster Situation Input */}
            {type === 'Other Disaster Situation' && (
              <div className="form-group" style={{ marginTop: 8 }}>
                <input
                  value={otherDetails}
                  onChange={e => setOtherDetails(e.target.value)}
                  placeholder={t.otherDisasterPlaceholder}
                  required
                  style={{ borderColor: '#d97706', background: '#fffbeb' }}
                />
              </div>
            )}

            {/* Location input with Auto-Lock GPS button */}
            <div className="form-group" style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label>{t.location}</label>
                <button
                  type="button"
                  onClick={handleAutoLockGps}
                  disabled={gpsStatus === 'fetching'}
                  className="btn-gps-lock"
                >
                  <span style={{ fontSize: 13 }}>📍</span>
                  <span>{gpsStatus === 'ok' ? `✓ ${t.gpsLocked}` : t.autoLockGps}</span>
                </button>
              </div>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Kashmere Gate ISBT Ring Road, Near Gate 2"
                required
              />
            </div>

            {/* Stranded Persons Counter Stepper */}
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>{t.strandedCount}</label>
              <div className="stepper-counter-box">
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => setPeople(p => Math.max(1, p - 1))}
                >
                  −
                </button>
                <span className="stepper-value">{people}</span>
                <span className="stepper-label">{t.persons}</span>
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => setPeople(p => p + 1)}
                >
                  +
                </button>
              </div>
            </div>

            {/* Critical Medical Checkbox & Description Box */}
            <div className="medical-card-toggle-box" style={{ marginTop: 14 }}>
              <label className="medical-toggle" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={medical}
                  onChange={e => setMedical(e.target.checked)}
                />
                <span style={{ fontWeight: 700, color: '#b91c1c' }}>{t.medicalCheck}</span>
              </label>

              {medical && (
                <div style={{ marginTop: 8 }}>
                  <textarea
                    rows={2}
                    value={medicalDetails}
                    onChange={e => setMedicalDetails(e.target.value)}
                    placeholder={t.medicalDetailsPlaceholder}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #fca5a5',
                      background: '#fff',
                      fontSize: 12.5,
                      fontFamily: 'inherit',
                      resize: 'none',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Situation details and notes */}
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>{t.situationNotes}</label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={t.situationNotesPlaceholder}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  fontSize: 12.5,
                  fontFamily: 'inherit',
                  resize: 'none',
                }}
              />
            </div>

            {/* Situation Photo Upload */}
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>{t.attachPhoto}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="btn-upload-photo"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span>📷</span>
                  <span>{t.takePhoto}</span>
                </button>

                {photoData && (
                  <div className="photo-preview-chip">
                    <img src={photoData} alt="Situation thumbnail" className="photo-thumb" />
                    <button
                      type="button"
                      className="photo-remove-btn"
                      onClick={handleRemovePhoto}
                      title={t.removePhoto}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons: Online SOS + Offline SMS Direct */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
              <button
                type="submit"
                className="btn-primary btn-submit-sos"
                disabled={submitting}
              >
                {submitting ? t.submitting : t.submitBtn}
              </button>

              <button
                type="button"
                className="btn-offline-sms"
                onClick={() => handleTransmitViaSms(EMERGENCY_NUMBERS.nationalEmergency)}
              >
                <span>{t.transmitViaSms}</span>
              </button>
            </div>
          </form>
        </div>

        {/* ── Sidebar: Protocols & Direct Helplines ── */}
        <div className="sos-sidebar">
          {/* Safety Protocol Checklist */}
          <div className="sidebar-card protocol-card">
            <div className="sidebar-card-title">⚠️ {t.safetyTitle}</div>
            <ul className="protocol-list">
              <li>
                <span className="dot-warn">•</span>
                <span>{t.safety1}</span>
              </li>
              <li>
                <span className="dot-warn">•</span>
                <span>{t.safety2}</span>
              </li>
              <li>
                <span className="dot-warn">•</span>
                <span>{t.safety3}</span>
              </li>
              <li>
                <span className="dot-warn">•</span>
                <span>{t.safety4}</span>
              </li>
            </ul>
          </div>

          {/* Direct Contact Helplines */}
          <div className="sidebar-card helplines-card">
            <div className="sidebar-card-title">📞 {t.directHelplines}</div>
            <div className="helpline-directory-list">
              <div className="helpline-entry">
                <div>
                  <div className="hl-name">National Emergency Support</div>
                  <div className="hl-num">112</div>
                </div>
                <a href="tel:112" className="hl-call-btn">{t.callNow}</a>
              </div>

              <div className="helpline-entry">
                <div>
                  <div className="hl-name">NDMA Disaster Helpline</div>
                  <div className="hl-num">1078</div>
                </div>
                <a href="tel:1078" className="hl-call-btn">{t.callNow}</a>
              </div>

              <div className="helpline-entry">
                <div>
                  <div className="hl-name">Ambulance &amp; Mobile ICU</div>
                  <div className="hl-num">108 / 102</div>
                </div>
                <a href="tel:108" className="hl-call-btn">{t.callNow}</a>
              </div>

              <div className="helpline-entry">
                <div>
                  <div className="hl-name">NDRF National HQ Room</div>
                  <div className="hl-num">011-24363260</div>
                </div>
                <a href="tel:01124363260" className="hl-call-btn">{t.callNow}</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── My Requests Feed ── */}
      {reports.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="requests-head">
            <div className="card-title" style={{ marginBottom: 0 }}>📋 {t.myRequests}</div>
            <span className="session-tag">{t.session}: {userId?.slice(0, 14)}</span>
          </div>

          <div className="request-list">
            {reports.map((r) => {
              const s = statusInfo(r);
              const isDispatched = r.status === 'Dispatched';

              return (
                <div key={r.id} className={`request-card ${s.cls}`}>
                  <div className="request-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="request-card-id">{r.ticket_id || `SOS-${r.id}`}</span>
                      <span className="request-card-name">{r.name}</span>
                      {r.unit_name && (
                        <span className="assigned-unit-chip">
                          🚤 {r.unit_name}
                        </span>
                      )}
                    </div>
                    <span className={`status-badge ${s.cls}`}>{s.label}</span>
                  </div>

                  <div className="request-card-meta">
                    <div>Location: <strong>{r.location}</strong></div>
                    <div>Type: <strong>{r.emergency_type}</strong></div>
                    <div>Affected: <strong>{r.people} {r.people > 1 ? 'persons' : 'person'}</strong></div>
                    <div>Phone: <strong>{r.phone}</strong></div>
                  </div>

                  {r.other_details && (
                    <div style={{ fontSize: 12, background: '#fffbeb', padding: '6px 10px', borderRadius: 4, color: '#92400e', marginTop: 4 }}>
                      <strong>Detail:</strong> {r.other_details}
                    </div>
                  )}

                  {r.medical_details && (
                    <div style={{ fontSize: 12, background: '#fef2f2', padding: '6px 10px', borderRadius: 4, color: '#b91c1c', marginTop: 4 }}>
                      <strong>Medical Need:</strong> {r.medical_details}
                    </div>
                  )}

                  {r.photo_data && (
                    <div style={{ marginTop: 8 }}>
                      <img src={r.photo_data} alt="Situation photo" style={{ height: 70, borderRadius: 4, border: '1px solid #d1d5db' }} />
                    </div>
                  )}

                  {isDispatched && (
                    <div className="dispatch-alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <span>{t.dispatchedAlert}</span>
                      <span className="eta-badge-pill">
                        ⏱️ {t.etaBadge}: ~{r.eta_mins || 20} Mins
                      </span>
                    </div>
                  )}

                  {r.status === 'Resolved' && (
                    <div className="resolved-note">{t.resolvedNote}</div>
                  )}

                  {/* Live OpenStreetMap / Leaflet map */}
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
                        LIVE RESCUE UNIT TRACKING (ETA ~{r.eta_mins || 20} MINS)
                      </div>
                      <UserLiveMap
                        citizenLat={r.lat}
                        citizenLng={r.lng}
                        rescuerLat={r.rescuer_lat}
                        rescuerLng={r.rescuer_lng}
                        label={r.location}
                        height={220}
                      />
                    </div>
                  )}

                  <div className="timestamp-note">Transmitted {new Date(r.created_at).toLocaleTimeString()}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Offline SMS Transmission Info Modal ── */}
      {smsModalData && (
        <div className="modal-backdrop" onClick={() => setSmsModalData(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">📲</div>
            <div className="modal-title">Offline Emergency SMS Dispatched</div>
            <div className="modal-subtitle">{t.smsAppOpened}</div>

            <div className="modal-details">
              <div className="modal-detail-row">
                <span>Recipient Number:</span>
                <span style={{ fontWeight: 800, color: '#b91c1c' }}>{smsModalData.number} (National Emergency)</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 11.5, color: '#475569' }}>
                <strong>Formatted Payload:</strong>
                <div style={{
                  background: '#fff', border: '1px solid #cbd5e1', padding: '8px',
                  borderRadius: 4, marginTop: 4, fontFamily: 'var(--font-mono)',
                  fontSize: 11, wordBreak: 'break-all', maxHeight: 90, overflowY: 'auto'
                }}>
                  {smsModalData.text}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1, padding: '8px 12px', fontSize: 12.5 }}
                onClick={() => {
                  navigator.clipboard?.writeText(smsModalData.text);
                  alert('✓ Emergency SMS text copied to clipboard.');
                }}
              >
                📋 {t.smsCopyPayload}
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: 12.5 }}
                onClick={() => setSmsModalData(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
