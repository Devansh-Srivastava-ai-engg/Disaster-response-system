/**
 * North Eastern Region (NER) — AI Predictive Disaster Risk & Early Warning Engine
 * Incorporates:
 *  - 24h Cumulative Precipitation (IMD rainfall classification)
 *  - Soil Moisture Saturation Index (%)
 *  - Geological Slope Instability Factor
 *  - Unplanned Hill Cutting / Quarrying Risk Factor
 *  - Cutoff Remote Village Isolation Vulnerability
 */

const SLOPE_WEIGHT = { Stable: 0, Moderate: 3, High: 7, Extreme: 12 };
const HILL_CUTTING_WEIGHT = { Low: 0, Moderate: 2, High: 5, Critical: 9 };
const ROAD_PENALTY = { Open: 0, Damaged: 4, Blocked: 8 };

function calcLandslideProbability(zone) {
  const rain = Number(zone.rainfall_24h_mm) || 0;
  const sat = Number(zone.soil_saturation) || 50;
  const slope = zone.slope_instability || 'Moderate';
  const hillCutting = zone.hill_cutting_risk || 'Moderate';

  // Base probability derived from cumulative precipitation threshold
  let baseProb = 0;
  if (rain > 200) baseProb = 50 + (rain - 200) * 0.15;
  else if (rain > 120) baseProb = 35 + (rain - 120) * 0.18;
  else if (rain > 60) baseProb = 15 + (rain - 60) * 0.33;
  else baseProb = (rain / 60) * 15;

  // Soil saturation boost (water pore pressure reduces shear strength of hill slope)
  const satBoost = sat > 75 ? (sat - 75) * 0.8 : 0;

  // Fragile terrain and human-induced hill cutting factors
  const terrainFactor = SLOPE_WEIGHT[slope] || 0;
  const humanFactor = HILL_CUTTING_WEIGHT[hillCutting] || 0;

  const rawProb = baseProb + satBoost + terrainFactor + humanFactor;
  return Math.min(99, Math.max(5, Math.round(rawProb)));
}

function calcFlashFloodProbability(zone) {
  const rain = Number(zone.rainfall_24h_mm) || 0;
  const sat = Number(zone.soil_saturation) || 50;

  let base = (rain / 250) * 60;
  if (sat > 80) base += (sat - 80) * 1.5;
  return Math.min(98, Math.max(5, Math.round(base)));
}

function scoreZone(zone) {
  const rain = Number(zone.rainfall_24h_mm) || 0;
  const sat = Number(zone.soil_saturation) || 50;
  const isolated = Number(zone.isolated_villages) || 0;
  const pop = Number(zone.population) || 1000;

  const rainScore = (rain / 250) * 8;
  const soilScore = (sat / 100) * 4;
  const slopeScore = (SLOPE_WEIGHT[zone.slope_instability] || 3) * 0.5;
  const hillCutScore = (HILL_CUTTING_WEIGHT[zone.hill_cutting_risk] || 2) * 0.5;
  const roadScore = (ROAD_PENALTY[zone.road_status] || 0) * 0.6;
  const isolationScore = isolated * 1.8;
  const popScore = (pop / 2000) * 0.8;

  const total = rainScore + soilScore + slopeScore + hillCutScore + roadScore + isolationScore + popScore;
  return Number(total.toFixed(2));
}

function priorityLabel(score) {
  if (score >= 15) return 'Critical';
  if (score >= 10) return 'High';
  if (score >= 5.5) return 'Medium';
  return 'Safe';
}

function earlyWarningAlert(score, landslideProb) {
  if (score >= 15 || landslideProb >= 75) return 'Red Alert (Imminent Evacuation)';
  if (score >= 10 || landslideProb >= 50) return 'Orange Alert (High Risk)';
  if (score >= 5.5 || landslideProb >= 30) return 'Yellow Alert (Advisory)';
  return 'Green (Normal Monitoring)';
}

function withPriority(zone) {
  const score = scoreZone(zone);
  const priority = priorityLabel(score);
  const landslide_prob = calcLandslideProbability(zone);
  const flash_flood_prob = calcFlashFloodProbability(zone);
  const early_warning = earlyWarningAlert(score, landslide_prob);

  return {
    ...zone,
    score,
    priority,
    landslide_prob,
    flash_flood_prob,
    early_warning,
  };
}

/**
 * Recommends specialized mountain disaster equipment:
 *  - earthmovers (JCBs / Heavy Excavators)
 *  - bailey_bridges (Modular Road Restoration Units)
 *  - mountain_teams (SDRF/NDRF Search & Rescue Teams)
 *  - drone_recon (AI Slope & Landslide Surveillance Drones)
 *  - air_drop_kits (Rations & Medical Bundles for Cutoff Hamlets)
 *  - ambulances (4x4 All-Terrain Mountain Ambulances)
 */
function recommendAllocation(zone) {
  const rec = {
    earthmovers: 0,
    bailey_bridges: 0,
    mountain_teams: 0,
    drone_recon: 0,
    air_drop_kits: 0,
    ambulances: 0,
  };

  const isBlocked = zone.road_status === 'Blocked';
  const hasIsolated = (zone.isolated_villages || 0) > 0;
  const highLandslide = (zone.landslide_prob || 0) >= 60;

  switch (zone.priority) {
    case 'Critical':
      rec.earthmovers = isBlocked ? 2 : 1;
      rec.bailey_bridges = isBlocked ? 1 : 0;
      rec.mountain_teams = 2;
      rec.drone_recon = 1;
      rec.air_drop_kits = hasIsolated ? Math.max(2, zone.isolated_villages * 2) : 2;
      rec.ambulances = 2;
      break;

    case 'High':
      rec.earthmovers = isBlocked || highLandslide ? 1 : 0;
      rec.mountain_teams = 1;
      rec.drone_recon = 1;
      rec.air_drop_kits = hasIsolated ? zone.isolated_villages : 1;
      rec.ambulances = 1;
      break;

    case 'Medium':
      rec.mountain_teams = 1;
      rec.drone_recon = highLandslide ? 1 : 0;
      rec.air_drop_kits = hasIsolated ? 1 : 0;
      rec.ambulances = 1;
      break;

    default:
      rec.drone_recon = 0;
      rec.air_drop_kits = 0;
  }

  return rec;
}

module.exports = {
  scoreZone,
  priorityLabel,
  earlyWarningAlert,
  calcLandslideProbability,
  calcFlashFloodProbability,
  withPriority,
  recommendAllocation,
};
