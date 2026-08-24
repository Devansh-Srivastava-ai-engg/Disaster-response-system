import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { translations } from '../translations';

const SECTOR_FILTERS = [
  { id: 'all', label: 'All Sectors', icon: '🌐' },
  { id: 'A', label: 'Sector A', icon: '🏔️' },
  { id: 'B', label: 'Sector B', icon: '🌧️' },
  { id: 'C', label: 'Sector C', icon: '🌊' },
  { id: 'D', label: 'Sector D', icon: '⛰️' },
  { id: 'E', label: 'Sector E', icon: '🛣️' },
  { id: 'F', label: 'Sector F', icon: '🏘️' },
];

const AMENITY_ICONS = {
  'Clean Water': '💧', 'Clean Drinking Water': '💧', 'Filtered Water': '💧', 'Potable Water': '💧',
  'Water Tanker': '💧', '24x7 Water': '💧',
  'Hot Meals': '🍲', 'Hot Meals & Kitchen': '🍲', 'Dry Rations': '🍲', 'Community Kitchen': '🍲',
  'Military Ration Packs': '🍲', 'Hot Food': '🍲',
  'First Aid': '🏥', 'First Aid & Medical Doctor': '🏥', 'Medical Doctor': '🏥',
  'Paramedic Station': '🏥', 'Emergency Oxygen': '🏥', 'Oxygen Concentrators': '🏥',
  'Solar Power': '⚡', 'Power Backup': '⚡', 'Generator Power Backup': '⚡', 'Power Inverters': '⚡',
  'Blankets': '🛏️', 'Warm Blankets': '🛏️', 'Blankets & Bedding': '🛏️', 'Bedding Kits': '🛏️',
  'Infant Rations': '👶', 'Infant Care': '👶', 'Infant / Senior Care': '👶',
  'Mobile Charging': '🔋', 'Satellite Phone Terminal': '📡', 'Heated Hall': '🔥',
  'Sanitation Units': '🚻',
};

