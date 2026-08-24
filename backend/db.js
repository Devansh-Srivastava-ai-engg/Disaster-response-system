const path = require('path');
const fs = require('fs');

const isPostgres = Boolean(process.env.DATABASE_URL);

let pool = null;
let sqliteDb = null;

if (isPostgres) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
      ? false
      : { rejectUnauthorized: false },
  });
} else {
  const { DatabaseSync } = require('node:sqlite');
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'disaster.db');
  sqliteDb = new DatabaseSync(dbPath);
}

/**
 * Universal Query Runner
 * Works seamlessly with PostgreSQL (online) and SQLite (offline / local development).
 */
async function query(sqlText, params = []) {
  if (isPostgres) {
    return pool.query(sqlText, params);
  }

  // SQLite Adapter
  let sqliteSql = sqlText;

  // Replace Postgres positional params ($1, $2, ...) with standard SQLite ?
  sqliteSql = sqliteSql.replace(/\$(\d+)/g, '?');

  // Handle RETURNING clause if present in SQLite
  const isReturning = /RETURNING\s+\*/i.test(sqliteSql);
  const cleanSql = sqliteSql.replace(/RETURNING\s+\*/i, '').trim();

  const isSelect = /^\s*SELECT/i.test(cleanSql);
  const isInsert = /^\s*INSERT/i.test(cleanSql);
  const isUpdate = /^\s*UPDATE/i.test(cleanSql);
  const isDelete = /^\s*DELETE/i.test(cleanSql);

  if (isSelect) {
    const stmt = sqliteDb.prepare(cleanSql);
    const rows = stmt.all(...params);
    return { rows, rowCount: rows.length };
  }

  if (isInsert) {
    const stmt = sqliteDb.prepare(cleanSql);
    const info = stmt.run(...params);
    if (isReturning) {
      // Find the table being inserted into
      const tableMatch = cleanSql.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)/i);
      const tableName = tableMatch ? tableMatch[1] : '';
      if (tableName && info.lastInsertRowid) {
        const row = sqliteDb.prepare(`SELECT * FROM ${tableName} WHERE rowid = ?`).get(info.lastInsertRowid);
        return { rows: row ? [row] : [], rowCount: 1 };
      }
    }
    return { rows: [], rowCount: info.changes };
  }

  if (isUpdate || isDelete) {
    const stmt = sqliteDb.prepare(cleanSql);
    const info = stmt.run(...params);
    return { rows: [], rowCount: info.changes };
  }

  // Raw DDL
  sqliteDb.exec(cleanSql);
  return { rows: [], rowCount: 0 };
}

/**
 * Universal Transaction helper
 */
async function getTransactionClient() {
  if (isPostgres) {
    const client = await pool.connect();
    return {
      query: (t, p) => client.query(t, p),
      release: () => client.release(),
      begin: () => client.query('BEGIN'),
      commit: () => client.query('COMMIT'),
      rollback: () => client.query('ROLLBACK'),
    };
  }

  // SQLite transaction
  return {
    query: (t, p) => query(t, p),
    release: () => {},
    begin: () => sqliteDb.exec('BEGIN'),
    commit: () => sqliteDb.exec('COMMIT'),
    rollback: () => sqliteDb.exec('ROLLBACK'),
  };
}

