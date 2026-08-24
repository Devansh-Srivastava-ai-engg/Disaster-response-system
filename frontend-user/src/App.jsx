import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import Header from './components/Header';
import CitizenFeed from './components/CitizenFeed';
import CitizenCommunityChat from './components/CitizenCommunityChat';
import CitizenFeedback from './components/CitizenFeedback';
import { translations } from './translations';
import './App.css';

function getOrCreateUserId() {
  let id = sessionStorage.getItem('sentinel_citizen_id');
  if (!id) {
    id = 'usr_' + Math.random().toString(36).substring(2, 8) + '_' + Date.now().toString(36);
    sessionStorage.setItem('sentinel_citizen_id', id);
  }
  return id;
}

export default function App() {
  const [userId] = useState(getOrCreateUserId);
  const [online, setOnline] = useState(true);
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState(null);
  const [lang, setLang] = useState('en');
  const [activePrompt, setActivePrompt] = useState(null);
  const seenDispatchedRef = useRef(new Set());

  const t = translations[lang] || translations.en;

  const toggleLanguage = () => {
    setLang(l => (l === 'en' ? 'hi' : 'en'));
  };

  const refreshData = useCallback(async () => {
    try {
      const [reportsData, summaryData] = await Promise.all([
        api.getReports(userId),
        api.getSummary().catch(() => null),
      ]);
      setReports(reportsData || []);
      if (summaryData) setSummary(summaryData);
      setOnline(true);

      reportsData?.forEach((r) => {
        if (r.status === 'Dispatched' && !seenDispatchedRef.current.has(r.id)) {
          seenDispatchedRef.current.add(r.id);
          setActivePrompt(r);
        }
      });
    } catch (e) {
      setOnline(false);
    }
  }, [userId]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 4000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleReportSubmit = async (reportData) => {
    const res = await api.submitReport({ ...reportData, user_id: userId });
    await refreshData();
    return res;
  };

  return (
    <>
      <Header
        online={online}
        lang={lang}
        onToggleLang={toggleLanguage}
        summary={summary}
      />

      <div className="page-wrap">
        {/* ── Hero & Statistics Banner (Image 2 style) ── */}
        <div className="hero-banner-card">
          <div className="hero-badge">🛡️ {t.heroBadge}</div>
          <h2 className="hero-title">{t.heroTitle}</h2>
          <p className="hero-desc">{t.heroDesc}</p>

          <div className="quick-stats-strip">
            <div className="quick-stat-box">
              <div className="stat-num text-amber">{summary?.activeSOS ?? 3}</div>
              <div className="stat-lbl">{t.statActiveSos}</div>
            </div>

            <div className="quick-stat-box">
              <div className="stat-num text-red">{summary?.pendingUrgent ?? 2}</div>
              <div className="stat-lbl">{t.statPendingUrgent}</div>
            </div>

            <div className="quick-stat-box">
              <div className="stat-num text-green">{summary?.citizensRescued ?? 56}</div>
              <div className="stat-lbl">{t.statCitizensRescued}</div>
            </div>

            <div className="quick-stat-box">
              <div className="stat-num text-blue">{summary?.monitoredSectors ?? 6}</div>
              <div className="stat-lbl">{t.statMonitoredSectors}</div>
            </div>
          </div>
        </div>

        {/* ── Citizen Emergency SOS Feed & Form ── */}
        <CitizenFeed
          onSubmit={handleReportSubmit}
          reports={reports}
          userId={userId}
          lang={lang}
        />

        {/* ── Citizen Emergency Community Network & Live Chat ── */}
        <div style={{ marginTop: 28 }} id="community-chat">
          <CitizenCommunityChat
            userId={userId}
            lang={lang}
          />
        </div>

        {/* ── Citizen Disaster Relief Feedback & Grievance (Images 3 & 4) ── */}
        <div style={{ marginTop: 28 }}>
          <CitizenFeedback lang={lang} />
        </div>

        <p className="footer-bar">{t.footer}</p>
      </div>

      {/* ── Dispatch Notification Popup ── */}
      {activePrompt && (
        <div className="modal-backdrop" onClick={() => setActivePrompt(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">🚨</div>
            <div className="modal-title">Rescue Unit Mobilized!</div>
            <div className="modal-subtitle">
              {activePrompt.unit_name || 'NDRF Quick Response Team'} has been deployed to your location.
            </div>

            <div className="modal-details">
              <div className="modal-detail-row">
                <span>Ticket ID</span>
                <span className="ticket-ref">{activePrompt.ticket_id || `SOS-${activePrompt.id}`}</span>
              </div>
              <div className="modal-detail-row">
                <span>Citizen</span>
                <span>{activePrompt.name}</span>
              </div>
              <div className="modal-detail-row">
                <span>Location</span>
                <span>{activePrompt.location}</span>
              </div>
              <div className="modal-detail-row">
                <span>Estimated Arrival</span>
                <span style={{ fontWeight: 700, color: '#166534' }}>~{activePrompt.eta_mins || 20} Minutes</span>
              </div>
            </div>

            <div className="modal-notice">
              <span>Stay in an elevated, safe structure. Conserve mobile phone battery. The rescue team is actively tracking your coordinates.</span>
            </div>

            <button className="btn-primary" onClick={() => setActivePrompt(null)}>
              Understood, I am in a safe location
            </button>
          </div>
        </div>
      )}
    </>
  );
}
