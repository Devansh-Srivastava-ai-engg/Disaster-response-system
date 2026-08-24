import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from './api';
import Header from './components/Header';
import StatStrip from './components/StatStrip';
import RiskMap from './components/RiskMap';
import ZoneDetail from './components/ZoneDetail';
import PriorityTable from './components/PriorityTable';
import ResourcePanel from './components/ResourcePanel';
import RoutePlanner from './components/RoutePlanner';
import CitizenFeed from './components/CitizenFeed';
import WeatherSimulator from './components/WeatherSimulator';
import ShelterManager from './components/ShelterManager';
import RescuerFeedbackPanel from './components/RescuerFeedbackPanel';
import { translations } from './translations';
import './App.css';

export default function App() {
  const [zones, setZones] = useState([]);
  const [summary, setSummary] = useState(null);
  const [bulletins, setBulletins] = useState([]);
  const [selectedZoneId, setSelectedZoneId] = useState('A');
  const [recommendation, setRecommendation] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [reports, setReports] = useState([]);
  const [log, setLog] = useState([]);
  const [online, setOnline] = useState(true);
  const [dispatchError, setDispatchError] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState('en');

  const t = translations[lang] || translations.en;

  const toggleLanguage = () => {
    setLang(l => (l === 'en' ? 'hi' : 'en'));
  };

  // Tracks simulated rescuer movement intervals, keyed by report ID
  const rescuerTickersRef = useRef({});

  const refreshCore = useCallback(async () => {
    try {
      const [zonesData, summaryData, reportsData, logData, bulletinsData] = await Promise.all([
        api.getZones(),
        api.getSummary(),
        api.getReports(),
        api.getDispatchLog(),
        api.getBulletins(),
      ]);
      setZones(zonesData || []);
      setSummary(summaryData);
      setReports(reportsData || []);
      setLog(logData || []);
      setBulletins(bulletinsData || []);
      setOnline(true);
    } catch (e) {
      setOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshZoneDetail = useCallback(async (zoneId) => {
    try {
      const [rec, routeData] = await Promise.all([
        api.getRecommendation(zoneId),
        api.getZoneRoutes(zoneId),
      ]);
      setRecommendation(rec);
      setRoutes(routeData);
    } catch (e) {
      // zone detail failure is non-fatal
    }
  }, []);

  useEffect(() => {
    refreshCore();
    const interval = setInterval(refreshCore, 5000);
    return () => clearInterval(interval);
  }, [refreshCore]);

  useEffect(() => {
    if (selectedZoneId) refreshZoneDetail(selectedZoneId);
  }, [selectedZoneId, zones.length, refreshZoneDetail]);

  const handleDispatch = async (customRec) => {
    const payload = customRec || recommendation || { drone_recon: 1, mountain_teams: 1 };
    setDispatching(true);
    setDispatchError('');
    try {
      await api.dispatch({ zoneId: selectedZoneId, ...payload });
      await refreshCore();
      await refreshZoneDetail(selectedZoneId);
    } catch (e) {
      setDispatchError(e.message);
      throw e;
    } finally {
      setDispatching(false);
    }
  };

  const handleUpdateZoneConditions = async (zoneId, payload) => {
    try {
      await api.updateZoneConditions(zoneId, payload);
      await refreshCore();
      await refreshZoneDetail(zoneId);
    } catch (e) {
      console.error('Failed to update weather/geological conditions', e);
    }
  };

  /**
   * Simulated rescuer movement ticker starting from Central Base (Guwahati / Delhi EOC)
   */
  const startRescuerTicker = useCallback((report) => {
    const { id, lat: cLat, lng: cLng } = report;
    if (cLat == null || cLng == null) return;
    if (rescuerTickersRef.current[id]) return;

    let rLat = 26.1445;
    let rLng = 91.7362;

    const tick = async () => {
      const dLat = cLat - rLat;
      const dLng = cLng - rLng;
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);

      if (dist < 0.0005) {
        rLat = cLat; rLng = cLng;
        clearInterval(rescuerTickersRef.current[id]);
        delete rescuerTickersRef.current[id];
      } else {
        rLat += dLat * 0.04;
        rLng += dLng * 0.04;
      }

      try {
        await api.updateRescuerLocation(id, rLat, rLng);
        const reportsData = await api.getReports();
        setReports(reportsData || []);
      } catch (e) {
        // non-fatal
      }
    };

    rescuerTickersRef.current[id] = setInterval(tick, 5000);
    tick();
  }, []);

  const stopRescuerTicker = useCallback((id) => {
    if (rescuerTickersRef.current[id]) {
      clearInterval(rescuerTickersRef.current[id]);
      delete rescuerTickersRef.current[id];
    }
  }, []);

  const handleStatusUpdate = async (id, status, extra = {}) => {
    try {
      const updatedReport = await api.updateReportStatus(id, status, extra);
      await refreshCore();

      if (status === 'Dispatched') {
        startRescuerTicker(updatedReport);
      } else if (status === 'Resolved') {
        stopRescuerTicker(id);
      }
    } catch (e) {
      console.error('Failed to update report status', e);
    }
  };

  const handleAddResource = async (key, count) => {
    try {
      await api.addResource(key, count);
      await refreshCore();
    } catch (e) {
      console.error('Failed to add resource units', e);
    }
  };

  const handleResetResources = async () => {
    try {
      await api.resetResources();
      await refreshCore();
    } catch (e) {
      console.error('Failed to restock resources', e);
    }
  };

  if (loading) {
    return <div className="loading-screen">CONNECTING TO INCIDENT COMMAND API…</div>;
  }

  const selectedZone = zones.find((z) => z.id === selectedZoneId);

  return (
    <div className="wrap">
      <Header
        online={online}
        lang={lang}
        onToggleLang={toggleLanguage}
      />

      {/* Early Warning Bulletin Bar */}
      {bulletins.length > 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderLeft: '4px solid var(--critical)', borderRadius: 'var(--radius-sm)',
          padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12,
          fontSize: 12.5,
        }}>
          <span style={{ fontSize: 16 }}>🚨</span>
          <div style={{ flex: 1 }}>
            <strong style={{ color: 'var(--critical)' }}>NDMA/NEC Predictive EWS Alert: </strong>
            <span>{bulletins[0]?.zone_name} ({bulletins[0]?.state}) — {bulletins[0]?.alert}. {bulletins[0]?.action}</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            {bulletins.length} Active Regional Advisories
          </span>
        </div>
      )}

      <StatStrip summary={summary} />

      {/* Grid 1: Risk Map & Priority Table */}
      <div className="grid">
        <div className="panel">
          <h2>
            {t.riskMapTitle}{' '}
            <span className="tag">AI PREDICTIVE GEOLOGICAL MODEL</span>
          </h2>
          <RiskMap zones={zones} selectedZoneId={selectedZoneId} onSelect={setSelectedZoneId} />
          <ZoneDetail zone={selectedZone} />
        </div>

        <div className="panel">
          <h2>
            {t.priorityTitle}{' '}
            <span className="tag">IMD PRECIPITATION &amp; SLOPE SENSORS</span>
          </h2>
          <PriorityTable zones={zones} selectedZoneId={selectedZoneId} onSelect={setSelectedZoneId} />

          <div style={{ marginTop: 14 }}>
            <WeatherSimulator zone={selectedZone} onUpdateConditions={handleUpdateZoneConditions} />
          </div>
        </div>
      </div>

      {/* Grid 2: Mountain Resource Allocation & Lifeline Route Planner */}
      <div className="grid">
        <div className="panel">
          <h2>
            {t.resourceTitle}{' '}
            <span className="tag">{selectedZone ? `SECTOR ${selectedZone.id} (${selectedZone.state})` : 'SELECT A ZONE'}</span>
          </h2>
          <ResourcePanel
            zone={selectedZone}
            resources={summary?.resources || []}
            recommendation={recommendation}
            onDispatch={handleDispatch}
            onAddResource={handleAddResource}
            onResetResources={handleResetResources}
            error={dispatchError}
            dispatching={dispatching}
          />
        </div>

        <div className="panel">
          <h2>
            {t.routePlannerTitle}{' '}
            <span className="tag">{selectedZone ? `CORRIDOR → ${selectedZone.id}` : ''}</span>
          </h2>
          <RoutePlanner routes={routes} />
        </div>
      </div>

      {/* Grid 3: Citizen Reports & Command Log */}
      <div className="grid2">
        <div className="panel">
          <h2>
            {t.citizenFeedTitle}{' '}
            <span className="tag">LIVE GROUND SOS</span>
          </h2>
          <CitizenFeed
            reports={reports}
            onStatusUpdate={handleStatusUpdate}
            lang={lang}
          />
        </div>

        <div className="panel">
          <h2>
            {t.commandLogTitle}{' '}
            <span className="tag">MISSION HISTORY</span>
          </h2>
          <div className="log-list">
            {log.length === 0 && <div className="empty-note">Awaiting unit deployment actions…</div>}
            {log.map((entry) => (
              <div className="log-entry" key={entry.id}>
                <span className="log-time">[{new Date(entry.created_at).toLocaleTimeString()}]</span>
                <span>{entry.details}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Relief Shelters & Camp Management Operations */}
      <ShelterManager lang={lang} />

      {/* Citizen Feedback & Grievance Review Panel (Images 3 & 4 integration) */}
      <RescuerFeedbackPanel lang={lang} />

      <footer className="footer-bar">
        {t.footer}
      </footer>
    </div>
  );
}
