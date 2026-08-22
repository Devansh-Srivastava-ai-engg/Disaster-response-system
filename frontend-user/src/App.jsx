import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import Header from './components/Header';
import CitizenFeed from './components/CitizenFeed';
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
  const [userId]        = useState(getOrCreateUserId);
  const [online, setOnline]           = useState(true);
  const [reports, setReports]         = useState([]);
  const [activePrompt, setActivePrompt] = useState(null);
  const seenDispatchedRef = useRef(new Set());

  const refreshReports = useCallback(async () => {
    try {
      const data = await api.getReports(userId);
      setReports(data);
      setOnline(true);
      data.forEach((r) => {
        if (r.status === 'Dispatched' && !seenDispatchedRef.current.has(r.id)) {
          seenDispatchedRef.current.add(r.id);
          setActivePrompt(r);
        }
      });
    } catch (e) { setOnline(false); }
  }, [userId]);

  useEffect(() => {
    refreshReports();
    const interval = setInterval(refreshReports, 3000);
    return () => clearInterval(interval);
  }, [refreshReports]);

  const handleReportSubmit = async (reportData) => {
    const res = await api.submitReport({ ...reportData, user_id: userId });
    await refreshReports();
    return res;
  };

  return (
    <>
      <Header online={online} />
      <div className="page-wrap">
        <CitizenFeed onSubmit={handleReportSubmit} reports={reports} userId={userId} />
        <p className="footer-bar">Sentinel Emergency Response System — Citizen Portal</p>
      </div>

      {activePrompt && (
        <div className="modal-backdrop" onClick={() => setActivePrompt(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">✓</div>
            <div className="modal-title">Help is on the way!</div>
            <div className="modal-subtitle">A rescue team has been dispatched to your location.</div>

            <div className="modal-details">
              <div className="modal-detail-row">
                <span>Ticket</span>
                <span className="ticket-ref">{activePrompt.ticket_id || `TK-${activePrompt.id}`}</span>
              </div>
              <div className="modal-detail-row">
                <span>Name</span>
                <span>{activePrompt.name}</span>
              </div>
              <div className="modal-detail-row">
                <span>Location</span>
                <span>{activePrompt.location}</span>
              </div>
            </div>

            <div className="modal-notice">
              <span>Stay in a safe, elevated spot. Keep your phone ({activePrompt.phone}) reachable. Responders are on their way.</span>
            </div>

            <button className="btn-primary" onClick={() => setActivePrompt(null)}>
              Got it, I'll stay safe
            </button>
          </div>
        </div>
      )}
    </>
  );
}
