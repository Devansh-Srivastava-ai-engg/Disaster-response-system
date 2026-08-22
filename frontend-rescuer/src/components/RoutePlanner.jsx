const COLOR = {
  Safe: 'var(--safe)',
  Damaged: 'var(--high)',
  Flooded: 'var(--critical)',
  'Blocked by Landslide': 'var(--critical)',
};

export default function RoutePlanner({ routes }) {
  if (!routes || routes.length === 0) {
    return <div className="empty-note">Select a zone to inspect mountain pass and highway lifeline status.</div>;
  }
  return (
    <div className="routes">
      {routes.map((r) => {
        const isSafe = r.status === 'Safe';
        const isLandslide = r.status === 'Blocked by Landslide';

        return (
          <div className={`route-opt ${isSafe ? 'route-recommend' : ''}`} key={r.id}>
            <div className="swatch" style={{ background: COLOR[r.status] || 'var(--critical)' }}></div>
            <div className="info">
              <b>{r.name}</b>
              <span>
                {isSafe
                  ? 'Recommended by AI — open arterial corridor / bypass pass'
                  : isLandslide
                  ? 'Highway severed by landslide / rockfall — JCB clearing required'
                  : 'Hazard / slope degradation detected — proceed with caution'}
              </span>
            </div>
            <div className="status" style={{ color: COLOR[r.status] || 'var(--critical)' }}>{r.status}</div>
          </div>
        );
      })}
    </div>
  );
}
