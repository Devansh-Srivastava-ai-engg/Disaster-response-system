const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'disaster.db');
const db = new DatabaseSync(dbPath);

// ---------- SCHEMA ----------
db.exec(`
CREATE TABLE IF NOT EXISTS zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'NER',
  hazard_type TEXT NOT NULL DEFAULT 'Landslide / Flash Flood',
  rainfall_24h_mm REAL NOT NULL DEFAULT 45.0,
  soil_saturation INTEGER NOT NULL DEFAULT 60,
  slope_instability TEXT NOT NULL DEFAULT 'Moderate' CHECK(slope_instability IN ('Stable','Moderate','High','Extreme')),
  hill_cutting_risk TEXT NOT NULL DEFAULT 'Moderate' CHECK(hill_cutting_risk IN ('Low','Moderate','High','Critical')),
  isolated_villages INTEGER NOT NULL DEFAULT 0,
  flood_level TEXT NOT NULL CHECK(flood_level IN ('Low','Medium','High')),
  population INTEGER NOT NULL,
  road_status TEXT NOT NULL CHECK(road_status IN ('Open','Damaged','Blocked')),
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
  status TEXT NOT NULL CHECK(status IN ('Safe','Damaged','Flooded','Blocked by Landslide'))
);
`);

// Auto-migration for existing database files
try { db.exec(`ALTER TABLE zones ADD COLUMN state TEXT DEFAULT 'NER'`); } catch(e){}
try { db.exec(`ALTER TABLE zones ADD COLUMN hazard_type TEXT DEFAULT 'Landslide / Flash Flood'`); } catch(e){}
try { db.exec(`ALTER TABLE zones ADD COLUMN rainfall_24h_mm REAL DEFAULT 45.0`); } catch(e){}
try { db.exec(`ALTER TABLE zones ADD COLUMN soil_saturation INTEGER DEFAULT 60`); } catch(e){}
try { db.exec(`ALTER TABLE zones ADD COLUMN slope_instability TEXT DEFAULT 'Moderate'`); } catch(e){}
try { db.exec(`ALTER TABLE zones ADD COLUMN hill_cutting_risk TEXT DEFAULT 'Moderate'`); } catch(e){}
try { db.exec(`ALTER TABLE zones ADD COLUMN isolated_villages INTEGER DEFAULT 0`); } catch(e){}

try { db.exec(`ALTER TABLE reports ADD COLUMN is_isolated INTEGER DEFAULT 0`); } catch(e){}
try { db.exec(`ALTER TABLE reports ADD COLUMN lat REAL DEFAULT NULL`); } catch(e){}
try { db.exec(`ALTER TABLE reports ADD COLUMN lng REAL DEFAULT NULL`); } catch(e){}
try { db.exec(`ALTER TABLE reports ADD COLUMN rescuer_lat REAL DEFAULT NULL`); } catch(e){}
try { db.exec(`ALTER TABLE reports ADD COLUMN rescuer_lng REAL DEFAULT NULL`); } catch(e){}

module.exports = db;
