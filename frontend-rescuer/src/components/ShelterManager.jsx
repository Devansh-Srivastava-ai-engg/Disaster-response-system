import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const SECTORS = [
  { id: 'all', label: 'All Sectors', icon: '🌐' },
  { id: 'A', label: 'Sector A (Assam)', lat: 25.1685, lng: 93.0234 },
  { id: 'B', label: 'Sector B (Meghalaya)', lat: 25.2986, lng: 91.7324 },
  { id: 'C', label: 'Sector C (Sikkim)', lat: 27.2023, lng: 88.6012 },
  { id: 'D', label: 'Sector D (Arunachal)', lat: 27.3590, lng: 92.2350 },
  { id: 'E', label: 'Sector E (Nagaland)', lat: 25.6751, lng: 94.1086 },
  { id: 'F', label: 'Sector F (Mizoram)', lat: 23.7780, lng: 92.7350 },
];

const DEFAULT_AMENITIES = [
  { id: 'Clean Drinking Water', label: 'Clean Water', icon: '💧' },
  { id: 'Hot Meals & Kitchen', label: 'Hot Meals', icon: '🍲' },
  { id: 'First Aid & Medical Doctor', label: 'Medical / First Aid', icon: '🏥' },
  { id: 'Solar / Generator Power Backup', label: 'Power Backup', icon: '⚡' },
  { id: 'Blankets & Bedding', label: 'Blankets & Bedding', icon: '🛏️' },
  { id: 'Infant / Senior Care', label: 'Infant / Senior Care', icon: '👶' },
];

