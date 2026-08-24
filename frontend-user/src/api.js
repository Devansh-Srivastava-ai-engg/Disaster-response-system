const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getZones: () => request('/zones'),
  getZoneRoutes: (id) => request(`/zones/${id}/routes`),
  getRecommendation: (id) => request(`/zones/${id}/recommendation`),
  getResources: () => request('/resources'),
  getSummary: () => request('/summary'),
  getReports: (userId) => request(userId ? `/reports?user_id=${encodeURIComponent(userId)}` : '/reports'),
  getDispatchLog: () => request('/dispatch-log'),
  submitReport: (report) => request('/reports', { method: 'POST', body: JSON.stringify(report) }),
  updateReportStatus: (id, status) => request(`/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  dispatch: (payload) => request('/dispatch', { method: 'POST', body: JSON.stringify(payload) }),
  getFeedback: () => request('/feedback'),
  submitFeedback: (feedback) => request('/feedback', { method: 'POST', body: JSON.stringify(feedback) }),
  getChatMessages: (channel) => request(channel && channel !== 'all' ? `/chat?channel=${encodeURIComponent(channel)}` : '/chat'),
  sendChatMessage: (msg) => request('/chat', { method: 'POST', body: JSON.stringify(msg) }),
  upvoteChatMessage: (id) => request(`/chat/${id}/upvote`, { method: 'POST' }),
  getShelters: (sectorId) => request(sectorId && sectorId !== 'all' ? `/shelters?sector_id=${encodeURIComponent(sectorId)}` : '/shelters'),
};
