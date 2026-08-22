export default function ZoneDetail({ zone }) {
  if (!zone) return null;

  return (
    <div className="zone-detail">
      <div className="row">
        <span>Zone &amp; State</span>
        <b>{zone.name} ({zone.state || 'NER'})</b>
      </div>
      <div className="row">
        <span>Primary Hazard</span>
        <b style={{ color: 'var(--accent)' }}>{zone.hazard_type || 'Landslide & Flash Flood'}</b>
      </div>
      <div className="row">
        <span>AI Landslide Probability</span>
        <b style={{ color: (zone.landslide_prob || 0) >= 60 ? 'var(--critical)' : 'var(--text)' }}>
          {zone.landslide_prob ?? 0}% ({zone.landslide_prob >= 75 ? 'Imminent Risk' : zone.landslide_prob >= 50 ? 'High' : 'Moderate'})
        </b>
      </div>
      <div className="row">
        <span>24h Rainfall / Soil Saturation</span>
        <b>{zone.rainfall_24h_mm ?? 0} mm · {zone.soil_saturation ?? 0}% Saturation</b>
      </div>
      <div className="row">
        <span>Terrain &amp; Hill Cutting</span>
        <b>Slopes: {zone.slope_instability} · Cut Hazard: {zone.hill_cutting_risk}</b>
      </div>
      <div className="row">
        <span>Isolated Remote Villages</span>
        <b style={{ color: (zone.isolated_villages || 0) > 0 ? 'var(--critical)' : 'var(--safe)' }}>
          {zone.isolated_villages || 0} Cutoff Hamlets (Air/JCB Priority)
        </b>
      </div>
      <div className="row">
        <span>Early Warning Level</span>
        <span className={`badge b-${zone.priority.toLowerCase()}`}>
          {zone.early_warning || zone.priority} (Score: {zone.score})
        </span>
      </div>
    </div>
  );
}