// ── Database Schema Initialisation & Seeding ──────────────────────────────────
async function initDb() {
  if (isPostgres) {
    console.log('🔗 Initialising PostgreSQL connection...');
    await query(`
      CREATE TABLE IF NOT EXISTS zones (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'NER',
        hazard_type TEXT NOT NULL DEFAULT 'Landslide / Flash Flood',
        rainfall_24h_mm REAL NOT NULL DEFAULT 45.0,
        soil_saturation INTEGER NOT NULL DEFAULT 60,
        slope_instability TEXT NOT NULL DEFAULT 'Moderate',
        hill_cutting_risk TEXT NOT NULL DEFAULT 'Moderate',
        isolated_villages INTEGER NOT NULL DEFAULT 0,
        flood_level TEXT NOT NULL,
        population INTEGER NOT NULL,
        road_status TEXT NOT NULL,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        w INTEGER NOT NULL,
        h INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS resources (
        key TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        total INTEGER NOT NULL,
        available INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        user_id TEXT DEFAULT '',
        ticket_id TEXT DEFAULT '',
        name TEXT NOT NULL DEFAULT 'Anonymous Citizen',
        phone TEXT NOT NULL DEFAULT 'Not Provided',
        location TEXT NOT NULL,
        people INTEGER NOT NULL,
        emergency_type TEXT NOT NULL,
        other_details TEXT DEFAULT '',
        vulnerable TEXT DEFAULT 'None',
        notes TEXT DEFAULT '',
        medical INTEGER NOT NULL DEFAULT 0,
        medical_details TEXT DEFAULT '',
        photo_data TEXT DEFAULT '',
        is_isolated INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Pending',
        unit_name TEXT DEFAULT '',
        eta_mins INTEGER DEFAULT 0,
        dispatched_at TEXT DEFAULT NULL,
        lat REAL DEFAULT NULL,
        lng REAL DEFAULT NULL,
        rescuer_lat REAL DEFAULT NULL,
        rescuer_lng REAL DEFAULT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL DEFAULT 'Verified Citizen',
        location TEXT NOT NULL DEFAULT 'Relief Zone',
        ticket_id TEXT DEFAULT '',
        rating INTEGER NOT NULL DEFAULT 5,
        category TEXT NOT NULL DEFAULT 'Rescue Team Response & Boat Deployment',
        comment TEXT NOT NULL,
        action_note TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS dispatch_log (
        id SERIAL PRIMARY KEY,
        zone_id TEXT NOT NULL,
        details TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS routes (
        id SERIAL PRIMARY KEY,
        zone_id TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS community_messages (
        id SERIAL PRIMARY KEY,
        user_id TEXT DEFAULT '',
        user_name TEXT NOT NULL DEFAULT 'Anonymous Citizen',
        channel TEXT NOT NULL DEFAULT 'general',
        tag TEXT NOT NULL DEFAULT 'General',
        location TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL,
        upvotes INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS shelters (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        sector_id TEXT NOT NULL DEFAULT 'A',
        location TEXT NOT NULL,
        lat REAL DEFAULT NULL,
        lng REAL DEFAULT NULL,
        capacity_total INTEGER NOT NULL DEFAULT 150,
        capacity_available INTEGER NOT NULL DEFAULT 150,
        status TEXT NOT NULL DEFAULT 'Open',
        amenities TEXT DEFAULT 'Clean Water, Hot Food, First Aid, Power Backup',
        contact_person TEXT DEFAULT 'NDRF Relief Officer',
        contact_phone TEXT DEFAULT '+91 98765 43210',
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } else {
    console.log('💾 Initialising local SQLite database (disaster.db)...');
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS zones (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'NER',
        hazard_type TEXT NOT NULL DEFAULT 'Landslide / Flash Flood',
        rainfall_24h_mm REAL NOT NULL DEFAULT 45.0,
        soil_saturation INTEGER NOT NULL DEFAULT 60,
        slope_instability TEXT NOT NULL DEFAULT 'Moderate',
        hill_cutting_risk TEXT NOT NULL DEFAULT 'Moderate',
        isolated_villages INTEGER NOT NULL DEFAULT 0,
        flood_level TEXT NOT NULL,
        population INTEGER NOT NULL,
        road_status TEXT NOT NULL,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        w INTEGER NOT NULL,
        h INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS resources (
        key TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        total INTEGER NOT NULL,
        available INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT DEFAULT '',
        ticket_id TEXT DEFAULT '',
        name TEXT NOT NULL DEFAULT 'Anonymous Citizen',
        phone TEXT NOT NULL DEFAULT 'Not Provided',
        location TEXT NOT NULL,
        people INTEGER NOT NULL,
        emergency_type TEXT NOT NULL,
        other_details TEXT DEFAULT '',
        vulnerable TEXT DEFAULT 'None',
        notes TEXT DEFAULT '',
        medical INTEGER NOT NULL DEFAULT 0,
        medical_details TEXT DEFAULT '',
        photo_data TEXT DEFAULT '',
        is_isolated INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Pending',
        unit_name TEXT DEFAULT '',
        eta_mins INTEGER DEFAULT 0,
        dispatched_at TEXT DEFAULT NULL,
        lat REAL DEFAULT NULL,
        lng REAL DEFAULT NULL,
        rescuer_lat REAL DEFAULT NULL,
        rescuer_lng REAL DEFAULT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL DEFAULT 'Verified Citizen',
        location TEXT NOT NULL DEFAULT 'Relief Zone',
        ticket_id TEXT DEFAULT '',
        rating INTEGER NOT NULL DEFAULT 5,
        category TEXT NOT NULL DEFAULT 'Rescue Team Response & Boat Deployment',
        comment TEXT NOT NULL,
        action_note TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS dispatch_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        zone_id TEXT NOT NULL,
        details TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        zone_id TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS community_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT DEFAULT '',
        user_name TEXT NOT NULL DEFAULT 'Anonymous Citizen',
        channel TEXT NOT NULL DEFAULT 'general',
        tag TEXT NOT NULL DEFAULT 'General',
        location TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL,
        upvotes INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS shelters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sector_id TEXT NOT NULL DEFAULT 'A',
        location TEXT NOT NULL,
        lat REAL DEFAULT NULL,
        lng REAL DEFAULT NULL,
        capacity_total INTEGER NOT NULL DEFAULT 150,
        capacity_available INTEGER NOT NULL DEFAULT 150,
        status TEXT NOT NULL DEFAULT 'Open',
        amenities TEXT DEFAULT 'Clean Water, Hot Food, First Aid, Power Backup',
        contact_person TEXT DEFAULT 'NDRF Relief Officer',
        contact_phone TEXT DEFAULT '+91 98765 43210',
        notes TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  // Seed zones if table is empty
  const { rows: zoneRows } = await query('SELECT COUNT(*) AS count FROM zones');
  const zoneCount = Number(zoneRows[0]?.count || 0);
  if (zoneCount === 0) {
    await seedZones();
  }

  // Seed resources if table is empty
  const { rows: resRows } = await query('SELECT COUNT(*) AS count FROM resources');
  const resCount = Number(resRows[0]?.count || 0);
  if (resCount === 0) {
    await seedResources();
  }

  // Seed routes if table is empty
  const { rows: routeRows } = await query('SELECT COUNT(*) AS count FROM routes');
  const routeCount = Number(routeRows[0]?.count || 0);
  if (routeCount === 0) {
    await seedRoutes();
  }

  // Seed sample feedback if table is empty
  const { rows: fbRows } = await query('SELECT COUNT(*) AS count FROM feedback');
  const fbCount = Number(fbRows[0]?.count || 0);
  if (fbCount === 0) {
    await seedFeedback();
  }

  // Seed sample community messages if table is empty
  const { rows: chatRows } = await query('SELECT COUNT(*) AS count FROM community_messages');
  const chatCount = Number(chatRows[0]?.count || 0);
  if (chatCount === 0) {
    await seedCommunityMessages();
  }

  // Seed sample shelters if table is empty
  const { rows: shelterRows } = await query('SELECT COUNT(*) AS count FROM shelters');
  const shelterCount = Number(shelterRows[0]?.count || 0);
  if (shelterCount === 0) {
    await seedShelters();
  }

  console.log(`✅ Database ready (${isPostgres ? 'PostgreSQL' : 'SQLite Local'}).`);
}

// ── Seed helpers ─────────────────────────────────────────────────────────────
async function seedZones() {
  const zones = [
    { id: 'A', name: 'Sector A — Dima Hasao & Haflong Hills', state: 'Assam', hazard_type: 'Severe Landslide & Railway Breach', rainfall_24h_mm: 220.0, soil_saturation: 94, slope_instability: 'Extreme', hill_cutting_risk: 'Critical', isolated_villages: 6, flood_level: 'High', population: 4800, road_status: 'Blocked', x: 20, y: 20, w: 180, h: 120 },
    { id: 'B', name: 'Sector B — Sohra / East Khasi Hills', state: 'Meghalaya', hazard_type: 'Flash Flood & Slope Erosion', rainfall_24h_mm: 310.0, soil_saturation: 88, slope_instability: 'High', hill_cutting_risk: 'High', isolated_villages: 3, flood_level: 'High', population: 3200, road_status: 'Damaged', x: 210, y: 20, w: 180, h: 120 },
    { id: 'C', name: 'Sector C — Teesta Valley & Mangan', state: 'Sikkim', hazard_type: 'GLOF / Flash Flood & NH-10 Breach', rainfall_24h_mm: 195.0, soil_saturation: 91, slope_instability: 'Extreme', hill_cutting_risk: 'High', isolated_villages: 5, flood_level: 'High', population: 2100, road_status: 'Blocked', x: 400, y: 20, w: 180, h: 120 },
    { id: 'D', name: 'Sector D — Kameng - Tawang Corridor', state: 'Arunachal Pradesh', hazard_type: 'Cloudburst & Road Sinking', rainfall_24h_mm: 95.0, soil_saturation: 68, slope_instability: 'Moderate', hill_cutting_risk: 'Moderate', isolated_villages: 2, flood_level: 'Medium', population: 1600, road_status: 'Damaged', x: 20, y: 150, w: 180, h: 130 },
    { id: 'E', name: 'Sector E — Kohima - Imphal NH-29', state: 'Nagaland / Manipur', hazard_type: 'Subsidence & Mudslide Blockade', rainfall_24h_mm: 65.0, soil_saturation: 58, slope_instability: 'Moderate', hill_cutting_risk: 'Moderate', isolated_villages: 1, flood_level: 'Low', population: 2900, road_status: 'Open', x: 210, y: 150, w: 180, h: 130 },
    { id: 'F', name: 'Sector F — Aizawl Urban Slopes', state: 'Mizoram', hazard_type: 'Unplanned Hill Cutting Subsidence', rainfall_24h_mm: 140.0, soil_saturation: 82, slope_instability: 'High', hill_cutting_risk: 'Critical', isolated_villages: 0, flood_level: 'Medium', population: 5200, road_status: 'Damaged', x: 400, y: 150, w: 180, h: 130 },
  ];
  for (const z of zones) {
    if (isPostgres) {
      await query(
        `INSERT INTO zones (id,name,state,hazard_type,rainfall_24h_mm,soil_saturation,slope_instability,hill_cutting_risk,isolated_villages,flood_level,population,road_status,x,y,w,h)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (id) DO NOTHING`,
        [z.id,z.name,z.state,z.hazard_type,z.rainfall_24h_mm,z.soil_saturation,z.slope_instability,z.hill_cutting_risk,z.isolated_villages,z.flood_level,z.population,z.road_status,z.x,z.y,z.w,z.h]
      );
    } else {
      sqliteDb.prepare(`
        INSERT OR IGNORE INTO zones (id,name,state,hazard_type,rainfall_24h_mm,soil_saturation,slope_instability,hill_cutting_risk,isolated_villages,flood_level,population,road_status,x,y,w,h)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(z.id,z.name,z.state,z.hazard_type,z.rainfall_24h_mm,z.soil_saturation,z.slope_instability,z.hill_cutting_risk,z.isolated_villages,z.flood_level,z.population,z.road_status,z.x,z.y,z.w,z.h);
    }
  }
}

