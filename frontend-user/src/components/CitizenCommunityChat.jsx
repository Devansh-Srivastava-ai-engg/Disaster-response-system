import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { translations } from '../translations';
import {
  formatChatSmsPayload,
  triggerSmsApp,
  EMERGENCY_NUMBERS,
  getOfflineChatOutbox,
  queueOfflineChatMessage,
  markChatMessageSmsSent,
  syncOfflineOutbox,
} from '../offlineSms';

const CHANNELS = [
  { id: 'all', key: 'channelAll', icon: '🌐' },
  { id: 'mutual-aid', key: 'channelMutualAid', icon: '🤝' },
  { id: 'shelter-alerts', key: 'channelShelterAlerts', icon: '🛡️' },
  { id: 'sector-a', key: 'channelSectorA', icon: '🏔️' },
  { id: 'sector-b', key: 'channelSectorB', icon: '🌧️' },
  { id: 'sector-c', key: 'channelSectorC', icon: '🌊' },
  { id: 'sector-d', key: 'channelSectorD', icon: '⛰️' },
  { id: 'sector-e', key: 'channelSectorE', icon: '🛣️' },
  { id: 'sector-f', key: 'channelSectorF', icon: '🏘️' },
];

const TAGS = [
  { id: 'Emergency Update', key: 'tagEmergencyUpdate', icon: '📢', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
  { id: 'Need Help / Supplies', key: 'tagNeedHelp', icon: '🆘', color: '#c2410c', bg: '#fff7ed', border: '#ffedd5' },
  { id: 'Offering Aid / Shelter', key: 'tagOfferingAid', icon: '🤝', color: '#15803d', bg: '#f0fdf4', border: '#dcfce7' },
  { id: 'Safe Routes & Shelter', key: 'tagSafeRoutes', icon: '🛡️', color: '#0369a1', bg: '#f0f9ff', border: '#e0f2fe' },
  { id: 'General Check-in', key: 'tagGeneral', icon: '💬', color: '#475569', bg: '#f8fafc', border: '#e2e8f0' },
];

const QUICK_TEMPLATES = [
  '💧 Clean drinking water & food rations available here.',
  '⚠️ Water level rising rapidly in lower street.',
  '🚪 Community Hall on high ground is open for sheltering.',
  '⚡ Power lines damaged — avoid main crossing.',
  '🔋 Have spare charged battery pack / power bank.',
  '🚗 Route confirmed clear for four-wheelers.',
];

export default function CitizenCommunityChat({ userId, lang = 'en' }) {
  const t = translations[lang] || translations.en;
  const messagesEndRef = useRef(null);

  const [activeChannel, setActiveChannel] = useState('all');
  const [messages, setMessages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  const [outbox, setOutbox] = useState(() => getOfflineChatOutbox());
  const [syncStatus, setSyncStatus] = useState(null);

  // Form states
  const [userName, setUserName] = useState(() => localStorage.getItem('sentinel_chat_name') || 'Citizen');
  const [location, setLocation] = useState(() => localStorage.getItem('sentinel_chat_loc') || '');
  const [selectedTag, setSelectedTag] = useState('Emergency Update');
  const [messageText, setMessageText] = useState('');
  const [upvotedIds, setUpvotedIds] = useState(() => new Set());
  const [showGuidelines, setShowGuidelines] = useState(true);

  // Refresh outbox state
  const refreshOutbox = useCallback(() => {
    setOutbox(getOfflineChatOutbox());
  }, []);

  // Fetch messages from backend
  const fetchMessages = useCallback(async () => {
    if (isOfflineMode) return;
    try {
      const data = await api.getChatMessages(activeChannel);
      setMessages(data || []);
    } catch (err) {
      console.warn('Network unavailable, operating in offline fallback', err);
    }
  }, [activeChannel, isOfflineMode]);

  // Handle Online / Offline network events
  useEffect(() => {
    const handleOnline = async () => {
      setIsOfflineMode(false);
      const res = await syncOfflineOutbox(api);
      if (res.syncedCount > 0) {
        setSyncStatus(`✓ ${res.syncedCount} offline message(s) synced with central control.`);
        setTimeout(() => setSyncStatus(null), 5000);
      }
      refreshOutbox();
      fetchMessages();
    };

    const handleOffline = () => {
      setIsOfflineMode(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchMessages, refreshOutbox]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3500);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Manual Outbox Sync
  const handleManualSync = async () => {
    setSubmitting(true);
    try {
      const res = await syncOfflineOutbox(api);
      if (res.syncedCount > 0) {
        setSyncStatus(`✓ Successfully synced ${res.syncedCount} message(s) to live network.`);
      } else {
        setSyncStatus('✓ Outbox is empty or fully synchronized.');
      }
      refreshOutbox();
      await fetchMessages();
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (e) {
      setSyncStatus('❌ Sync failed — Check internet connectivity.');
    } finally {
      setSubmitting(false);
    }
  };

  // Broadcast Online via Web API
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!messageText.trim()) return;

    localStorage.setItem('sentinel_chat_name', userName.trim() || 'Citizen');
    localStorage.setItem('sentinel_chat_loc', location.trim() || 'Disaster Zone');

    const msgPayload = {
      user_id: userId,
      user_name: userName.trim() || 'Citizen',
      channel: activeChannel === 'all' ? 'general' : activeChannel,
      tag: selectedTag,
      location: location.trim() || 'Disaster Relief Sector',
      message: messageText.trim(),
    };

    if (isOfflineMode) {
      // Direct queue in offline outbox
      queueOfflineChatMessage(msgPayload);
      refreshOutbox();
      setMessageText('');
      setSyncStatus('✓ Message queued in Offline Outbox. Will sync when online.');
      setTimeout(() => setSyncStatus(null), 4000);
      return;
    }

    setSubmitting(true);
    try {
      await api.sendChatMessage(msgPayload);
      setMessageText('');
      await fetchMessages();

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.warn('Web transmission failed, saving to offline outbox', err);
      queueOfflineChatMessage(msgPayload);
      refreshOutbox();
      setMessageText('');
      setSyncStatus('⚠️ Web transmission failed. Saved to Offline Outbox for auto-sync.');
    } finally {
      setSubmitting(false);
    }
  };

  // Transmit via Native Cellular SMS
  const handleTransmitChatSms = () => {
    if (!messageText.trim()) return;

    localStorage.setItem('sentinel_chat_name', userName.trim() || 'Citizen');
    localStorage.setItem('sentinel_chat_loc', location.trim() || 'Disaster Zone');

    const msgPayload = {
      user_id: userId,
      user_name: userName.trim() || 'Citizen',
      channel: activeChannel === 'all' ? 'general' : activeChannel,
      tag: selectedTag,
      location: location.trim() || 'Disaster Relief Sector',
      message: messageText.trim(),
    };

    // Queue in outbox and mark as sms transmitted
    const queuedItem = queueOfflineChatMessage(msgPayload);
    markChatMessageSmsSent(queuedItem.offline_id);
    refreshOutbox();

    const smsText = formatChatSmsPayload(msgPayload);
    triggerSmsApp(EMERGENCY_NUMBERS.communityGateway, smsText);

    setMessageText('');
    setSyncStatus('✓ SMS messaging app opened. Message logged in local outbox.');
    setTimeout(() => setSyncStatus(null), 6000);
  };

  const handleUpvote = async (msgId) => {
    if (upvotedIds.has(msgId)) return;
    try {
      setUpvotedIds(prev => new Set(prev).add(msgId));
      await api.upvoteChatMessage(msgId);
      await fetchMessages();
    } catch (err) {
      console.error('Failed to upvote message', err);
    }
  };

  const getTagStyle = (tagId) => {
    return TAGS.find(t => t.id === tagId) || TAGS[4];
  };

  const formatTime = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="community-chat-card">
      {/* ── Chat Header ── */}
      <div className="chat-header-bar">
        <div className="chat-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div className={`chat-live-pulse-badge ${isOfflineMode ? 'offline' : ''}`}>
              <span className={`live-dot ${isOfflineMode ? 'offline' : ''}`} />
              <span>{isOfflineMode ? t.offlineStatus : t.chatLivePill}</span>
            </div>

            {/* Offline Mode Manual Simulator Toggle */}
            <button
              type="button"
              className={`btn-offline-toggle ${isOfflineMode ? 'active' : ''}`}
              onClick={() => setIsOfflineMode(m => !m)}
              title="Toggle Offline SMS emergency simulation"
            >
              <span>{isOfflineMode ? '🟢 Switch to Online Web' : '📶 Simulate No-Internet (SMS Mode)'}</span>
            </button>
          </div>

          <h3 className="chat-main-title">{t.chatTitle}</h3>
          <p className="chat-subtitle-text">{t.chatSubtitle}</p>
        </div>

        <div className="chat-header-right">
          <div className="chat-stat-pill">
            <span className="stat-value">{messages.length}</span>
            <span className="stat-title">{t.chatActiveCitizens}</span>
          </div>
        </div>
      </div>

      {/* ── Offline Banner Alert ── */}
      {isOfflineMode && (
        <div className="offline-mode-alert-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20 }}>📶</span>
            <div style={{ flex: 1, fontSize: 12.5, color: '#991b1b', fontWeight: 600 }}>
              {t.offlineSmsBanner}
            </div>
            {outbox.length > 0 && (
              <button
                type="button"
                className="btn-sync-outbox"
                onClick={handleManualSync}
                disabled={submitting}
              >
                🔄 {t.syncNow} ({outbox.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sync Status Banner */}
      {syncStatus && (
        <div className="alert-success" style={{ marginBottom: 14 }}>
          <div className="alert-success-text" style={{ fontSize: 12.5 }}>
            {syncStatus}
          </div>
        </div>
      )}

      {/* ── Guidelines Alert ── */}
      {showGuidelines && (
        <div className="chat-guidelines-banner">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <div style={{ fontSize: 12, lineHeight: 1.5, color: '#92400e' }}>
              <strong>{t.chatGuidelines}</strong>
            </div>
          </div>
          <button
            type="button"
            className="btn-close-guidelines"
            onClick={() => setShowGuidelines(false)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Channel Selector Tabs ── */}
      <div className="chat-channels-scroll">
        {CHANNELS.map((ch) => {
          const isActive = activeChannel === ch.id;
          return (
            <button
              key={ch.id}
              type="button"
              className={`chat-channel-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveChannel(ch.id)}
            >
              <span>{ch.icon}</span>
              <span>{t[ch.key] || ch.id}</span>
            </button>
          );
        })}
      </div>

      {/* ── Main Chat Area (Messages Feed + Input Box) ── */}
      <div className="chat-body-grid">
        {/* Messages Feed */}
        <div className="chat-messages-container">
          {/* Offline Outbox Strip (if any queued items exist) */}
          {outbox.length > 0 && (
            <div className="offline-outbox-box">
              <div className="outbox-header">
                <span>📦 {t.offlineOutboxTitle} ({outbox.length} pending sync)</span>
                <span style={{ fontSize: 11, color: '#6b7280' }}>Local Device Storage</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                {outbox.map((ob) => (
                  <div key={ob.offline_id} className="outbox-item-row">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 11.5 }}>
                        #{ob.channel} • {ob.tag} — <span style={{ fontWeight: 500 }}>"{ob.message}"</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: '#6b7280' }}>
                        Queued: {new Date(ob.queued_at).toLocaleTimeString()} {ob.sms_sent && '• ✓ Transmitted via SMS'}
                      </div>
                    </div>
                    <span className={`outbox-badge ${ob.sms_sent ? 'sms' : 'queued'}`}>
                      {ob.sms_sent ? 'SMS Sent' : 'Queued'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {messages.length === 0 && outbox.length === 0 ? (
            <div className="chat-empty-state">
              <div style={{ fontSize: 32, marginBottom: 8 }}>📡</div>
              <div style={{ fontWeight: 700, color: '#334155', fontSize: 14 }}>{t.emptyChat}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Keep your community safe by reporting clear routes, safe water, and emergency requirements.
              </div>
            </div>
          ) : (
            <div className="chat-messages-list">
              {messages.map((msg) => {
                const tagConfig = getTagStyle(msg.tag);
                const isMe = msg.user_id === userId;
                const hasUpvoted = upvotedIds.has(msg.id);

                return (
                  <div key={msg.id} className={`chat-message-item ${isMe ? 'is-me' : ''}`}>
                    <div className="msg-header-row">
                      <div className="msg-author-info">
                        <span className="msg-author-avatar">
                          {msg.user_name ? msg.user_name.charAt(0).toUpperCase() : 'C'}
                        </span>
                        <span className="msg-author-name">{msg.user_name}</span>
                        {isMe && <span className="msg-you-tag">You</span>}
                        {msg.location && (
                          <span className="msg-location-chip">
                            📍 {msg.location}
                          </span>
                        )}
                      </div>

                      <div className="msg-meta-right">
                        <span
                          className="msg-tag-badge"
                          style={{
                            color: tagConfig.color,
                            backgroundColor: tagConfig.bg,
                            borderColor: tagConfig.border,
                          }}
                        >
                          {tagConfig.icon} {t[tagConfig.key] || msg.tag}
                        </span>
                        <span className="msg-time">{formatTime(msg.created_at)}</span>
                      </div>
                    </div>

                    <div className="msg-content-text">
                      {msg.message}
                    </div>

                    <div className="msg-footer-row">
                      <button
                        type="button"
                        className={`btn-upvote ${hasUpvoted ? 'upvoted' : ''}`}
                        onClick={() => handleUpvote(msg.id)}
                        title="Mark as helpful verified information"
                      >
                        <span>👍 {t.chatHelpful}</span>
                        <span className="upvote-count">{msg.upvotes || 0}</span>
                      </button>

                      <div className="msg-channel-chip">
                        #{msg.channel || 'general'}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Compose Form Box */}
        <div className="chat-compose-box">
          <div className="compose-box-header">
            <span>✍️ Broadcast Message to Citizens</span>
            <span className="channel-indicator-badge">#{activeChannel}</span>
          </div>

          <form onSubmit={handleSendMessage}>
            <div className="compose-meta-inputs">
              <div className="compose-field">
                <label>{t.chatName}</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. Ramesh K."
                  required
                />
              </div>

              <div className="compose-field">
                <label>{t.chatLocation}</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Sector B High School"
                  required
                />
              </div>
            </div>

            <div className="compose-field" style={{ marginTop: 10 }}>
              <label>{t.chatTag}</label>
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="tag-select"
              >
                {TAGS.map((tg) => (
                  <option key={tg.id} value={tg.id}>
                    {tg.icon} {t[tg.key] || tg.id}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Template Chips */}
            <div className="quick-templates-section">
              <div className="quick-templates-title">⚡ Quick Situational Updates:</div>
              <div className="quick-templates-chips">
                {QUICK_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="template-chip-btn"
                    onClick={() => setMessageText(tmpl)}
                  >
                    {tmpl}
                  </button>
                ))}
              </div>
            </div>

            <div className="compose-field" style={{ marginTop: 10 }}>
              <textarea
                rows={3}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={t.chatPlaceholder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {/* Online Web Broadcast Button */}
              <button
                type="submit"
                disabled={submitting || !messageText.trim()}
                className="btn-broadcast-chat"
              >
                {submitting ? (
                  <span>📡 {t.chatSending}</span>
                ) : (
                  <span>🚀 {t.chatSendBtn}</span>
                )}
              </button>

              {/* Direct Offline SMS Broadcast Button */}
              <button
                type="button"
                disabled={!messageText.trim()}
                className="btn-offline-sms"
                onClick={handleTransmitChatSms}
                title="Send as encoded SMS to disaster hub"
              >
                <span>{t.transmitChatViaSms}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
