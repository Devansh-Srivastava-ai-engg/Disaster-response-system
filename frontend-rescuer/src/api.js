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
  getReports: () => request('/reports?all=true'),
  getDispatchLog: () => request('/dispatch-log'),
  submitReport: (report) => request('/reports', { method: 'POST', body: JSON.stringify(report) }),
  updateReportStatus: (id, status) => request(`/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  dispatch: (payload) => request('/dispatch', { method: 'POST', body: JSON.stringify(payload) }),
  addResource: (key, count = 1) => request(`/resources/${key}`, { method: 'PATCH', body: JSON.stringify({ count }) }),
  resetResources: () => request('/resources/reset', { method: 'POST' }),
  updateZoneConditions: (id, conditions) =>
    request(`/zones/${id}`, { method: 'PATCH', body: JSON.stringify(conditions) }),
  getBulletins: () => request('/early-warning-bulletins'),
  updateRescuerLocation: (id, lat, lng) =>
    request(`/reports/${id}/rescuer-location`, { method: 'PATCH', body: JSON.stringify({ lat, lng }) }),
};