async function seedResources() {
  const resources = [
    { key: 'earthmovers',    name: 'JCB / Excavators',        icon: '🚜', total: 15, available: 15 },
    { key: 'bailey_bridges', name: 'Bailey Bridge Units',     icon: '🌉', total: 10, available: 10 },
    { key: 'mountain_teams', name: 'Mountain SDRF / NDRF',    icon: '🧗', total: 25, available: 25 },
    { key: 'drone_recon',    name: 'AI Recon Drones',         icon: '🚁', total: 12, available: 12 },
    { key: 'air_drop_kits',  name: 'Air-Drop Relief Kits',    icon: '📦', total: 50, available: 50 },
    { key: 'ambulances',     name: '4x4 Mountain Ambulances', icon: '🚑', total: 20, available: 20 },
  ];
  for (const r of resources) {
    if (isPostgres) {
      await query(
        `INSERT INTO resources (key,name,icon,total,available)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (key) DO NOTHING`,
        [r.key, r.name, r.icon, r.total, r.available]
      );
    } else {
      sqliteDb.prepare(`
        INSERT OR IGNORE INTO resources (key,name,icon,total,available)
        VALUES (?,?,?,?,?)
      `).run(r.key, r.name, r.icon, r.total, r.available);
    }
  }
}

async function seedRoutes() {
  const routeData = {
    A: [
      { name: 'NH-27 / Haflong-Silchar Highway',    status: 'Blocked by Landslide' },
      { name: 'Lumding-Badarpur Hill Bypass',        status: 'Damaged' },
      { name: 'Maibang Ridge Safe Pass',             status: 'Safe' },
    ],
    B: [
      { name: 'Shillong - Cherrapunji Highway (NH-106)', status: 'Damaged' },
      { name: 'Mawkdok Gorge Bypass',                    status: 'Flooded' },
      { name: 'Mawphlang Highland Corridor',             status: 'Safe' },
    ],
    C: [
      { name: 'NH-10 Sevoke - Gangtok Arterial',    status: 'Blocked by Landslide' },
      { name: 'Lava - Algarah Forest Bypass',        status: 'Damaged' },
      { name: 'Reshi-Rongli Alternative Pass',       status: 'Safe' },
    ],
    D: [
      { name: 'Bhalukpong - Tawang Axis (NH-13)',   status: 'Damaged' },
      { name: 'Orang - Kalaktang Corridor',          status: 'Safe' },
      { name: 'Dirang Sinking Zone Road',            status: 'Blocked by Landslide' },
    ],
    E: [
      { name: 'NH-29 Dimapur - Kohima Highway',     status: 'Safe' },
      { name: 'Pfutsero - Tadubi Hill Track',        status: 'Damaged' },
      { name: 'Mao - Senapati Corridor',             status: 'Safe' },
    ],
    F: [
      { name: 'Aizawl - Sairang NH-54 Axis',        status: 'Damaged' },
      { name: 'Tuirial Valley Route',                status: 'Flooded' },
      { name: 'Durtlang Ridge Highway',              status: 'Safe' },
    ],
  };
  for (const [zoneId, routes] of Object.entries(routeData)) {
    for (const r of routes) {
      if (isPostgres) {
        await query(
          `INSERT INTO routes (zone_id, name, status) VALUES ($1, $2, $3)`,
          [zoneId, r.name, r.status]
        );
      } else {
        sqliteDb.prepare(`
          INSERT INTO routes (zone_id, name, status) VALUES (?, ?, ?)
        `).run(zoneId, r.name, r.status);
      }
    }
  }
}

