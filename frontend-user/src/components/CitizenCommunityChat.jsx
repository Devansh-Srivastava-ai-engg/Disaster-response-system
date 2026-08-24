import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { translations } from '../translations';

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

  // Form states
  const [userName, setUserName] = useState(() => localStorage.getItem('sentinel_chat_name') || 'Citizen');
  const [location, setLocation] = useState(() => localStorage.getItem('sentinel_chat_loc') || '');
  const [selectedTag, setSelectedTag] = useState('Emergency Update');
  const [messageText, setMessageText] = useState('');
  const [upvotedIds, setUpvotedIds] = useState(() => new Set());
  const [showGuidelines, setShowGuidelines] = useState(true);

  // Fetch messages from backend
  const fetchMessages = useCallback(async () => {
    try {
      const data = await api.getChatMessages(activeChannel);
      setMessages(data || []);
    } catch (err) {
      console.error('Failed to load community chat messages', err);
    }
  }, [activeChannel]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3500);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!messageText.trim()) return;

    setSubmitting(true);
    try {
      localStorage.setItem('sentinel_chat_name', userName.trim() || 'Citizen');
      localStorage.setItem('sentinel_chat_loc', location.trim() || 'Disaster Zone');

      await api.sendChatMessage({
        user_id: userId,
        user_name: userName.trim() || 'Citizen',
        channel: activeChannel === 'all' ? 'general' : activeChannel,
        tag: selectedTag,
        location: location.trim() || 'Disaster Relief Sector',
        message: messageText.trim(),
      });

      setMessageText('');
      await fetchMessages();

      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('Failed to broadcast message', err);
    } finally {
      setSubmitting(false);
    }
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
          <div className="chat-live-pulse-badge">
            <span className="live-dot" />
            <span>{t.chatLivePill}</span>
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
          {messages.length === 0 ? (
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
          </form>
        </div>
      </div>
    </div>
  );
}
