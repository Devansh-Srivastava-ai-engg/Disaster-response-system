const COLORS = { Critical: '#c0392b', High: '#d68910', Medium: '#b7950b', Safe: '#1e8449' };

export default function RiskMap({ zones, selectedZoneId, onSelect }) {
  return (
    <div className="map-frame">
      <svg className="map-svg" viewBox="0 0 600 300">
        {zones.map((z) => {
          const isSel  = z.id === selectedZoneId;
          const plateH = 74;
          const plateY = z.y + z.h - plateH;
          const shortName = z.name.split('—')[1]?.trim() || z.name;

          return (
            <g key={z.id} className="zone-cell" onClick={() => onSelect(z.id)}>
              <rect
                x={z.x} y={z.y} width={z.w} height={z.h} rx="6"
                fill={COLORS[z.priority]}
                opacity={isSel ? 0.96 : 0.76}
                stroke={isSel ? '#1d3557' : 'rgba(255,255,255,0.6)'}
                strokeWidth={isSel ? 3 : 1.5}
              />
              {/* Zone ID & State badge */}
              <rect x={z.x + 8} y={z.y + 8} width={28} height={18} rx="3" fill="rgba(255,255,255,0.92)" />
              <text x={z.x + 22} y={z.y + 21} textAnchor="middle"
                fontFamily="'JetBrains Mono',monospace" fontSize="11" fontWeight="700" fill="#1d3557">
                {z.id}
              </text>

              {/* State pill */}
              <rect x={z.x + 40} y={z.y + 8} width={z.w - 48} height={18} rx="3" fill="rgba(0,0,0,0.35)" />
              <text x={z.x + 46} y={z.y + 20}
                fontFamily="Inter,sans-serif" fontSize="10" fontWeight="600" fill="#ffffff">
                {z.state || 'NER'}
              </text>

              {/* Info plate */}
              <rect x={z.x} y={plateY} width={z.w} height={plateH} fill="rgba(255,255,255,0.92)" />
              <text x={z.x + 8} y={plateY + 16}
                fontFamily="Inter,sans-serif" fontSize="11" fontWeight="700" fill="#111827">
                {shortName.length > 22 ? shortName.substring(0, 20) + '…' : shortName}
              </text>
              <text x={z.x + 8} y={plateY + 32}
                fontFamily="'JetBrains Mono',monospace" fontSize="9.5" fontWeight="600" fill={z.landslide_prob >= 70 ? '#b91c1c' : '#4b5563'}>
                ⚠️ Landslide: {z.landslide_prob ?? 0}% · Rain: {z.rainfall_24h_mm ?? 0}mm
              </text>
              <text x={z.x + 8} y={plateY + 48}
                fontFamily="'JetBrains Mono',monospace" fontSize="9.5" fill="#6b7280">
                Slopes: {z.slope_instability} · Sat: {z.soil_saturation}%
              </text>
              <text x={z.x + 8} y={plateY + 64}
                fontFamily="'JetBrains Mono',monospace" fontSize="9" fill={z.road_status === 'Blocked' ? '#b91c1c' : '#1e8449'}>
                Lifelines: {z.road_status} · Cutoff: {z.isolated_villages || 0} hamlets
              </text>
            </g>
          );
        })}
      </svg>
      <div className="map-legend">
        {Object.entries(COLORS).map(([k, v]) => (
          <span key={k}>
            <i style={{ background: v, width: 10, height: 10, borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
            {k === 'Critical' ? 'Red Alert (Imminent)' : k === 'High' ? 'Orange Alert (High Risk)' : k === 'Medium' ? 'Yellow Alert (Watch)' : 'Green (Normal)'}
          </span>
        ))}
      </div>
    </div>
  );
}
