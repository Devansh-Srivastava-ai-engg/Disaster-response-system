const express = require('express');
const cors = require('cors');
const db = require('./db');
const { withPriority, recommendAllocation } = require('./priority');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------
// ZONES  (AI Landslide & Flash Flood Risk Map)
// ---------------------------------------------------------------

// GET all zones, each annotated with live-computed predictive metrics
app.get('/api/zones', (req, res) => {
  const zones = db.prepare('SELECT * FROM zones').all().map(withPriority);
  zones.sort((a, b) => b.score - a.score);
  res.json(zones);
});

// GET a single zone by id
app.get('/api/zones/:id', (req, res) => {
  const zone = db.prepare('SELECT * FROM zones WHERE id = ?').get(req.params.id);
  if (!zone) return res.status(404).json({ error: 'Zone not found' });
  res.json(withPriority(zone));
});

// UPDATE / SIMULATE live weather & geological sensor readings for a zone
app.patch('/api/zones/:id', (req, res) => {
  const {
    rainfall_24h_mm,
    soil_saturation,
    slope_instability,
    hill_cutting_risk,
    isolated_villages,
    flood_level,
    population,
    road_status,
  } = req.body;

  const existing = db.prepare('SELECT * FROM zones WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Zone not found' });

  db.prepare(`
    UPDATE zones SET
      rainfall_24h_mm = COALESCE(?, rainfall_24h_mm),
      soil_saturation = COALESCE(?, soil_saturation),
      slope_instability = COALESCE(?, slope_instability),
      hill_cutting_risk = COALESCE(?, hill_cutting_risk),
      isolated_villages = COALESCE(?, isolated_villages),
      flood_level = COALESCE(?, flood_level),
      population = COALESCE(?, population),
      road_status = COALESCE(?, road_status)
    WHERE id = ?
  `).run(
    rainfall_24h_mm != null ? Number(rainfall_24h_mm) : null,
    soil_saturation != null ? Number(soil_saturation) : null,
    slope_instability ?? null,
    hill_cutting_risk ?? null,
    isolated_villages != null ? Number(isolated_villages) : null,
    flood_level ?? null,
    population != null ? Number(population) : null,
    road_status ?? null,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM zones WHERE id = ?').get(req.params.id);
  res.json(withPriority(updated));
});

// ---------------------------------------------------------------
// EARLY WARNING BULLETINS (NDMA / NEC Standard)
// ---------------------------------------------------------------

app.get('/api/early-warning-bulletins', (req, res) => {
  const zones = db.prepare('SELECT * FROM zones').all().map(withPriority);
  const bulletins = zones
    .filter(z => z.score >= 5.5)
    .map(z => ({
      zone_id: z.id,
      zone_name: z.name,
      state: z.state,
      alert: z.early_warning,
      hazard: z.hazard_type,
      landslide_prob: z.landslide_prob,
      rainfall: z.rainfall_24h_mm,
      isolated_villages: z.isolated_villages,
      action: z.score >= 15
        ? 'Immediate evacuation of downhill settlements & deployment of JCBs to key passes.'
        : z.score >= 10
        ? 'High alert. Heavy vehicles restricted on hill corridors; SDRF pre-positioned.'
        : 'Advisory in effect. Monitor IMD radar and avoid non-essential travel.',
      timestamp: new Date().toISOString(),
    }));
  res.json(bulletins);
});

// ---------------------------------------------------------------
// RESOURCES + DISPATCH  (Mountain Equipment Allocation)
// ---------------------------------------------------------------

app.get('/api/resources', (req, res) => {
  res.json(db.prepare('SELECT * FROM resources').all());
});

function handleAddResource(req, res) {
  const { count = 1 } = req.body;
  const key = req.params.key;

  if (key === 'reset') {
    db.prepare('UPDATE resources SET available = total').run();
    return res.json(db.prepare('SELECT * FROM resources').all());
  }

  const existing = db.prepare('SELECT * FROM resources WHERE key = ?').get(key);
  if (!existing) return res.status(404).json({ error: 'Resource type not found: ' + key });

  const addAmount = Number(count) || 1;
  db.prepare('UPDATE resources SET total = total + ?, available = available + ? WHERE key = ?')
    .run(addAmount, addAmount, key);

  res.json(db.prepare('SELECT * FROM resources').all());
}

