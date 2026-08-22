import { useState, useEffect } from 'react';

export default function WeatherSimulator({ zone, onUpdateConditions }) {
  const [rainfall, setRainfall] = useState(zone?.rainfall_24h_mm || 45);
  const [saturation, setSaturation] = useState(zone?.soil_saturation || 60);
  const [slope, setSlope] = useState(zone?.slope_instability || 'Moderate');
  const [hillCutting, setHillCutting] = useState(zone?.hill_cutting_risk || 'Moderate');
  const [isolated, setIsolated] = useState(zone?.isolated_villages || 0);
  const [roadStatus, setRoadStatus] = useState(zone?.road_status || 'Open');
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    if (zone) {
      setRainfall(zone.rainfall_24h_mm || 45);
      setSaturation(zone.soil_saturation || 60);
      setSlope(zone.slope_instability || 'Moderate');
      setHillCutting(zone.hill_cutting_risk || 'Moderate');
      setIsolated(zone.isolated_villages || 0);
      setRoadStatus(zone.road_status || 'Open');
    }
  }, [zone?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!zone) {
    return <div className="empty-note">Select a zone to simulate predictive weather and slope conditions.</div>;
  }

  const handleApply = async (customPayload) => {
    setSimulating(true);
    try {
      const payload = customPayload || {
        rainfall_24h_mm: Number(rainfall),
        soil_saturation: Number(saturation),
        slope_instability: slope,
        hill_cutting_risk: hillCutting,
        isolated_villages: Number(isolated),
        road_status: roadStatus,
      };
      if (onUpdateConditions) {
        await onUpdateConditions(zone.id, payload);
      }
    } finally {
      setSimulating(false);
    }
  };

  const triggerCloudburst = () => {
    const cloudburstPayload = {
      rainfall_24h_mm: 320,
      soil_saturation: 96,
      slope_instability: 'Extreme',
      hill_cutting_risk: 'Critical',
      isolated_villages: Math.max(3, (zone.isolated_villages || 0) + 3),
      road_status: 'Blocked',
    };
    setRainfall(320);
    setSaturation(96);
    setSlope('Extreme');
    setHillCutting('Critical');
    setIsolated(cloudburstPayload.isolated_villages);
    setRoadStatus('Blocked');
    handleApply(cloudburstPayload);
  };

  const resetNormal = () => {
    const normalPayload = {
      rainfall_24h_mm: 35,
      soil_saturation: 45,
      slope_instability: 'Stable',
      hill_cutting_risk: 'Low',
      isolated_villages: 0,
      road_status: 'Open',
    };
    setRainfall(35);
    setSaturation(45);
    setSlope('Stable');
    setHillCutting('Low');
    setIsolated(0);
    setRoadStatus('Open');
    handleApply(normalPayload);
  };

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
          Real-Time Sensor &amp; Climate Simulation — {zone.id} ({zone.state})
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={triggerCloudburst}
            disabled={simulating}
            style={{
              fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 4,
              background: 'var(--critical-soft)', color: 'var(--critical)', border: '1px solid rgba(185,28,28,0.3)',
              cursor: 'pointer',
            }}
          >
            ⚡ Cloudburst Scenario
          </button>
          <button
            onClick={resetNormal}
            disabled={simulating}
            style={{
              fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 4,
              background: 'var(--surface)', color: 'var(--text-dim)', border: '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            ↺ Reset
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
        {/* Rainfall Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>24h Precipitation:</span>
            <b style={{ fontFamily: 'var(--font-mono)' }}>{rainfall} mm</b>
          </div>
          <input
            type="range" min="0" max="400" step="5" value={rainfall}
            onChange={(e) => setRainfall(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Soil Saturation Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>Soil Saturation:</span>
            <b style={{ fontFamily: 'var(--font-mono)' }}>{saturation}%</b>
          </div>
          <input
            type="range" min="10" max="100" step="1" value={saturation}
            onChange={(e) => setSaturation(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Slope Instability */}
        <div>
          <label style={{ display: 'block', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 2 }}>Slope Fragility</label>
          <select
            value={slope} onChange={(e) => setSlope(e.target.value)}
            style={{ width: '100%', padding: '5px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 12 }}
          >
            <option value="Stable">Stable Slope</option>
            <option value="Moderate">Moderate Fragility</option>
            <option value="High">High Gradient Fragile</option>
            <option value="Extreme">Extreme Fault Line / Unstable</option>
          </select>
        </div>

        {/* Unplanned Hill Cutting Hazard */}
        <div>
          <label style={{ display: 'block', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 2 }}>Hill Cutting &amp; Quarrying</label>
          <select
            value={hillCutting} onChange={(e) => setHillCutting(e.target.value)}
            style={{ width: '100%', padding: '5px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 12 }}
          >
            <option value="Low">Low Excavation</option>
            <option value="Moderate">Moderate Hill Cutting</option>
            <option value="High">Heavy Unplanned Slope Cutting</option>
            <option value="Critical">Critical Road Widening Cut</option>
          </select>
        </div>

        {/* Isolated Villages */}
        <div>
          <label style={{ display: 'block', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 2 }}>Isolated Cutoff Hamlets</label>
          <input
            type="number" min="0" max="25" value={isolated}
            onChange={(e) => setIsolated(Math.max(0, Number(e.target.value)))}
            style={{ width: '100%', padding: '5px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 12 }}
          />
        </div>

        {/* Highway Lifeline Status */}
        <div>
          <label style={{ display: 'block', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 2 }}>Mountain Pass Road Status</label>
          <select
            value={roadStatus} onChange={(e) => setRoadStatus(e.target.value)}
            style={{ width: '100%', padding: '5px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 12 }}
          >
            <option value="Open">Open &amp; Clear</option>
            <option value="Damaged">Damaged / Sinking Pass</option>
            <option value="Blocked">Blocked by Landslide Debris</option>
          </select>
        </div>
      </div>

      <button
        onClick={() => handleApply()}
        disabled={simulating}
        style={{
          width: '100%', marginTop: 10, padding: '7px 12px',
          background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4,
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}
      >
        {simulating ? 'Recalculating AI Predictive Models…' : '🔄 Apply Sensor Simulation & Recalculate AI Risk'}
      </button>
    </div>
  );
}
