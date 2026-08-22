import { useEffect, useState } from 'react';

export default function Header({ online }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="header-brand">
          <span className="brand-mark">NER</span>
          <div>
            <h1>NER Disaster SOS &amp; Early Warning Portal</h1>
            <p>North Eastern Region — Landslide, Flash Flood &amp; Cutoff Hamlet Rescue</p>
          </div>
        </div>
        <div className="header-right">
          <span className="live-clock">{time.toLocaleTimeString()}</span>
          <div className={`status-pill ${online ? '' : 'offline'}`}>
            <span className="dot" />
            {online ? 'EWS Network Active' : 'Offline'}
          </div>
        </div>
      </div>
      <div className="hazard-strip" />
    </header>
  );
}
