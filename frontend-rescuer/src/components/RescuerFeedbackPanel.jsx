import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { translations } from '../translations';

export default function RescuerFeedbackPanel({ lang = 'en' }) {
  const t = translations[lang] || translations.en;
  const [feedbackList, setFeedbackList] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [actionNoteText, setActionNoteText] = useState('');
  const [savingId, setSavingId] = useState(null);

  const fetchFeedback = useCallback(async () => {
    try {
      const data = await api.getFeedback();
      setFeedbackList(data || []);
    } catch (e) {
      console.error('Failed to load feedback in rescuer panel', e);
    }
  }, []);

  useEffect(() => {
    fetchFeedback();
    const interval = setInterval(fetchFeedback, 8000);
    return () => clearInterval(interval);
  }, [fetchFeedback]);

  const handleSaveActionNote = async (id) => {
    setSavingId(id);
    try {
      await api.updateFeedbackActionNote(id, actionNoteText.trim());
      setEditingId(null);
      setActionNoteText('');
      await fetchFeedback();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingId(null);
    }
  };

  const startEditing = (fb) => {
    setEditingId(fb.id);
    setActionNoteText(fb.action_note || '');
  };

  return (
    <div className="panel" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>
          {t.feedbackTabTitle}{' '}
          <span className="tag">NDMA / CITIZEN REVIEWS &amp; GRIEVANCE FEED</span>
        </h2>
        <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          {feedbackList.length} Verified Reviews Recorded
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        {feedbackList.length === 0 && (
          <div className="empty-note">No citizen feedback received yet.</div>
        )}
        {feedbackList.map((fb) => {
          const isEditing = editingId === fb.id;
          const isSaving = savingId === fb.id;

          return (
            <div
              key={fb.id}
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <strong style={{ fontSize: 13.5, color: 'var(--text)' }}>{fb.name}</strong>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {fb.location} {fb.ticket_id && `• Ref: ${fb.ticket_id}`}
                    </div>
                  </div>
                  <div style={{ color: '#d97706', fontSize: 13 }}>
                    {'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}
                  </div>
                </div>

                <p style={{ fontSize: 12.5, color: 'var(--text)', fontStyle: 'italic', margin: '8px 0', lineHeight: 1.45 }}>
                  "{fb.comment}"
                </p>

                <span style={{
                  fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                  background: 'var(--accent-soft)', color: 'var(--accent)', display: 'inline-block',
                }}>
                  {fb.category}
                </span>
              </div>

              {/* Action Note Section */}
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                {isEditing ? (
                  <div>
                    <textarea
                      rows={2}
                      value={actionNoteText}
                      onChange={(e) => setActionNoteText(e.target.value)}
                      placeholder={t.actionNotePlaceholder}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 4,
                        border: '1px solid var(--accent)',
                        fontSize: 12,
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSaveActionNote(fb.id)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 4,
                          background: 'var(--accent)',
                          color: '#fff',
                          border: 'none',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {isSaving ? 'Saving…' : `✓ ${t.saveActionNote}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 4,
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          fontSize: 11.5,
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontSize: 11.5, color: '#92400e', background: '#fef3c7', padding: '4px 8px', borderRadius: 4, flex: 1 }}>
                      <strong>NDMA Action Note: </strong>
                      <span>{fb.action_note || 'No official note attached yet.'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEditing(fb)}
                      style={{
                        fontSize: 11,
                        padding: '3px 7px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ✏️ Edit
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