async function seedFeedback() {
  const items = [
    { name: 'Rajesh Sharma & Family', location: 'Kashmere Gate ISBT Sector', ticket_id: 'SOS-901', rating: 5, category: 'Rescue Team Response & Boat Deployment', comment: 'NDRF 8th Battalion boat reached our rooftop within 22 mins during the high flood surge. Oxygen support provided immediately to my father. Grateful to the whole team!', action_note: 'Action acknowledged by EOC-9 Commander. Rescued party safely transferred to Relief Camp 04.' },
    { name: 'Sunita Devi & Community', location: 'Yamuna Bazaar Lowland', ticket_id: 'SOS-842', rating: 5, category: 'Relief Shelter & Food Supply', comment: 'Clean drinking water, hot meals, and dry milk powder for infants delivered with zero delay at the Nigam Bodh Shelter.', action_note: 'District Magistrate Food Quality Inspection verified & acknowledged.' },
    { name: 'Tenzing Norbu', location: 'Haflong Hill Cut Pass', ticket_id: 'NER-1044', rating: 4, category: 'Rescue Team Response & Boat Deployment', comment: 'JCB earthmovers and SDRF team cleared the major rockfall blockage in less than 45 minutes, allowing stranded vehicles to pass safely.', action_note: 'Highways Emergency Division cleared pass and established continuous drone watch.' },
  ];
  for (const fb of items) {
    if (isPostgres) {
      await query(
        `INSERT INTO feedback (name,location,ticket_id,rating,category,comment,action_note)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [fb.name, fb.location, fb.ticket_id, fb.rating, fb.category, fb.comment, fb.action_note]
      );
    } else {
      sqliteDb.prepare(`
        INSERT INTO feedback (name,location,ticket_id,rating,category,comment,action_note)
        VALUES (?,?,?,?,?,?,?)
      `).run(fb.name, fb.location, fb.ticket_id, fb.rating, fb.category, fb.comment, fb.action_note);
    }
  }
}

async function seedCommunityMessages() {
  const messages = [
    {
      user_id: 'usr_seed_01',
      user_name: 'Anand Verma',
      channel: 'general',
      tag: 'Emergency Update',
      location: 'Sector A — Haflong Lower Ridge',
      message: 'Water levels starting to recede near the lower marketplace, but debris is still blocking two-wheeler passage. Stay uphill!',
      upvotes: 8,
    },
    {
      user_id: 'usr_seed_02',
      user_name: 'Dr. Priya Sengupta',
      channel: 'mutual-aid',
      tag: 'Offering Aid / Shelter',
      location: 'Sector B — Community Health Hall',
      message: 'We have basic first aid kits, clean ORS packets, and spare mobile power banks available here for anyone stranded near Sohra East.',
      upvotes: 14,
    },
    {
      user_id: 'usr_seed_03',
      user_name: 'Rohan Mehra',
      channel: 'shelter-alerts',
      tag: 'Safe Routes & Shelter',
      location: 'Sector C — Teesta Valley / Mangan Pass',
      message: 'The Reshi-Rongli alternative pass is currently open and confirmed safe for light vehicles. Avoid Sevoke arterial road.',
      upvotes: 19,
    },
    {
      user_id: 'usr_seed_04',
      user_name: 'Local Volunteer Team',
      channel: 'mutual-aid',
      tag: 'Need Help / Supplies',
      location: 'Sector D — Tawang Corridor Point 4',
      message: 'Urgent: Looking for dry baby formula and warm blankets for 3 families sheltering at Government Middle School.',
      upvotes: 11,
    },
    {
      user_id: 'usr_seed_05',
      user_name: 'Lalramchhani',
      channel: 'sector-f',
      tag: 'Emergency Update',
      location: 'Sector F — Durtlang Ridge High School',
      message: 'Relief distribution truck just arrived at Durtlang Ridge. Clean drinking water packets are being distributed right now.',
      upvotes: 15,
    },
    {
      user_id: 'usr_seed_06',
      user_name: 'Sunil Chettri',
      channel: 'general',
      tag: 'General Check-in',
      location: 'Sector A — Railway Colony',
      message: 'Everyone in Block 4 is safe on the upper community floor. NDRF boat was spotted 500m away.',
      upvotes: 6,
    },
  ];

  for (const m of messages) {
    if (isPostgres) {
      await query(
        `INSERT INTO community_messages (user_id, user_name, channel, tag, location, message, upvotes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [m.user_id, m.user_name, m.channel, m.tag, m.location, m.message, m.upvotes]
      );
    } else {
      sqliteDb.prepare(`
        INSERT INTO community_messages (user_id, user_name, channel, tag, location, message, upvotes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(m.user_id, m.user_name, m.channel, m.tag, m.location, m.message, m.upvotes);
    }
  }
}

async function seedShelters() {
  const shelters = [
    {
      name: 'Haflong Highland Multi-Purpose Relief Camp',
      sector_id: 'A',
      location: 'Haflong Central Hill School Complex, Sector A, Assam',
      lat: 25.1685,
      lng: 93.0234,
      capacity_total: 350,
      capacity_available: 180,
      status: 'Open',
      amenities: 'Clean Water, Hot Meals, First Aid, Solar Power, Blankets, Infant Rations',
      contact_person: 'Capt. Bikram Barman',
      contact_phone: '+91 94350 11223',
      notes: 'Reinforced elevated hilltop structure. Accessible via Maibang Ridge safe pass.',
    },
    {
      name: 'Sohra Highland Disaster Relief Center',
      sector_id: 'B',
      location: 'Mawphlang Community Shelter Hall, Sector B, Meghalaya',
      lat: 25.2986,
      lng: 91.7324,
      capacity_total: 250,
      capacity_available: 90,
      status: 'Open',
      amenities: 'Filtered Water, Dry Rations, Emergency Oxygen, Mobile Charging, Bedding Kits',
      contact_person: 'Inspector L. Kharkongor',
      contact_phone: '+91 98620 33445',
      notes: 'High plateau area clear of flash floods. Pre-positioned SDRF medical team.',
    },
    {
      name: 'Teesta Valley Safe Haven Camp',
      sector_id: 'C',
      location: 'Rongli Senior Secondary Complex, Sector C, Sikkim',
      lat: 27.2023,
      lng: 88.6012,
      capacity_total: 200,
      capacity_available: 45,
      status: 'Near Capacity',
      amenities: 'Water Tanker, Medical Doctor, Warm Blankets, Satellite Phone Terminal',
      contact_person: 'Maj. T. Lepcha',
      contact_phone: '+91 97330 55667',
      notes: 'Reached via Reshi-Rongli safe road bypass. Avoid Sevoke highway.',
    },
    {
      name: 'Dirang Monastic Rescue Shelter',
      sector_id: 'D',
      location: 'Dirang Community Ground, Sector D, Arunachal Pradesh',
      lat: 27.3590,
      lng: 92.2350,
      capacity_total: 180,
      capacity_available: 120,
      status: 'Open',
      amenities: 'Clean Water, Heated Hall, Military Ration Packs, Paramedic Station',
      contact_person: 'Subedar K. Dorjee',
      contact_phone: '+91 94020 77889',
      notes: 'Reinforced monastery building outside active rockfall zone.',
    },
    {
      name: 'Kohima Peace Memorial Relief Camp',
      sector_id: 'E',
      location: 'Naga Peace Community Hall, Sector E, Kohima',
      lat: 25.6751,
      lng: 94.1086,
      capacity_total: 300,
      capacity_available: 210,
      status: 'Open',
      amenities: 'Potable Water, Hot Meals, First Aid, Mobile Charging, Sanitation Units',
      contact_person: 'Asst. Cmdt. V. Angami',
      contact_phone: '+91 98560 99001',
      notes: 'Directly linked to open NH-29 corridor. Continuous water supply.',
    },
    {
      name: 'Durtlang Ridge Safe Relief Complex',
      sector_id: 'F',
      location: 'Durtlang Higher Secondary & Community Hall, Sector F, Aizawl',
      lat: 23.7780,
      lng: 92.7350,
      capacity_total: 400,
      capacity_available: 280,
      status: 'Open',
      amenities: '24x7 Water, Community Kitchen, Oxygen Concentrators, Power Inverters, Infant Care',
      contact_person: 'Maj. Zoramthanga',
      contact_phone: '+91 94361 22334',
      notes: 'Solid rock foundation ridge safe from subsidence landslides.',
    },
  ];

  for (const s of shelters) {
    if (isPostgres) {
      await query(
        `INSERT INTO shelters (name, sector_id, location, lat, lng, capacity_total, capacity_available, status, amenities, contact_person, contact_phone, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [s.name, s.sector_id, s.location, s.lat, s.lng, s.capacity_total, s.capacity_available, s.status, s.amenities, s.contact_person, s.contact_phone, s.notes]
      );
    } else {
      sqliteDb.prepare(`
        INSERT INTO shelters (name, sector_id, location, lat, lng, capacity_total, capacity_available, status, amenities, contact_person, contact_phone, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(s.name, s.sector_id, s.location, s.lat, s.lng, s.capacity_total, s.capacity_available, s.status, s.amenities, s.contact_person, s.contact_phone, s.notes);
    }
  }
}

module.exports = { query, getTransactionClient, initDb };
