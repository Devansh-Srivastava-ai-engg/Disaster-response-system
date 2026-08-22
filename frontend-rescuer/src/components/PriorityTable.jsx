export default function PriorityTable({ zones, selectedZoneId, onSelect }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Sector</th>
          <th>State</th>
          <th>Landslide Prob.</th>
          <th>24h Rain</th>
          <th>Isolated</th>
          <th>Lifeline</th>
          <th>Alert Level</th>
        </tr>
      </thead>
      <tbody>
        {zones.map((z) => (
          <tr
            key={z.id}
            className={z.id === selectedZoneId ? 'selected' : ''}
            onClick={() => onSelect(z.id)}
          >
            <td className="zc">{z.id}</td>
            <td style={{ fontSize: 12, fontWeight: 600 }}>{z.state || 'NER'}</td>
            <td>
              <b style={{ color: (z.landslide_prob || 0) >= 60 ? 'var(--critical)' : 'var(--text)' }}>
                {z.landslide_prob ?? 0}%
              </b>
            </td>
            <td>{z.rainfall_24h_mm ?? 0} mm</td>
            <td>
              {(z.isolated_villages || 0) > 0 ? (
                <span style={{ color: 'var(--critical)', fontWeight: 700 }}>{z.isolated_villages} hamlets</span>
              ) : (
                <span style={{ color: 'var(--text-faint)' }}>None</span>
              )}
            </td>
            <td>
              <span style={{ color: z.road_status === 'Blocked' ? 'var(--critical)' : z.road_status === 'Damaged' ? 'var(--high)' : 'var(--safe)', fontWeight: 600 }}>
                {z.road_status}
              </span>
            </td>
            <td>
              <span className={`badge b-${z.priority.toLowerCase()}`}>
                {z.priority} ({z.score})
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