function getAmenityIcon(amenity) {
  const trimmed = amenity.trim();
  for (const [key, icon] of Object.entries(AMENITY_ICONS)) {
    if (trimmed.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return '✓';
}

export default function CitizenShelters({ lang = 'en' }) {
  const t = translations[lang] || translations.en;

  const [shelters, setShelters] = useState([]);
  const [activeSector, setActiveSector] = useState('all');
  const [isOfflineCached, setIsOfflineCached] = useState(false);

  const fetchShelters = useCallback(async () => {
    try {
      const data = await api.getShelters(activeSector);
      setShelters(data || []);
      setIsOfflineCached(false);

      // Cache for offline use
      try {
        localStorage.setItem('sentinel_shelters_cache', JSON.stringify(data || []));
        localStorage.setItem('sentinel_shelters_cache_ts', new Date().toISOString());
      } catch { /* quota exceeded safe */ }
    } catch (err) {
      console.warn('Shelter fetch failed, loading offline cache', err);
      try {
        const cached = JSON.parse(localStorage.getItem('sentinel_shelters_cache') || '[]');
        const filtered = activeSector === 'all'
          ? cached
          : cached.filter(s => s.sector_id === activeSector.toUpperCase());
        setShelters(filtered);
        setIsOfflineCached(true);
      } catch { /* no cache */ }
    }
  }, [activeSector]);

  useEffect(() => {
    fetchShelters();
    const interval = setInterval(fetchShelters, 8000);
    return () => clearInterval(interval);
  }, [fetchShelters]);

  const totalAvailable = shelters.reduce((sum, s) => sum + (s.capacity_available || 0), 0);
  const totalCapacity = shelters.reduce((sum, s) => sum + (s.capacity_total || 0), 0);
  const openCount = shelters.filter(s => s.status === 'Open' || s.status === 'Near Capacity').length;

  const getStatusConfig = (status) => {
    switch (status) {
      case 'Open': return { label: t.shelterStatusOpen, color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', dot: '🟢' };
      case 'Near Capacity': return { label: t.shelterStatusNearFull, color: '#d97706', bg: '#fffbeb', border: '#fde68a', dot: '🟡' };
      case 'Full': return { label: t.shelterStatusFull, color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dot: '🔴' };
      case 'Closed': return { label: t.shelterStatusClosed, color: '#6b7280', bg: '#f3f4f6', border: '#d1d5db', dot: '⚫' };
      default: return { label: status, color: '#475569', bg: '#f8fafc', border: '#e2e8f0', dot: '⚪' };
    }
  };

  return (
    <div id="shelters-section" className="citizen-shelters-card">
      {/* Header */}
      <div className="shelters-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22 }}>🏛️</span>
            <h3 className="shelters-main-title">{t.sheltersTitle}</h3>
            <span className="shelters-live-badge">
              <span className="live-dot" /> LIVE UPDATED
            </span>
          </div>
          <p className="shelters-subtitle">{t.sheltersSubtitle}</p>
        </div>

        <div className="shelters-summary-pills">
          <div className="shelter-summary-chip green">
            <div className="chip-val">{openCount}</div>
            <div className="chip-label">Open Camps</div>
          </div>
          <div className="shelter-summary-chip blue">
            <div className="chip-val">{totalAvailable}</div>
            <div className="chip-label">{t.vacantBeds}</div>
          </div>
          <div className="shelter-summary-chip navy">
            <div className="chip-val">{totalCapacity}</div>
            <div className="chip-label">{t.totalBeds}</div>
          </div>
        </div>
      </div>

      {/* Offline Cache Banner */}
      {isOfflineCached && (
        <div className="offline-cache-banner">
          {t.cachedOfflineNote}
          <span style={{ fontSize: 10.5, marginLeft: 8, color: '#6b7280' }}>
            Cached: {localStorage.getItem('sentinel_shelters_cache_ts')
              ? new Date(localStorage.getItem('sentinel_shelters_cache_ts')).toLocaleTimeString()
              : 'N/A'}
          </span>
        </div>
      )}

      {/* Sector Filter Tabs */}
      <div className="shelters-sector-tabs">
        {SECTOR_FILTERS.map((sec) => (
          <button
            key={sec.id}
            type="button"
            className={`shelter-sector-btn ${activeSector === sec.id ? 'active' : ''}`}
            onClick={() => setActiveSector(sec.id)}
          >
            <span>{sec.icon}</span>
            <span>{sec.label}</span>
          </button>
        ))}
      </div>

      {/* Shelters List */}
      {shelters.length === 0 ? (
        <div className="shelters-empty-state">
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏛️</div>
          <div style={{ fontWeight: 700, color: '#334155', fontSize: 14 }}>
            No relief shelters listed for this sector yet.
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            NDRF rescuers are establishing new camps. Check back shortly.
          </div>
        </div>
      ) : (
        <div className="shelters-grid">
          {shelters.map((s) => {
            const statusCfg = getStatusConfig(s.status);
            const occPct = s.capacity_total > 0
              ? Math.round(((s.capacity_total - s.capacity_available) / s.capacity_total) * 100)
              : 0;
            const amenitiesList = s.amenities ? s.amenities.split(',').map(a => a.trim()).filter(Boolean) : [];

            return (
              <div key={s.id} className="citizen-shelter-card">
                {/* Card Top: Status + Sector */}
                <div className="shelter-top-row">
                  <span className="shelter-sector-tag">Sector {s.sector_id}</span>
                  <span
                    className="shelter-status-badge"
                    style={{ color: statusCfg.color, backgroundColor: statusCfg.bg, borderColor: statusCfg.border }}
                  >
                    {statusCfg.dot} {statusCfg.label}
                  </span>
                </div>

                {/* Name & Location */}
                <div className="shelter-name">{s.name}</div>
                <div className="shelter-location">📍 {s.location}</div>

                {/* Capacity Progress Bar */}
                <div className="shelter-capacity-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span>
                      <strong style={{ color: '#166534', fontSize: 15 }}>{s.capacity_available}</strong>
                      <span style={{ color: '#64748b' }}> / {s.capacity_total} {t.vacantBeds}</span>
                    </span>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: '#64748b', fontSize: 12 }}>
                      {occPct}% Full
                    </span>
                  </div>
                  <div className="shelter-bar-track">
                    <div
                      className="shelter-bar-fill"
                      style={{
                        width: `${occPct}%`,
                        backgroundColor: occPct > 90 ? '#dc2626' : occPct > 70 ? '#d97706' : '#22c55e',
                      }}
                    />
                  </div>
                </div>

                {/* Amenities Chips */}
                {amenitiesList.length > 0 && (
                  <div className="shelter-amenities-row">
                    {amenitiesList.map((am, idx) => (
                      <span key={idx} className="shelter-amenity-tag">
                        {getAmenityIcon(am)} {am}
                      </span>
                    ))}
                  </div>
                )}

                {/* Contact Officer */}
                <div className="shelter-contact-section">
                  <div className="shelter-officer-info">
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{t.campOfficer}:</span>
                    <span style={{ fontWeight: 700 }}>{s.contact_person || 'NDRF Relief Officer'}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {s.contact_phone && (
                      <a
                        href={`tel:${s.contact_phone.replace(/\s/g, '')}`}
                        className="shelter-action-btn call"
                      >
                        📞 {t.callCampOfficer}
                      </a>
                    )}
                    {s.contact_phone && (
                      <a
                        href={`sms:${s.contact_phone.replace(/\s/g, '')}?body=${encodeURIComponent(
                          `Citizen requesting shelter at ${s.name}, ${s.location}`
                        )}`}
                        className="shelter-action-btn sms"
                      >
                        📲 SMS
                      </a>
                    )}
                    {s.lat && s.lng && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shelter-action-btn map"
                      >
                        🗺️ {t.openInMap}
                      </a>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {s.notes && (
                  <div className="shelter-notes-box">
                    ℹ️ {s.notes}
                  </div>
                )}

                {/* Updated timestamp */}
                <div className="shelter-updated-ts">
                  Updated: {s.updated_at ? new Date(s.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
                  {s.lat && s.lng && (
                    <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono, monospace)' }}>
                      GPS: {Number(s.lat).toFixed(4)}, {Number(s.lng).toFixed(4)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
