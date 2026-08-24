const express = require('express');
const cors = require('cors');
const { query: q, getTransactionClient, initDb } = require('./db');
const { withPriority, recommendAllocation } = require('./priority');

const app = express();
const PORT = process.env.PORT || 4000;

// ── CORS: restrict to your deployed frontend domains in production ──────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : true; // allow all during local development

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '15mb' }));

// ── Startup: initialise schema & seed ────────────────────────────────────────
initDb().catch(err => {
  console.error('❌ Database init failed:', err.message);
  process.exit(1);
});

// ── ZONES ────────────────────────────────────────────────────────────────────

app.get('/api/zones', async (req, res) => {
  try {
    const { rows } = await q('SELECT * FROM zones');
    const zones = rows.map(withPriority).sort((a, b) => b.score - a.score);
    res.json(zones);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/zones/:id', async (req, res) => {
  try {
    const { rows } = await q('SELECT * FROM zones WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Zone not found' });
    res.json(withPriority(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/zones/:id', async (req, res) => {
  try {
    const { rainfall_24h_mm, soil_saturation, slope_instability, hill_cutting_risk,
            isolated_villages, flood_level, population, road_status } = req.body;

    const { rows: existing } = await q('SELECT * FROM zones WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Zone not found' });

    await q(`
      UPDATE zones SET
        rainfall_24h_mm   = COALESCE($1, rainfall_24h_mm),
        soil_saturation   = COALESCE($2, soil_saturation),
        slope_instability = COALESCE($3, slope_instability),
        hill_cutting_risk = COALESCE($4, hill_cutting_risk),
        isolated_villages = COALESCE($5, isolated_villages),
        flood_level       = COALESCE($6, flood_level),
        population        = COALESCE($7, population),
        road_status       = COALESCE($8, road_status)
      WHERE id = $9
    `, [
      rainfall_24h_mm != null ? Number(rainfall_24h_mm) : null,
      soil_saturation != null ? Number(soil_saturation) : null,
      slope_instability ?? null,
      hill_cutting_risk ?? null,
      isolated_villages != null ? Number(isolated_villages) : null,
      flood_level ?? null,
      population != null ? Number(population) : null,
      road_status ?? null,
      req.params.id,
    ]);

    const { rows: updated } = await q('SELECT * FROM zones WHERE id = $1', [req.params.id]);
    res.json(withPriority(updated[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── EARLY WARNING BULLETINS ──────────────────────────────────────────────────

app.get('/api/early-warning-bulletins', async (req, res) => {
  try {
    const { rows } = await q('SELECT * FROM zones');
    const bulletins = rows
      .map(withPriority)
      .filter(z => z.score >= 5.5)
      .map(z => ({
        zone_id: z.id, zone_name: z.name, state: z.state,
        alert: z.early_warning, hazard: z.hazard_type,
        landslide_prob: z.landslide_prob, rainfall: z.rainfall_24h_mm,
        isolated_villages: z.isolated_villages,
        action: z.score >= 15
          ? 'Immediate evacuation of downhill settlements & deployment of JCBs to key passes.'
          : z.score >= 10
          ? 'High alert. Heavy vehicles restricted on hill corridors; SDRF pre-positioned.'
          : 'Advisory in effect. Monitor IMD radar and avoid non-essential travel.',
        timestamp: new Date().toISOString(),
      }));
    res.json(bulletins);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── RESOURCES ────────────────────────────────────────────────────────────────

app.get('/api/resources', async (req, res) => {
  try {
    const { rows } = await q('SELECT * FROM resources');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

async function handleAddResource(req, res) {
  try {
    const { count = 1 } = req.body;
    const key = req.params.key;

    if (key === 'reset') {
      await q('UPDATE resources SET available = total');
      const { rows } = await q('SELECT * FROM resources');
      return res.json(rows);
    }

    const { rows: existing } = await q('SELECT * FROM resources WHERE key = $1', [key]);
    if (!existing[0]) return res.status(404).json({ error: 'Resource type not found: ' + key });

    const addAmount = Number(count) || 1;
    await q('UPDATE resources SET total = total + $1, available = available + $1 WHERE key = $2', [addAmount, key]);
    const { rows } = await q('SELECT * FROM resources');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

app.patch('/api/resources/:key', handleAddResource);
app.post('/api/resources/:key', handleAddResource);

app.get('/api/zones/:id/recommendation', async (req, res) => {
  try {
    const { rows } = await q('SELECT * FROM zones WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Zone not found' });
    res.json(recommendAllocation(withPriority(rows[0])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/dispatch', async (req, res) => {
  const { zoneId, earthmovers = 0, bailey_bridges = 0, mountain_teams = 0,
          drone_recon = 0, air_drop_kits = 0, ambulances = 0 } = req.body;

  const client = await getTransactionClient();
  try {
    const { rows: zoneRows } = await client.query('SELECT * FROM zones WHERE id = $1', [zoneId]);
    if (!zoneRows[0]) return res.status(404).json({ error: 'Zone not found' });

    const requested = { earthmovers, bailey_bridges, mountain_teams, drone_recon, air_drop_kits, ambulances };
    const { rows: resources } = await client.query('SELECT * FROM resources');

    for (const [key, amount] of Object.entries(requested)) {
      const r = resources.find(x => x.key === key);
      if (r && amount > r.available) {
        return res.status(400).json({ error: `Not enough ${r.name} available (${r.available} in stock, requested ${amount})` });
      }
    }

    await client.begin();
    for (const [key, amount] of Object.entries(requested)) {
      if (amount > 0) {
        await client.query('UPDATE resources SET available = available - $1 WHERE key = $2', [amount, key]);
      }
    }

    const summary = Object.entries(requested)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${v} ${resources.find(r => r.key === k)?.name || k}`)
      .join(', ');

    await client.query('INSERT INTO dispatch_log (zone_id, details) VALUES ($1, $2)', [zoneId, summary || 'No mountain units dispatched']);
    await client.commit();

    const { rows: updatedResources } = await client.query('SELECT * FROM resources');
    const { rows: log } = await client.query('SELECT * FROM dispatch_log ORDER BY id DESC LIMIT 10');
    res.json({ resources: updatedResources, log });
  } catch (e) {
    await client.rollback();
    res.status(500).json({ error: 'Dispatch failed: ' + e.message });
  } finally {
    client.release();
  }
});

app.get('/api/dispatch-log', async (req, res) => {
  try {
    const { rows } = await q('SELECT * FROM dispatch_log ORDER BY id DESC LIMIT 20');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ROUTES ───────────────────────────────────────────────────────────────────

app.get('/api/zones/:id/routes', async (req, res) => {
  try {
    const { rows } = await q('SELECT * FROM routes WHERE zone_id = $1', [req.params.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CITIZEN REPORTS ──────────────────────────────────────────────────────────

app.get('/api/reports', async (req, res) => {
  try {
    const { user_id, all } = req.query;
    if (all === 'true') {
      const { rows } = await q('SELECT * FROM reports ORDER BY id DESC LIMIT 50');
      return res.json(rows);
    }
    if (user_id) {
      const { rows } = await q('SELECT * FROM reports WHERE user_id = $1 ORDER BY id DESC LIMIT 30', [user_id]);
      return res.json(rows);
    }
    res.json([]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reports', async (req, res) => {
  try {
    const { user_id, name, phone, location, people, emergency_type, other_details,
            vulnerable, notes, medical, medical_details, photo_data, is_isolated, lat, lng } = req.body;

    if (!location || !people || !emergency_type) {
      return res.status(400).json({ error: 'location, people and emergency_type are required' });
    }

    const ticket_id = 'SOS-' + Math.floor(100 + Math.random() * 900);

    const { rows } = await q(`
      INSERT INTO reports (
        user_id, ticket_id, name, phone, location, people, emergency_type,
        other_details, vulnerable, notes, medical, medical_details, photo_data,
        is_isolated, lat, lng
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *
    `, [
      user_id || '', ticket_id,
      name || 'Anonymous Citizen', phone || 'Not Provided',
      location, Number(people), emergency_type,
      other_details || '', vulnerable || 'None', notes || '',
      medical ? 1 : 0, medical_details || '', photo_data || '',
      is_isolated ? 1 : 0,
      lat != null ? Number(lat) : null,
      lng != null ? Number(lng) : null,
    ]);

    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const HQ_LAT = 26.1445;
const HQ_LNG = 91.7362;

app.patch('/api/reports/:id', async (req, res) => {
  try {
    const { status, unit_name, eta_mins } = req.body;
    const { rows: existing } = await q('SELECT * FROM reports WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Report not found' });

    const r = existing[0];
    const assignedUnit = unit_name || r.unit_name || (r.medical ? 'CATS Mobile ICU Ambulance 108 (Paramedic Team)' : 'NDRF 8th Battalion - Zodiac Boat 04 (Flood Rescue)');
    const computedEta = eta_mins != null ? Number(eta_mins) : (r.eta_mins || Math.floor(15 + Math.random() * 15));
    const dispatchedAt = status === 'Dispatched' ? new Date().toISOString() : r.dispatched_at;

    await q(`
      UPDATE reports SET status = $1, unit_name = $2, eta_mins = $3, dispatched_at = $4 WHERE id = $5
    `, [status, assignedUnit, computedEta, dispatchedAt, req.params.id]);

    if (status === 'Dispatched') {
      const resourceKey = r.medical ? 'ambulances' : 'mountain_teams';
      const { rows: resRows } = await q('SELECT available FROM resources WHERE key = $1', [resourceKey]);
      if (resRows[0] && resRows[0].available > 0) {
        await q('UPDATE resources SET available = available - 1 WHERE key = $1', [resourceKey]);
      }

      const details = `Dispatched ${assignedUnit} → ${r.location} (${r.name || 'Citizen'}, ${r.people} persons, ETA: ~${computedEta}m)`;
      const zoneMatch = (r.location || '').match(/Sector ([A-Z])/i);
      const zoneId = zoneMatch ? zoneMatch[1].toUpperCase() : 'A';
      await q('INSERT INTO dispatch_log (zone_id, details) VALUES ($1, $2)', [zoneId, details]);
      await q('UPDATE reports SET rescuer_lat = $1, rescuer_lng = $2 WHERE id = $3', [HQ_LAT, HQ_LNG, req.params.id]);
    }

    const { rows: updated } = await q('SELECT * FROM reports WHERE id = $1', [req.params.id]);
    res.json(updated[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/reports/:id/rescuer-location', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat == null || lng == null) return res.status(400).json({ error: 'lat and lng are required' });
    await q('UPDATE reports SET rescuer_lat = $1, rescuer_lng = $2 WHERE id = $3', [Number(lat), Number(lng), req.params.id]);
    res.json({ id: Number(req.params.id), rescuer_lat: Number(lat), rescuer_lng: Number(lng) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── FEEDBACK ─────────────────────────────────────────────────────────────────

app.get('/api/feedback', async (req, res) => {
  try {
    const { rows } = await q('SELECT * FROM feedback ORDER BY id DESC LIMIT 50');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/feedback', async (req, res) => {
  try {
    const { name, location, ticket_id, rating = 5, category, comment } = req.body;
    if (!comment) return res.status(400).json({ error: 'Feedback comment is required' });

    const { rows } = await q(`
      INSERT INTO feedback (name, location, ticket_id, rating, category, comment, action_note)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [
      name || 'Verified Citizen',
      location || 'Disaster Relief Sector',
      ticket_id || '',
      Number(rating) || 5,
      category || 'Rescue Team Response & Boat Deployment',
      comment,
      'Action logged with EOC Ground Coordination Officer.',
    ]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/feedback/:id/action-note', async (req, res) => {
  try {
    const { action_note } = req.body;
    const { rows: existing } = await q('SELECT * FROM feedback WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Feedback not found' });
    await q('UPDATE feedback SET action_note = $1 WHERE id = $2', [action_note || '', req.params.id]);
    const { rows } = await q('SELECT * FROM feedback WHERE id = $1', [req.params.id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CITIZEN COMMUNITY EMERGENCY CHAT ─────────────────────────────────────────

app.get('/api/chat', async (req, res) => {
  try {
    const { channel, limit = 60 } = req.query;
    const lim = Math.min(Number(limit) || 60, 100);

    let sql = 'SELECT * FROM community_messages';
    let params = [];

    if (channel && channel !== 'all') {
      sql += ' WHERE channel = $1';
      params.push(channel);
    }

    sql += ` ORDER BY id ASC LIMIT ${lim}`;

    const { rows } = await q(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { user_id, user_name, channel, tag, location, message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const { rows } = await q(`
      INSERT INTO community_messages (user_id, user_name, channel, tag, location, message, upvotes)
      VALUES ($1, $2, $3, $4, $5, $6, 0)
      RETURNING *
    `, [
      user_id || '',
      user_name?.trim() || 'Anonymous Citizen',
      channel?.trim() || 'general',
      tag?.trim() || 'General',
      location?.trim() || 'Disaster Zone',
      message.trim(),
    ]);

    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/chat/:id/upvote', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: existing } = await q('SELECT * FROM community_messages WHERE id = $1', [id]);
    if (!existing[0]) return res.status(404).json({ error: 'Message not found' });

    await q('UPDATE community_messages SET upvotes = upvotes + 1 WHERE id = $1', [id]);
    const { rows } = await q('SELECT * FROM community_messages WHERE id = $1', [id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SUMMARY ──────────────────────────────────────────────────────────────────

app.get('/api/summary', async (req, res) => {
  try {
    const [{ rows: zones }, { rows: resources }, { rows: allReports }] = await Promise.all([
      q('SELECT * FROM zones'),
      q('SELECT * FROM resources'),
      q('SELECT * FROM reports'),
    ]);

    const enriched = zones.map(withPriority);
    const pendingReports   = allReports.filter(r => r.status === 'Pending').length;
    const dispatchedReports = allReports.filter(r => r.status === 'Dispatched').length;
    const resolvedReports  = allReports.filter(r => r.status === 'Resolved');
    const rescuedCount     = resolvedReports.reduce((acc, r) => acc + (r.people || 1), 0) + 56;
    const isolatedReports  = allReports.filter(r => r.is_isolated == 1 && r.status !== 'Resolved').length;
    const totalIsolatedVillages = enriched.reduce((acc, z) => acc + (z.isolated_villages || 0), 0);

    res.json({
      critical: enriched.filter(z => z.priority === 'Critical').length,
      high: enriched.filter(z => z.priority === 'High').length,
      safe: enriched.filter(z => z.priority === 'Medium' || z.priority === 'Safe').length,
      activeSOS: allReports.filter(r => r.status !== 'Resolved').length,
      pendingUrgent: pendingReports,
      citizensRescued: rescuedCount,
      monitoredSectors: enriched.length,
      totalIsolatedVillages,
      isolatedReports,
      resources,
      pendingReports,
      dispatchedReports,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/', (req, res) => {
  res.send('National Disaster Response Portal API is running. Try GET /api/zones');
});

app.listen(PORT, () => {
  console.log(`🚨 National Disaster Response API listening on http://localhost:${PORT}`);
});
