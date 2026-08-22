import { useEffect, useState } from 'react';
import { translations } from '../translations';

export default function Header({ online, lang = 'en', onToggleLang, summary }) {
  const [time, setTime] = useState(new Date());
  const t = translations[lang] || translations.en;

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="gov-header-wrapper">
      {/* ── Top Government Identity Strip ── */}
      <div className="gov-top-bar">
        <div className="gov-top-bar-inner">
          <div className="gov-top-left">
            <span className="gov-flag-dot">🇮🇳</span>
            <span className="gov-org-text">{t.govTitle}</span>
            <span className="gov-divider">|</span>
            <span className="gov-ndma-text">{t.ndmaTitle}</span>
          </div>

          <div className="gov-top-right">
            <div className="gov-helpline-chips">
              <a href="tel:112" className="helpline-chip primary">
                <span className="phone-icon">📞</span>
                <span>24x7: <strong>112</strong></span>
              </a>
              <a href="tel:1078" className="helpline-chip">
                <span>NDMA: <strong>1078</strong></span>
              </a>
              <a href="tel:1070" className="helpline-chip">
                <span>Disaster: <strong>1070</strong></span>
              </a>
            </div>

            {/* Language Toggle Button */}
            <button
              className="lang-toggle-btn"
              onClick={onToggleLang}
              title={lang === 'en' ? 'हिंदी में बदलें' : 'Switch to English'}
            >
              <span className="lang-icon">🌐</span>
              <span>{lang === 'en' ? 'हिंदी' : 'English'}</span>
            </button>

            <span className="gov-clock">{time.toLocaleTimeString('en-IN')} IST</span>
          </div>
        </div>
      </div>

      {/* ── Main Government Navigation Bar ── */}
      <div className="gov-main-nav">
        <div className="gov-main-nav-inner">
          <div className="gov-brand-block">
            <div className="gov-emblem-badge">
              <span className="emblem-text">Gov.in</span>
            </div>
            <div>
              <div className="gov-brand-title-row">
                <h1 className="gov-brand-title">{t.portalBrand}</h1>
                <span className="gov-domain-badge">NDMA // GOV.IN</span>
              </div>
              <p className="gov-brand-subtitle">{t.ministry}</p>
            </div>
          </div>

          <div className="gov-nav-actions">
            <div className="sos-counter-badge">
              <span className="pulse-ping" />
              <span>((o)) {summary?.activeSOS ?? 3} SOS</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Live Alert Scrolling Marquee ── */}
      <div className="gov-marquee-bar">
        <div className="marquee-label">
          <span className="live-badge">● LIVE ALERT</span>
        </div>
        <div className="marquee-content-wrap">
          <div className="marquee-text">
            {t.liveAlert}
          </div>
        </div>
      </div>
    </header>
  );
}