app.patch('/api/resources/:key', handleAddResource);
app.post('/api/resources/:key', handleAddResource);

// GET AI's recommended mountain equipment allocation for a zone
app.get('/api/zones/:id/recommendation', (req, res) => {
  const zone = db.prepare('SELECT * FROM zones WHERE id = ?').get(req.params.id);
  if (!zone) return res.status(404).json({ error: 'Zone not found' });
  res.json(recommendAllocation(withPriority(zone)));
});

// POST dispatch mountain resources to a zone
app.post('/api/dispatch', (req, res) => {
  const {
    zoneId,
    earthmovers = 0,
    bailey_bridges = 0,
    mountain_teams = 0,
    drone_recon = 0,
    air_drop_kits = 0,
    ambulances = 0,
  } = req.body;

  const zone = db.prepare('SELECT * FROM zones WHERE id = ?').get(zoneId);
  if (!zone) return res.status(404).json({ error: 'Zone not found' });

  const requested = { earthmovers, bailey_bridges, mountain_teams, drone_recon, air_drop_kits, ambulances };
  const resources = db.prepare('SELECT * FROM resources').all();

  // Validate availability
  for (const key of Object.keys(requested)) {
    const r = resources.find(x => x.key === key);
    if (r && requested[key] > r.available) {
      return res.status(400).json({ error: `Not enough ${r.name} available (${r.available} in stock, requested ${requested[key]})` });
    }
  }

  const updateRes = db.prepare('UPDATE resources SET available = available - ? WHERE key = ?');
  db.exec('BEGIN');
  try {
    Object.entries(requested).forEach(([key, amount]) => {
      if (amount > 0) updateRes.run(amount, key);
    });
    const summary = Object.entries(requested)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${v} ${resources.find(r => r.key === k)?.name || k}`)
      .join(', ');

    db.prepare('INSERT INTO dispatch_log (zone_id, details) VALUES (?, ?)')
      .run(zoneId, summary || 'No mountain units dispatched');
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Dispatch failed, no changes were made' });
  }

  res.json({
    resources: db.prepare('SELECT * FROM resources').all(),
    log: db.prepare('SELECT * FROM dispatch_log ORDER BY id DESC LIMIT 10').all(),
  });
});

app.get('/api/dispatch-log', (req, res) => {
  res.json(db.prepare('SELECT * FROM dispatch_log ORDER BY id DESC LIMIT 20').all());
});

// ---------------------------------------------------------------
// ROUTES  (Mountain Pass & Highway Lifeline Status)
// ---------------------------------------------------------------

app.get('/api/zones/:id/routes', (req, res) => {
  const routes = db.prepare('SELECT * FROM routes WHERE zone_id = ?').all(req.params.id);
  res.json(routes);
});

// ---------------------------------------------------------------
// CITIZEN REPORTS  (Citizen App / Remote Hamlet SOS)
// ---------------------------------------------------------------

app.get('/api/reports', (req, res) => {
  const { user_id, all } = req.query;
  if (all === 'true') {
    return res.json(db.prepare('SELECT * FROM reports ORDER BY id DESC LIMIT 50').all());
  }
  if (user_id) {
    const reports = db.prepare('SELECT * FROM reports WHERE user_id = ? ORDER BY id DESC LIMIT 30').all(user_id);
    return res.json(reports);
  }
  res.json([]);
});

app.post('/api/reports', (req, res) => {
  const {
    user_id,
    name,
    phone,
    location,
    people,
    emergency_type,
    vulnerable,
    notes,
    medical,
    is_isolated,
    lat,
    lng,
  } = req.body;

  if (!location || !people || !emergency_type) {
    return res.status(400).json({ error: 'location, people and emergency_type are required' });
  }

  const ticket_id = 'NER-' + Math.floor(1000 + Math.random() * 9000);

  const info = db.prepare(`
    INSERT INTO reports (
      user_id, ticket_id, name, phone, location, people, emergency_type,
      vulnerable, notes, medical, is_isolated, lat, lng
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user_id || '',
    ticket_id,
    name || 'Anonymous Citizen',
    phone || 'Not Provided',
    location,
    Number(people),
    emergency_type,
    vulnerable || 'None',
    notes || '',
    medical ? 1 : 0,
    is_isolated ? 1 : 0,
    lat != null ? Number(lat) : null,
    lng != null ? Number(lng) : null
  );

  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(report);
});

// Rescuer Headquarters coordinates (NER EOC Central Base)
const HQ_LAT = 26.1445; // Guwahati / Central NER HQ
const HQ_LNG = 91.7362;

app.patch('/api/reports/:id', (req, res) => {
  const { status } = req.body;
  const existing = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Report not found' });

  db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, req.params.id);

  if (status === 'Dispatched') {
    const resourceKey = existing.medical ? 'ambulances' : 'mountain_teams';
    const resCount = db.prepare('SELECT available FROM resources WHERE key = ?').get(resourceKey);
    if (resCount && resCount.available > 0) {
      db.prepare('UPDATE resources SET available = available - 1 WHERE key = ?').run(resourceKey);
    }

    const unitName = existing.medical ? '4x4 Mountain Ambulance' : 'SDRF Mountain Rescue Team';
    const details = `Dispatched ${unitName} → ${existing.location} (${existing.name || 'Citizen'}, ${existing.people} ${existing.people > 1 ? 'people' : 'person'})`;

    const zoneMatch = existing.location.match(/Sector ([A-Z])/i);
    const zoneId = zoneMatch ? zoneMatch[1].toUpperCase() : 'A';

    db.prepare('INSERT INTO dispatch_log (zone_id, details) VALUES (?, ?)').run(zoneId, details);

    db.prepare('UPDATE reports SET rescuer_lat = ?, rescuer_lng = ? WHERE id = ?')
      .run(HQ_LAT, HQ_LNG, req.params.id);
  }

  res.json(db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id));
});

