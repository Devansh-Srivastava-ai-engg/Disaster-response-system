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
  'Clean Drinking Water',
  'Hot Meals & Kitchen',
  'First Aid & Medical Doctor',
  'Solar / Generator Power Backup',
  'Blankets & Bedding',
  'Infant / Senior Care',
];

export default function ShelterManager({ lang = 'en' }) {
  const [shelters, setShelters] = useState([]);
  const [activeSector, setActiveSector] = useState('all');
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingShelter, setEditingShelter] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [sectorId, setSectorId] = useState('A');
  const [location, setLocation] = useState('');
  const [lat, setLat] = useState('25.1685');
  const [lng, setLng] = useState('93.0234');
  const [capacityTotal, setCapacityTotal] = useState(200);
  const [capacityAvailable, setCapacityAvailable] = useState(150);
  const [status, setStatus] = useState('Open');
  const [selectedAmenities, setSelectedAmenities] = useState(['Clean Drinking Water', 'Hot Meals & Kitchen', 'First Aid & Medical Doctor']);
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
    const found = SECTORS.find(s => s.id === sec);
    if (found && found.lat) {
      setLat(found.lat.toString());
      setLng(found.lng.toString());
    }
  };

  const toggleAmenity = (amenity) => {
    setSelectedAmenities(prev =>
      prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
    );
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
      setSelectedAmenities(shelterToEdit.amenities ? shelterToEdit.amenities.split(',').map(s => s.trim()) : []);
      setContactPerson(shelterToEdit.contact_person || '');
      setContactPhone(shelterToEdit.contact_phone || '');
      setNotes(shelterToEdit.notes || '');
    } else {
      setEditingShelter(null);
      setName('');
      setSectorId('A');
      setLocation('');
      setLat('25.1685');
      setLng('93.0234');
      setCapacityTotal(200);
      setCapacityAvailable(150);
      setStatus('Open');
      setSelectedAmenities(['Clean Drinking Water', 'Hot Meals & Kitchen', 'First Aid & Medical Doctor']);
      setContactPerson('NDRF Relief Officer');
      setContactPhone('+91 98765 43210');
      setNotes('');
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
        setActionSuccess(`✓ New Relief Shelter "${payload.name}" established and published live.`);
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
    const newAvailable = Math.max(0, Math.min(shelter.capacity_total, shelter.capacity_available + delta));
    let newStatus = shelter.status;
    if (newAvailable === 0) newStatus = 'Full';
    else if (newAvailable <= shelter.capacity_total * 0.25) newStatus = 'Near Capacity';
    else if (shelter.status === 'Full' || shelter.status === 'Near Capacity') newStatus = 'Open';

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
    if (!window.confirm(`Are you sure you want to remove shelter "${sName}"?`)) return;
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
  const totalCap = shelters.reduce((acc, s) => acc + (s.capacity_total || 0), 0);
  const totalAvail = shelters.reduce((acc, s) => acc + (s.capacity_available || 0), 0);
  const openCamps = shelters.filter(s => s.status === 'Open' || s.status === 'Near Capacity').length;

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
          <p style={{ margin: '4px 0 0 0', fontSize: 12.5, color: 'var(--text-dim)' }}>
            Real-time management of verified disaster relief shelters, high-ground camps, bed capacity, and live amenities broadcasted to citizens.
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
          <div className="stat-sub">{totalCap > 0 ? Math.round((totalAvail / totalCap) * 100) : 0}% Free Beds</div>
        </div>

        <div className="shelter-stat-card">
          <div className="stat-label">Occupied Citizens</div>
          <div className="stat-val text-amber">{Math.max(0, totalCap - totalAvail)}</div>
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
            className={`shelter-sec-tab ${activeSector === sec.id ? 'active' : ''}`}
            onClick={() => setActiveSector(sec.id)}
          >
            {sec.label}
          </button>
        ))}
      </div>

      {/* ── Shelters Grid ── */}
      <div className="shelter-cards-grid">
        {shelters.length === 0 && (
          <div className="empty-note" style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center' }}>
            No relief shelters recorded for this sector. Click <strong>"Add New Relief Shelter"</strong> above to register an emergency camp.
          </div>
        )}

        {shelters.map((s) => {
          const occPct = s.capacity_total > 0
            ? Math.round(((s.capacity_total - s.capacity_available) / s.capacity_total) * 100)
            : 0;

          const statusColor = s.status === 'Open' ? '#166534' : s.status === 'Near Capacity' ? '#d97706' : '#dc2626';
          const statusBg = s.status === 'Open' ? '#f0fdf4' : s.status === 'Near Capacity' ? '#fffbeb' : '#fef2f2';

          return (
            <div key={s.id} className="shelter-admin-card">
              {/* Header */}
              <div className="shelter-card-top">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span className="sector-tag">Sector {s.sector_id}</span>
                    <span style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--text)' }}>
                      {s.name}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>
                    Vacancy: <strong style={{ color: '#166534' }}>{s.capacity_available} Available</strong> / {s.capacity_total} Beds
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    {occPct}% Full
                  </span>
                </div>

                <div className="capacity-bar-track">
                  <div
                    className="capacity-bar-fill"
                    style={{
                      width: `${occPct}%`,
                      backgroundColor: occPct > 90 ? '#dc2626' : occPct > 70 ? '#d97706' : '#166534',
                    }}
                  />
                </div>

                {/* Quick Capacity Stepper Controls */}
                <div className="capacity-quick-steppers">
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)' }}>
                    Quick Available Update:
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      className="btn-stepper"
                      onClick={() => handleQuickCapacityChange(s, -10)}
                      title="Subtract 10 available spots (10 citizens arrived)"
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
                    <span style={{ marginLeft: 6, color: 'var(--accent)', fontWeight: 700 }}>
                      📞 {s.contact_phone}
                    </span>
                  )}
                </div>
                {s.lat && s.lng && (
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-faint)' }}>
                    GPS: {Number(s.lat).toFixed(4)}, {Number(s.lng).toFixed(4)}
                  </div>
                )}
              </div>

              {s.notes && (
                <div className="shelter-note-box">
                  <strong>Notes: </strong>{s.notes}
                </div>
              )}

              {/* Card Footer Actions */}
              <div className="shelter-card-footer">
                <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                  Updated: {s.updated_at ? new Date(s.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
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

      {/* ── Add / Edit Shelter Modal ── */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-box shelter-form-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">🏛️</div>
            <div className="modal-title">
              {editingShelter ? 'Edit Relief Shelter Details' : 'Register New Relief Shelter'}
            </div>
            <div className="modal-subtitle">
              Configure shelter location, capacity, amenities, and live emergency status.
            </div>

            <form onSubmit={handleSaveShelter}>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label>Shelter / Camp Name *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Haflong Central Hill School Relief Camp"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div className="form-group">
                  <label>Disaster Sector *</label>
                  <select
                    value={sectorId}
                    onChange={e => handleSectorSelectChange(e.target.value)}
                  >
                    <option value="A">Sector A (Assam)</option>
                    <option value="B">Sector B (Meghalaya)</option>
                    <option value="C">Sector C (Sikkim)</option>
                    <option value="D">Sector D (Arunachal)</option>
                    <option value="E">Sector E (Nagaland)</option>
                    <option value="F">Sector F (Mizoram)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Initial Status *</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                  >
                    <option value="Open">Open &amp; Accepting Citizens</option>
                    <option value="Near Capacity">Near Capacity</option>
                    <option value="Full">Full / No Vacancy</option>
                    <option value="Closed">Closed / Evacuated</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 10 }}>
                <label>Exact Location / Address / Landmark *</label>
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Near Haflong Ridge Gate 3, High Ground"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div className="form-group">
                  <label>Latitude (GPS)</label>
                  <input
                    value={lat}
                    onChange={e => setLat(e.target.value)}
                    placeholder="e.g. 25.1685"
                  />
                </div>
                <div className="form-group">
                  <label>Longitude (GPS)</label>
                  <input
                    value={lng}
                    onChange={e => setLng(e.target.value)}
                    placeholder="e.g. 93.0234"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div className="form-group">
                  <label>Total Bed Capacity *</label>
                  <input
                    type="number"
                    min="1"
                    value={capacityTotal}
                    onChange={e => setCapacityTotal(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Currently Available Beds *</label>
                  <input
                    type="number"
                    min="0"
                    max={capacityTotal}
                    value={capacityAvailable}
                    onChange={e => setCapacityAvailable(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Amenities Multi-Toggle */}
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label>Available Camp Amenities &amp; Rations</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {DEFAULT_AMENITIES.map(am => {
                    const isSelected = selectedAmenities.includes(am);
                    return (
                      <button
                        type="button"
                        key={am}
                        className={`amenity-toggle-chip ${isSelected ? 'active' : ''}`}
                        onClick={() => toggleAmenity(am)}
                      >
                        {isSelected ? '✓ ' : '+ '} {am}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div className="form-group">
                  <label>Officer in Charge</label>
                  <input
                    value={contactPerson}
                    onChange={e => setContactPerson(e.target.value)}
                    placeholder="e.g. Capt. Bikram Barman"
                  />
                </div>
                <div className="form-group">
                  <label>Officer Phone Number</label>
                  <input
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    placeholder="e.g. +91 94350 11223"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Special Instructions &amp; Road Access Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Accessible via 4x4 only, Generator operating 24x7..."
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 12 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ padding: '8px 20px' }}
                >
                  {loading ? 'Saving...' : editingShelter ? 'Update Shelter' : 'Establish Shelter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
