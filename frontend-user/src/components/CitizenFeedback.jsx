import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { translations } from '../translations';

const CATEGORIES = [
  'Rescue Team Response & Boat Deployment',
  'Relief Shelter & Food Supply',
  'Medical Aid & Ambulance',
  'Evacuation & Transportation',
  'Alerts & Communication',
];

export default function CitizenFeedback({ lang = 'en' }) {
  const t = translations[lang] || translations.en;
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [reviews, setReviews] = useState([]);

  const fetchFeedback = useCallback(async () => {
    try {
      const data = await api.getFeedback();
      setReviews(data || []);
    } catch (e) {
      console.error('Failed to load feedback', e);
    }
  }, []);

  useEffect(() => {
    fetchFeedback();
    const interval = setInterval(fetchFeedback, 8000);
    return () => clearInterval(interval);
  }, [fetchFeedback]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await api.submitFeedback({
        name: name.trim() || 'Verified Citizen',
        location: location.trim() || 'Relief Sector',
        ticket_id: ticketId.trim(),
        rating,
        category,
        comment: comment.trim(),
      });
      setSubmittedSuccess(true);
      setName('');
      setLocation('');
      setTicketId('');
      setComment('');
      setRating(5);
      await fetchFeedback();
      setTimeout(() => setSubmittedSuccess(false), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const starLabels = {
    1: '1/5 Poor Response',
    2: '2/5 Needs Improvement',
    3: '3/5 Satisfactory',
    4: '4/5 Good Service',
    5: '5/5 Excellent Relief Response',
  };

  return (
    <div className="feedback-section-card">
      <div className="feedback-header">
        <div className="feedback-title-badge">⭐ {t.feedbackTitle}</div>
        <p className="feedback-subtitle">{t.feedbackSubtitle}</p>
      </div>

      <div className="feedback-grid">
        {/* Left Column: Form */}
        <div className="feedback-form-box">
          <div className="box-title">📝 {t.feedbackFormTitle}</div>

          {submittedSuccess && (
            <div className="alert-success" style={{ marginBottom: 14 }}>
              <div className="alert-success-text">
                <h4>✓ Feedback Submitted Successfully</h4>
                <p>Your review and feedback has been logged with the EOC Ground Coordination Division.</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Interactive 5-Star Rating */}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 12.5, color: '#374151', marginBottom: 6 }}>
                {t.satisfactionLabel}:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: 24,
                        cursor: 'pointer',
                        color: (hoverRating || rating) >= star ? '#f59e0b' : '#d1d5db',
                        transition: 'transform 0.1s',
                        padding: 0,
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1f2937', fontFamily: 'var(--font-mono)' }}>
                  {starLabels[rating]}
                </span>
              </div>
            </div>

            {/* Service Category */}
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 4 }}>
                {t.serviceCategory}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  background: '#f9fafb',
                  fontSize: 13,
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div className="form-group">
                <label style={{ display: 'block', fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 4 }}>
                  {t.feedbackName}
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rajesh Kumar"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'block', fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 4 }}>
                  {t.feedbackLocation}
                </label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Kashmere Gate Sector"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 4 }}>
                {t.feedbackTicket}
              </label>
              <input
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                placeholder="e.g. SOS-901 / NER-1044"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 4 }}>
                {t.feedbackComment}
              </label>
              <textarea
                rows={3}
                required
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t.feedbackCommentPlaceholder}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{ width: '100%', padding: '10px 14px', fontSize: 13.5 }}
            >
              {submitting ? t.submittingFeedback : `✓ ${t.submitFeedbackBtn}`}
            </button>
          </form>
        </div>

        {/* Right Column: Verified Reviews Feed */}
        <div className="feedback-reviews-box">
          <div className="box-title">👍 {t.recentReviews}</div>

          <div className="reviews-scroll-list">
            {reviews.length === 0 && (
              <div className="empty-note">No citizen reviews recorded yet.</div>
            )}
            {reviews.map((rev) => (
              <div key={rev.id} className="review-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: '#111827' }}>
                      {rev.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                      {rev.location} {rev.ticket_id && `• Ref: ${rev.ticket_id}`} • {new Date(rev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ color: '#f59e0b', fontSize: 14, letterSpacing: 1 }}>
                    {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                  </div>
                </div>

                <p style={{ fontSize: 12.5, color: '#374151', fontStyle: 'italic', margin: '6px 0', lineHeight: 1.5 }}>
                  "{rev.comment}"
                </p>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                    background: '#e0f2fe', color: '#0369a1',
                  }}>
                    {rev.category}
                  </span>
                </div>

                {rev.action_note && (
                  <div style={{
                    marginTop: 8, padding: '6px 10px', background: '#fef3c7',
                    borderLeft: '3px solid #d97706', borderRadius: 4, fontSize: 11.5,
                  }}>
                    <strong style={{ color: '#92400e' }}>{t.ndmaActionNote}: </strong>
                    <span style={{ color: '#78350f' }}>{rev.action_note}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