// Live rescuer position update
app.patch('/api/reports/:id/rescuer-location', (req, res) => {
  const { lat, lng } = req.body;
  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }
  const existing = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Report not found' });

  db.prepare('UPDATE reports SET rescuer_lat = ?, rescuer_lng = ? WHERE id = ?')
    .run(Number(lat), Number(lng), req.params.id);

  res.json({ id: existing.id, rescuer_lat: Number(lat), rescuer_lng: Number(lng) });
});

// ---------------------------------------------------------------
// DASHBOARD SUMMARY (NER EOC Summary)
// ---------------------------------------------------------------

app.get('/api/summary', (req, res) => {
  const zones = db.prepare('SELECT * FROM zones').all().map(withPriority);
  const resources = db.prepare('SELECT * FROM resources').all();
  const pendingReports = db.prepare(`SELECT COUNT(*) AS n FROM reports WHERE status = 'Pending'`).get().n;
  const isolatedReports = db.prepare(`SELECT COUNT(*) AS n FROM reports WHERE is_isolated = 1 AND status != 'Resolved'`).get().n;
  const totalIsolatedVillages = zones.reduce((acc, z) => acc + (z.isolated_villages || 0), 0);

  res.json({
    critical: zones.filter(z => z.priority === 'Critical').length,
    high: zones.filter(z => z.priority === 'High').length,
    safe: zones.filter(z => z.priority === 'Medium' || z.priority === 'Safe').length,
    totalIsolatedVillages,
    isolatedReports,
    resources,
    pendingReports,
  });
});

app.get('/', (req, res) => {
  res.send('NER AI Predictive Disaster Response API is running. Try GET /api/zones');
});

app.listen(PORT, () => {
  console.log(`🚨 NER Disaster Response API listening on http://localhost:${PORT}`);
});