export default function ShelterManager({ lang = 'en' }) {
  const [shelters, setShelters] = useState([]);
  const [activeSector, setActiveSector] = useState('all');
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingShelter, setEditingShelter] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [showCustomGps, setShowCustomGps] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [sectorId, setSectorId] = useState('A');
  const [location, setLocation] = useState('');
  const [lat, setLat] = useState('25.1685');
  const [lng, setLng] = useState('93.0234');
  const [capacityTotal, setCapacityTotal] = useState(200);
  const [capacityAvailable, setCapacityAvailable] = useState(150);
  const [status, setStatus] = useState('Open');
  const [selectedAmenities, setSelectedAmenities] = useState([
    'Clean Drinking Water',
    'Hot Meals & Kitchen',
    'First Aid & Medical Doctor',
  ]);
  const [contactPerson, setContactPerson] = useState('NDRF Relief Officer');
  const [contactPhone, setContactPhone] = useState('+91 98765 43210');
  const [notes, setNotes] = useState('');

  // Fetch shelters
  const fetchShelters = useCallback(async () => {
    try {
      const data = await api.getShelters(activeSector);
      setShelters(data || []);
    } catch (e) {
      console.error('Failed to load shelters', e);
    }
  }, [activeSector]);

  useEffect(() => {
    fetchShelters();
    const interval = setInterval(fetchShelters, 5000);
    return () => clearInterval(interval);
  }, [fetchShelters]);

  const handleSectorSelectChange = (sec) => {
    setSectorId(sec);
    const found = SECTORS.find((s) => s.id === sec);
    if (found && found.lat) {
      setLat(found.lat.toString());
      setLng(found.lng.toString());
    }
  };

  const toggleAmenity = (amenityId) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenityId)
        ? prev.filter((a) => a !== amenityId)
        : [...prev, amenityId]
    );
  };

  const handleSetCapacityPreset = (pct) => {
    const total = Number(capacityTotal) || 100;
    setCapacityAvailable(Math.round((total * pct) / 100));
  };

  const handleOpenAddModal = (shelterToEdit = null) => {
    if (shelterToEdit) {
      setEditingShelter(shelterToEdit);
      setName(shelterToEdit.name);
      setSectorId(shelterToEdit.sector_id);
      setLocation(shelterToEdit.location);
      setLat(shelterToEdit.lat?.toString() || '');
      setLng(shelterToEdit.lng?.toString() || '');
      setCapacityTotal(shelterToEdit.capacity_total);
      setCapacityAvailable(shelterToEdit.capacity_available);
      setStatus(shelterToEdit.status);
      setSelectedAmenities(
        shelterToEdit.amenities
          ? shelterToEdit.amenities.split(',').map((s) => s.trim())
          : []
      );
      setContactPerson(shelterToEdit.contact_person || '');
      setContactPhone(shelterToEdit.contact_phone || '');
      setNotes(shelterToEdit.notes || '');
      setShowCustomGps(false);
    } else {
      setEditingShelter(null);
      setName('');
      setSectorId(activeSector !== 'all' ? activeSector : 'A');
      const defSec = activeSector !== 'all' ? activeSector : 'A';
      const found = SECTORS.find((s) => s.id === defSec);
      setLat(found?.lat?.toString() || '25.1685');
      setLng(found?.lng?.toString() || '93.0234');
      setLocation('');
      setCapacityTotal(200);
      setCapacityAvailable(200);
      setStatus('Open');
      setSelectedAmenities([
        'Clean Drinking Water',
        'Hot Meals & Kitchen',
        'First Aid & Medical Doctor',
      ]);
      setContactPerson('NDRF Relief Officer');
      setContactPhone('+91 98765 43210');
      setNotes('');
      setShowCustomGps(false);
    }
    setShowAddModal(true);
  };

  const handleSaveShelter = async (e) => {
    e.preventDefault();
    if (!name.trim() || !location.trim()) return;

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        sector_id: sectorId,
        location: location.trim(),
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
        capacity_total: Number(capacityTotal) || 100,
        capacity_available: Number(capacityAvailable) || 0,
        status,
        amenities: selectedAmenities.join(', '),
        contact_person: contactPerson.trim(),
        contact_phone: contactPhone.trim(),
        notes: notes.trim(),
      };

      if (editingShelter) {
        await api.updateShelter(editingShelter.id, payload);
        setActionSuccess(`✓ Relief Shelter "${payload.name}" updated successfully.`);
      } else {
        await api.addShelter(payload);
        setActionSuccess(`✓ New Relief Shelter "${payload.name}" registered and published live.`);
      }

      setShowAddModal(false);
      await fetchShelters();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err) {
      console.error(err);
      alert('Error saving shelter: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Quick capacity modifier (+/- 10 or +/- 1)
  const handleQuickCapacityChange = async (shelter, delta) => {
    const newAvailable = Math.max(
      0,
      Math.min(shelter.capacity_total, shelter.capacity_available + delta)
    );
    let newStatus = shelter.status;
    if (newAvailable === 0) newStatus = 'Full';
    else if (newAvailable <= shelter.capacity_total * 0.25)
      newStatus = 'Near Capacity';
    else if (shelter.status === 'Full' || shelter.status === 'Near Capacity')
      newStatus = 'Open';

    try {
      await api.updateShelter(shelter.id, {
        capacity_available: newAvailable,
        status: newStatus,
      });
      await fetchShelters();
    } catch (e) {
      console.error(e);
    }
  };

  // Quick Status change
  const handleStatusChange = async (shelterId, newStatus) => {
    try {
      await api.updateShelter(shelterId, { status: newStatus });
      await fetchShelters();
    } catch (e) {
      console.error(e);
    }
  };

  // Delete Shelter
  const handleDeleteShelter = async (id, sName) => {
    if (!window.confirm(`Are you sure you want to remove shelter "${sName}"?`))
      return;
    try {
      await api.deleteShelter(id);
      await fetchShelters();
      setActionSuccess(`✓ Shelter "${sName}" removed from operations directory.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (e) {
      console.error(e);
    }
  };

  // Aggregate stats
  const totalShelters = shelters.length;
  const totalCap = shelters.reduce(
    (acc, s) => acc + (s.capacity_total || 0),
    0
  );
  const totalAvail = shelters.reduce(
    (acc, s) => acc + (s.capacity_available || 0),
    0
  );
  const openCamps = shelters.filter(
    (s) => s.status === 'Open' || s.status === 'Near Capacity'
  ).length;

  const formOccPct =
    capacityTotal > 0
      ? Math.round(
          ((capacityTotal - Math.min(capacityTotal, capacityAvailable)) /
            capacityTotal) *
            100
        )
      : 0;

  return (
    <div className="shelter-manager-root">
      {/* ── Top Summary & Action Bar ── */}
      <div className="shelter-header-card">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>🏛️</span>
            <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>
              Emergency Relief Shelters &amp; Camp Operations
            </h2>
            <span className="live-pill">LIVE COMMAND DIRECTORY</span>
          </div>
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: 12.5,
              color: 'var(--text-dim)',
            }}
          >
            Real-time management of verified disaster relief shelters, high-ground
            camps, bed capacity, and live amenities broadcasted to citizens.
          </p>
        </div>

        <button
          type="button"
          className="btn-create-shelter"
          onClick={() => handleOpenAddModal(null)}
        >
          <span>➕ Add New Relief Shelter</span>
        </button>
      </div>

      {/* ── Metric Stat Chips ── */}
      <div className="shelter-stats-grid">
        <div className="shelter-stat-card">
          <div className="stat-label">Total Monitored Camps</div>
          <div className="stat-val text-blue">{totalShelters}</div>
          <div className="stat-sub">{openCamps} Open &amp; Accepting</div>
        </div>

        <div className="shelter-stat-card">
          <div className="stat-label">Total Bed Capacity</div>
          <div className="stat-val text-navy">{totalCap}</div>
          <div className="stat-sub">Max Emergency Intake</div>
        </div>

        <div className="shelter-stat-card">
          <div className="stat-label">Available Space Vacancy</div>
          <div className="stat-val text-green">{totalAvail}</div>
          <div className="stat-sub">
            {totalCap > 0 ? Math.round((totalAvail / totalCap) * 100) : 0}% Free
            Beds
          </div>
        </div>

        <div className="shelter-stat-card">
          <div className="stat-label">Occupied Citizens</div>
          <div className="stat-val text-amber">
            {Math.max(0, totalCap - totalAvail)}
          </div>
          <div className="stat-sub">Sheltered with Food/Medical</div>
        </div>
      </div>

      {actionSuccess && (
        <div className="alert-success" style={{ marginTop: 14 }}>
          <div className="alert-success-text">{actionSuccess}</div>
        </div>
      )}

      {/* ── Sector Filter Tabs ── */}
      <div className="shelter-sector-tabs">
        {SECTORS.map((sec) => (
          <button
            key={sec.id}
            type="button"
            className={`shelter-sec-tab ${
              activeSector === sec.id ? 'active' : ''
            }`}
            onClick={() => setActiveSector(sec.id)}
          >
            {sec.label}
          </button>
        ))}
      </div>

      {/* ── Shelters Grid ── */}
      <div className="shelter-cards-grid">
        {shelters.length === 0 && (
          <div
            className="empty-note"
            style={{
              gridColumn: '1 / -1',
              padding: 40,
              textAlign: 'center',
            }}
          >
            No relief shelters recorded for this sector. Click{' '}
            <strong>"Add New Relief Shelter"</strong> above to register an
            emergency camp.
          </div>
        )}

        {shelters.map((s) => {
          const occPct =
            s.capacity_total > 0
              ? Math.round(
                  ((s.capacity_total - s.capacity_available) /
                    s.capacity_total) *
                    100
                )
              : 0;

          const statusColor =
            s.status === 'Open'
              ? '#166534'
              : s.status === 'Near Capacity'
              ? '#d97706'
              : '#dc2626';
          const statusBg =
            s.status === 'Open'
              ? '#f0fdf4'
              : s.status === 'Near Capacity'
              ? '#fffbeb'
              : '#fef2f2';

          return (
            <div key={s.id} className="shelter-admin-card">
              {/* Header */}
              <div className="shelter-card-top">
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span className="sector-tag">Sector {s.sector_id}</span>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: 14.5,
                        color: 'var(--text)',
                      }}
                    >
                      {s.name}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-dim)',
                      marginTop: 3,
                    }}
                  >
                    📍 {s.location}
                  </div>
                </div>

                <select
                  value={s.status}
                  onChange={(e) => handleStatusChange(s.id, e.target.value)}
                  style={{
                    fontWeight: 800,
                    fontSize: 11.5,
                    color: statusColor,
                    backgroundColor: statusBg,
                    border: `1px solid ${statusColor}`,
                    borderRadius: 4,
                    padding: '3px 8px',
                    cursor: 'pointer',
                  }}
                >
                  <option value="Open">● Open &amp; Accepting</option>
                  <option value="Near Capacity">● Near Capacity</option>
                  <option value="Full">● Full / No Space</option>
                  <option value="Closed">● Closed / Evacuated</option>
                </select>
              </div>

              {/* Capacity Meter */}
              <div className="shelter-capacity-section">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  <span>
                    Vacancy:{' '}
                    <strong style={{ color: '#166534' }}>
                      {s.capacity_available} Available
                    </strong>{' '}
                    / {s.capacity_total} Beds
                  </span>
                  <span
                    style={{
                      fontWeight: 700,
                      color: 'var(--text-dim)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {occPct}% Full
                  </span>
                </div>

                <div className="capacity-bar-track">
                  <div
                    className="capacity-bar-fill"
                    style={{
                      width: `${occPct}%`,
                      backgroundColor:
                        occPct > 90
                          ? '#dc2626'
                          : occPct > 70
                          ? '#d97706'
                          : '#166534',
                    }}
                  />
                </div>

                {/* Quick Capacity Stepper Controls */}
                <div className="capacity-quick-steppers">
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-dim)',
                    }}
                  >
                    Quick Available Update:
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      className="btn-stepper"
                      onClick={() => handleQuickCapacityChange(s, -10)}
                      title="Subtract 10 available spots"
                    >
                      −10
                    </button>
                    <button
                      type="button"
                      className="btn-stepper"
                      onClick={() => handleQuickCapacityChange(s, -1)}
                      title="Subtract 1 available spot"
                    >
                      −1
                    </button>
                    <button
                      type="button"
                      className="btn-stepper add"
                      onClick={() => handleQuickCapacityChange(s, +1)}
                      title="Add 1 available spot"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      className="btn-stepper add"
                      onClick={() => handleQuickCapacityChange(s, +10)}
                      title="Add 10 available spots"
                    >
                      +10
                    </button>
                  </div>
                </div>
              </div>

              {/* Amenities */}
              {s.amenities && (
                <div className="shelter-amenities-wrap">
                  {s.amenities.split(',').map((am, idx) => (
                    <span key={idx} className="amenity-chip">
                      ✓ {am.trim()}
                    </span>
                  ))}
                </div>
              )}

              {/* Contact & Officer Details */}
              <div className="shelter-contact-row">
                <div style={{ fontSize: 11.5 }}>
                  Officer: <strong>{s.contact_person || 'NDRF Command'}</strong>
                  {s.contact_phone && (
                    <span
                      style={{
                        marginLeft: 6,
                        color: 'var(--accent)',
                        fontWeight: 700,
                      }}
                    >
                      📞 {s.contact_phone}
                    </span>
                  )}
                </div>
                {s.lat && s.lng && (
                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-faint)',
                    }}
                  >
                    GPS: {Number(s.lat).toFixed(4)}, {Number(s.lng).toFixed(4)}
                  </div>
                )}
              </div>

              {s.notes && (
                <div className="shelter-note-box">
                  <strong>Notes: </strong>
                  {s.notes}
                </div>
              )}

              {/* Card Footer Actions */}
              <div className="shelter-card-footer">
                <div
                  style={{
                    fontSize: 10.5,
                    color: 'var(--text-faint)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  Updated:{' '}
                  {s.updated_at
                    ? new Date(s.updated_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Live'}
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="btn-card-action edit"
                    onClick={() => handleOpenAddModal(s)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    className="btn-card-action delete"
                    onClick={() => handleDeleteShelter(s.id, s.name)}
                  >
                    🗑️ Remove
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── SIMPLIFIED & ELEGANT REGISTER/EDIT SHELTER MODAL ── */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div
            className="modal-box shelter-simplified-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="shelter-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="shelter-modal-icon-badge">🏛️</div>
                <div>
                  <h3 className="shelter-modal-title">
                    {editingShelter
                      ? 'Edit Relief Shelter'
                      : 'Register New Relief Shelter'}
                  </h3>
                  <p className="shelter-modal-sub">
                    Live parameters broadcasted across Citizen Network and Rescuer EOC.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="shelter-modal-close-btn"
                onClick={() => setShowAddModal(false)}
                title="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveShelter} className="shelter-modal-form">
              {/* SECTION 1: Identity & Sector */}
              <div className="form-section-card">
                <div className="form-section-title">
                  <span>🏢</span> Basic Details
                </div>

                <div className="form-row-full">
                  <label className="form-label-styled">
                    Shelter / Camp Name <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input-styled"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Haflong Central Hill School Relief Camp"
                    required
                  />
                </div>

                <div className="form-grid-2">
                  <div>
                    <label className="form-label-styled">
                      Disaster Sector <span className="req">*</span>
                    </label>
                    <select
                      className="form-input-styled"
                      value={sectorId}
                      onChange={(e) => handleSectorSelectChange(e.target.value)}
                    >
                      <option value="A">Sector A (Assam)</option>
                      <option value="B">Sector B (Meghalaya)</option>
                      <option value="C">Sector C (Sikkim)</option>
                      <option value="D">Sector D (Arunachal)</option>
                      <option value="E">Sector E (Nagaland)</option>
                      <option value="F">Sector F (Mizoram)</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label-styled">
                      Operational Status <span className="req">*</span>
                    </label>
                    <select
                      className="form-input-styled"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="Open">🟢 Open &amp; Accepting</option>
                      <option value="Near Capacity">🟡 Near Capacity</option>
                      <option value="Full">🔴 Full / At Capacity</option>
                      <option value="Closed">⚫ Closed / Evacuated</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Location & GPS */}
              <div className="form-section-card">
                <div className="form-section-title">
                  <span>📍</span> Location &amp; Safe Ground
                </div>

                <div className="form-row-full">
                  <label className="form-label-styled">
                    Address / Landmark / Access Route <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input-styled"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Haflong Ridge Gate 3, Elevated Community Hall"
                    required
                  />
                </div>

                {/* Compact GPS Row */}
                <div className="gps-compact-strip">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13 }}>🧭</span>
                    <span style={{ fontSize: 11.5, color: '#475569', fontWeight: 600 }}>
                      Sector Coordinates:
                    </span>
                    <span className="gps-pill-val">
                      {lat || '25.16'}, {lng || '93.02'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-toggle-gps"
                    onClick={() => setShowCustomGps((g) => !g)}
                  >
                    {showCustomGps ? 'Hide Custom GPS' : 'Edit Exact GPS'}
                  </button>
                </div>

                {showCustomGps && (
                  <div className="form-grid-2" style={{ marginTop: 8 }}>
                    <div>
                      <label className="form-label-styled">Latitude</label>
                      <input
                        type="text"
                        className="form-input-styled"
                        value={lat}
                        onChange={(e) => setLat(e.target.value)}
                        placeholder="25.1685"
                      />
                    </div>
                    <div>
                      <label className="form-label-styled">Longitude</label>
                      <input
                        type="text"
                        className="form-input-styled"
                        value={lng}
                        onChange={(e) => setLng(e.target.value)}
                        placeholder="93.0234"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: Capacity & Vacancy */}
              <div className="form-section-card">
                <div className="form-section-title">
                  <span>🛏️</span> Bed Capacity &amp; Vacancy
                </div>

                <div className="form-grid-2">
                  <div>
                    <label className="form-label-styled">
                      Total Bed Capacity <span className="req">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="form-input-styled"
                      value={capacityTotal}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setCapacityTotal(val);
                        if (capacityAvailable > val) setCapacityAvailable(val);
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label-styled">
                      Currently Available (Vacant) <span className="req">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={capacityTotal}
                      className="form-input-styled"
                      value={capacityAvailable}
                      onChange={(e) => setCapacityAvailable(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                {/* Quick Percentage Presets */}
                <div className="capacity-preset-row">
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                    Quick Vacancy Presets:
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      className="btn-preset-chip"
                      onClick={() => handleSetCapacityPreset(100)}
                    >
                      100% Free
                    </button>
                    <button
                      type="button"
                      className="btn-preset-chip"
                      onClick={() => handleSetCapacityPreset(75)}
                    >
                      75% Free
                    </button>
                    <button
                      type="button"
                      className="btn-preset-chip"
                      onClick={() => handleSetCapacityPreset(50)}
                    >
                      50% Free
                    </button>
                    <button
                      type="button"
                      className="btn-preset-chip"
                      onClick={() => handleSetCapacityPreset(20)}
                    >
                      20% Free
                    </button>
                  </div>
                </div>

                {/* Mini Preview Bar */}
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', marginBottom: 3 }}>
                    <span>Live Preview: <strong>{capacityAvailable}</strong> free beds</span>
                    <span>{formOccPct}% Occupied</span>
                  </div>
                  <div className="capacity-bar-track" style={{ height: 6 }}>
                    <div
                      className="capacity-bar-fill"
                      style={{
                        width: `${formOccPct}%`,
                        backgroundColor:
                          formOccPct > 90
                            ? '#dc2626'
                            : formOccPct > 70
                            ? '#d97706'
                            : '#166534',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: Available Amenities */}
              <div className="form-section-card">
                <div className="form-section-title">
                  <span>📦</span> Available Camp Amenities &amp; Supplies
                </div>

                <div className="amenities-modern-grid">
                  {DEFAULT_AMENITIES.map((am) => {
                    const isSelected = selectedAmenities.includes(am.id);
                    return (
                      <button
                        type="button"
                        key={am.id}
                        className={`amenity-modern-chip ${
                          isSelected ? 'selected' : ''
                        }`}
                        onClick={() => toggleAmenity(am.id)}
                      >
                        <span className="am-icon">{am.icon}</span>
                        <span className="am-label">{am.label}</span>
                        <span className="am-check">{isSelected ? '✓' : '+'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 5: Contact & Access Notes */}
              <div className="form-section-card">
                <div className="form-section-title">
                  <span>📞</span> Camp In-Charge &amp; Access Notes
                </div>

                <div className="form-grid-2">
                  <div>
                    <label className="form-label-styled">Officer Name</label>
                    <input
                      type="text"
                      className="form-input-styled"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder="e.g. Capt. Bikram Barman"
                    />
                  </div>

                  <div>
                    <label className="form-label-styled">Contact Phone</label>
                    <input
                      type="text"
                      className="form-input-styled"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="e.g. +91 94350 11223"
                    />
                  </div>
                </div>

                <div className="form-row-full" style={{ marginTop: 8 }}>
                  <label className="form-label-styled">Road Access / Special Instructions (Optional)</label>
                  <input
                    type="text"
                    className="form-input-styled"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. 4x4 access only, Generator running 24x7..."
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="shelter-modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim() || !location.trim()}
                  className="btn-modal-submit"
                >
                  {loading
                    ? 'Saving…'
                    : editingShelter
                    ? '✓ Save Shelter Updates'
                    : '🚀 Establish & Publish Shelter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
