const db = require('./db');

// Recreate schema cleanly for fresh seed
db.exec(`
  DROP TABLE IF EXISTS routes;
  DROP TABLE IF EXISTS dispatch_log;
  DROP TABLE IF EXISTS reports;
  DROP TABLE IF EXISTS resources;
  DROP TABLE IF EXISTS zones;

  CREATE TABLE zones (
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

  CREATE TABLE resources (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    total INTEGER NOT NULL,
    available INTEGER NOT NULL
  );

  CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT '',
    ticket_id TEXT DEFAULT '',
    name TEXT NOT NULL DEFAULT 'Anonymous Citizen',
    phone TEXT NOT NULL DEFAULT 'Not Provided',
    location TEXT NOT NULL,
    people INTEGER NOT NULL,
    emergency_type TEXT NOT NULL,
    vulnerable TEXT DEFAULT 'None',
    notes TEXT DEFAULT '',
    medical INTEGER NOT NULL DEFAULT 0,
    is_isolated INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending',
    lat REAL DEFAULT NULL,
    lng REAL DEFAULT NULL,
    rescuer_lat REAL DEFAULT NULL,
    rescuer_lng REAL DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE dispatch_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL
  );
`);

const insertZone = db.prepare(`
  INSERT INTO zones (
    id, name, state, hazard_type, rainfall_24h_mm, soil_saturation,
    slope_instability, hill_cutting_risk, isolated_villages, flood_level,
    population, road_status, x, y, w, h
  )
  VALUES (
    @id, @name, @state, @hazard_type, @rainfall_24h_mm, @soil_saturation,
    @slope_instability, @hill_cutting_risk, @isolated_villages, @flood_level,
    @population, @road_status, @x, @y, @w, @h
  )
`);

const zones = [
  {
    id: 'A',
    name: 'Sector A — Dima Hasao & Haflong Hills',
    state: 'Assam',
    hazard_type: 'Severe Landslide & Railway Breach',
    rainfall_24h_mm: 220.0,
    soil_saturation: 94,
    slope_instability: 'Extreme',
    hill_cutting_risk: 'Critical',
    isolated_villages: 6,
    flood_level: 'High',
    population: 4800,
    road_status: 'Blocked',
    x: 20, y: 20, w: 180, h: 120,
  },
  {
    id: 'B',
    name: 'Sector B — Sohra / East Khasi Hills',
    state: 'Meghalaya',
    hazard_type: 'Flash Flood & Slope Erosion',
    rainfall_24h_mm: 310.0,
    soil_saturation: 88,
    slope_instability: 'High',
    hill_cutting_risk: 'High',
    isolated_villages: 3,
    flood_level: 'High',
    population: 3200,
    road_status: 'Damaged',
    x: 210, y: 20, w: 180, h: 120,
  },
  {
    id: 'C',
    name: 'Sector C — Teesta Valley & Mangan',
    state: 'Sikkim',
    hazard_type: 'GLOF / Flash Flood & NH-10 Breach',
    rainfall_24h_mm: 195.0,
    soil_saturation: 91,
    slope_instability: 'Extreme',
    hill_cutting_risk: 'High',
    isolated_villages: 5,
    flood_level: 'High',
    population: 2100,
    road_status: 'Blocked',
    x: 400, y: 20, w: 180, h: 120,
  },
  {
    id: 'D',
    name: 'Sector D — Kameng - Tawang Corridor',
    state: 'Arunachal Pradesh',
    hazard_type: 'Cloudburst & Road Sinking',
    rainfall_24h_mm: 95.0,
    soil_saturation: 68,
    slope_instability: 'Moderate',
    hill_cutting_risk: 'Moderate',
    isolated_villages: 2,
    flood_level: 'Medium',
    population: 1600,
    road_status: 'Damaged',
    x: 20, y: 150, w: 180, h: 130,
  },
  {
    id: 'E',
    name: 'Sector E — Kohima - Imphal NH-29',
    state: 'Nagaland / Manipur',
    hazard_type: 'Subsidence & Mudslide Blockade',
    rainfall_24h_mm: 65.0,
    soil_saturation: 58,
    slope_instability: 'Moderate',
    hill_cutting_risk: 'Moderate',
    isolated_villages: 1,
    flood_level: 'Low',
    population: 2900,
    road_status: 'Open',
    x: 210, y: 150, w: 180, h: 130,
  },
  {
    id: 'F',
    name: 'Sector F — Aizawl Urban Slopes',
    state: 'Mizoram',
    hazard_type: 'Unplanned Hill Cutting Subsidence',
    rainfall_24h_mm: 140.0,
    soil_saturation: 82,
    slope_instability: 'High',
    hill_cutting_risk: 'Critical',
    isolated_villages: 0,
    flood_level: 'Medium',
    population: 5200,
    road_status: 'Damaged',
    x: 400, y: 150, w: 180, h: 130,
  },
];
zones.forEach(z => insertZone.run(z));

