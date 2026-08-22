import { useState } from 'react';
import { translations } from '../translations';

const RESPONSE_UNITS = [
  'NDRF 8th Battalion - Zodiac Boat 04 (Flood Rescue)',
  'SDRF Quick Response Squad 02 (Evacuation)',
  'CATS Mobile ICU Ambulance 108 (Paramedic Team)',
  'Indian Air Force ALH Dhruv (Airlift Extraction)',
  'Fire Service Hydraulic Snorkel 05 (High Rise)',
  'Heavy Excavator & Earthmover Unit 01 (Debris Clearing)',
];

export default function DispatchModal({ report, onConfirm, onClose, lang = 'en' }) {
  const t = translations[lang] || translations.en;
  const [selectedUnit, setSelectedUnit] = useState(
    report?.medical
      ? 'CATS Mobile ICU Ambulance 108 (Paramedic Team)'
      : 'NDRF 8th Battalion - Zodiac Boat 04 (Flood Rescue)'
  );
  const [eta, setEta] = useState(20);
  const [dispatching, setDispatching] = useState(false);

  if (!report) return null;

  const handleConfirm = async () => {
    setDispatching(true);
    try {
      if (onConfirm) {
        await onConfirm(report.id, {
          unit_name: selectedUnit,
          eta_mins: Number(eta) || 20,
        });
      }
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box dispatch-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🚙</span>
            <div style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--navy)' }}>
              {t.dispatchModalTitle}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}
          >
            ✕
          </button>
        </div>

        {/* Ticket Summary Box */}
        <div className="dispatch-summary-box">
          <div className="dispatch-row">
            <span className="lbl">{t.sosTicket}:</span>
            <b style={{ color: '#b91c1c', fontFamily: 'var(--font-mono)' }}>
              {report.ticket_id || `SOS-${report.id}`}
            </b>
          </div>
          <div className="dispatch-row">
            <span className="lbl">{t.citizen}:</span>
            <b>{report.name} ({report.phone})</b>
          </div>
          <div className="dispatch-row">
            <span className="lbl">{t.location}:</span>
            <b>{report.location}</b>
          </div>
          <div className="dispatch-row">
            <span className="lbl">{t.trapped}:</span>
            <b style={{ color: '#b91c1c' }}>
              {report.people} Persons ({report.emergency_type})
            </b>
          </div>
          {report.medical_details && (
            <div className="dispatch-row">
              <span className="lbl">Medical:</span>
              <span style={{ color: '#b91c1c', fontWeight: 600 }}>{report.medical_details}</span>
            </div>
          )}
        </div>

        {/* Unit Selector */}
        <div style={{ marginTop: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 6 }}>
            {t.selectUnit}
          </label>
          <select
            value={selectedUnit}
            onChange={e => setSelectedUnit(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: '1px solid #0284c7',
              background: '#f0f9ff',
              fontSize: 13,
              fontWeight: 600,
              color: '#0369a1',
            }}
          >
            {RESPONSE_UNITS.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        {/* ETA input */}
        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 6 }}>
            Estimated Response &amp; Arrival Time (ETA Minutes)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number"
              min="5"
              max="180"
              value={eta}
              onChange={e => setEta(e.target.value)}
              style={{
                width: 90,
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                fontWeight: 700,
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              Minutes to target ground coordinates
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 16px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: '#f8fafc',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {t.cancel}
          </button>

          <button
            type="button"
            disabled={dispatching}
            onClick={handleConfirm}
            style={{
              padding: '9px 18px',
              borderRadius: 6,
              border: 'none',
              background: '#0284c7',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {dispatching ? 'Mobilizing Unit…' : t.confirmDispatch}
          </button>
        </div>
      </div>
    </div>
  );
}