const insertResource = db.prepare(`
  INSERT INTO resources (key, name, icon, total, available)
  VALUES (@key, @name, @icon, @total, @available)
`);

const resources = [
  { key: 'earthmovers',     name: 'JCB / Excavators',        icon: '🚜', total: 15, available: 15 },
  { key: 'bailey_bridges',  name: 'Bailey Bridge Units',     icon: '🌉', total: 10, available: 10 },
  { key: 'mountain_teams',  name: 'Mountain SDRF / NDRF',    icon: '🧗', total: 25, available: 25 },
  { key: 'drone_recon',     name: 'AI Recon Drones',         icon: '🚁', total: 12, available: 12 },
  { key: 'air_drop_kits',   name: 'Air-Drop Relief Kits',    icon: '📦', total: 50, available: 50 },
  { key: 'ambulances',      name: '4x4 Mountain Ambulances', icon: '🚑', total: 20, available: 20 },
];
resources.forEach(r => insertResource.run(r));

const insertRoute = db.prepare(`
  INSERT INTO routes (zone_id, name, status) VALUES (@zone_id, @name, @status)
`);

const routeData = {
  A: [
    { name: 'NH-27 / Haflong-Silchar Highway', status: 'Blocked by Landslide' },
    { name: 'Lumding-Badarpur Hill Bypass', status: 'Damaged' },
    { name: 'Maibang Ridge Safe Pass', status: 'Safe' },
  ],
  B: [
    { name: 'Shillong - Cherrapunji Highway (NH-106)', status: 'Damaged' },
    { name: 'Mawkdok Gorge Bypass', status: 'Flooded' },
    { name: 'Mawphlang Highland Corridor', status: 'Safe' },
  ],
  C: [
    { name: 'NH-10 Sevoke - Gangtok Arterial', status: 'Blocked by Landslide' },
    { name: 'Lava - Algarah Forest Bypass', status: 'Damaged' },
    { name: 'Reshi-Rongli Alternative Pass', status: 'Safe' },
  ],
  D: [
    { name: 'Bhalukpong - Tawang Axis (NH-13)', status: 'Damaged' },
    { name: 'Orang - Kalaktang Corridor', status: 'Safe' },
    { name: 'Dirang Sinking Zone Road', status: 'Blocked by Landslide' },
  ],
  E: [
    { name: 'NH-29 Dimapur - Kohima Highway', status: 'Safe' },
    { name: 'Pfutsero - Tadubi Hill Track', status: 'Damaged' },
    { name: 'Mao - Senapati Corridor', status: 'Safe' },
  ],
  F: [
    { name: 'Aizawl - Sairang NH-54 Axis', status: 'Damaged' },
    { name: 'Tuirial Valley Route', status: 'Flooded' },
    { name: 'Durtlang Ridge Highway', status: 'Safe' },
  ],
};

Object.entries(routeData).forEach(([zoneId, routes]) => {
  routes.forEach(r => insertRoute.run({ zone_id: zoneId, name: r.name, status: r.status }));
});

console.log('✅ North Eastern Region (NER) database seeded successfully.');
