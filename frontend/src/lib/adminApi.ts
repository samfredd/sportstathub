import {
  clearAdminSession,
  getStoredUser,
  storeAdminUser,
  type AdminUser,
} from './adminSession';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ApiError extends Error {
  status?: number;
}

function handleSessionExpired() {
  if (typeof window === 'undefined') return;
  clearAdminSession();
  window.location.replace('/admin/login?session=expired');
}

async function adminFetch(path: string, options: RequestInit = {}): Promise<any> {
  const hasBody = options.body !== undefined && options.body !== null;
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers as Record<string, string> || {}),
    },
  });

  if (res.status === 204) return null;

  if (res.status === 401) {
    handleSessionExpired();
    const err = new Error('Session expired. Please sign in again.') as ApiError;
    err.status = 401;
    throw err;
  }

  const json = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error((json?.error as string) || (json?.message as string) || 'Request failed') as ApiError;
    err.status = res.status;
    throw err;
  }
  return json.data ?? json;
}

type QueryRecord = Record<string, string | number | boolean | undefined | null>;

function toQuery(params: QueryRecord): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") q.set(key, String(value));
  });
  return q.toString();
}

// ─── Stats ─────────────────────────────────────────────────
export const adminApi = {
  login: (email: string, password: string) => adminFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),

  register: (username: string, email: string, password: string, inviteKey: string) =>
    adminFetch('/auth/admin/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, token: inviteKey }),
    }),

  beginMfaEnrollment: (mfaToken: string) => adminFetch('/auth/admin/mfa/enroll', {
    method: 'POST', body: JSON.stringify({ mfaToken }),
  }),
  verifyMfa: (mfaToken: string, code: string) => adminFetch('/auth/admin/mfa/verify', {
    method: 'POST', body: JSON.stringify({ mfaToken, code }),
  }),
  recoverMfa: (mfaToken: string, recoveryCode: string) => adminFetch('/auth/admin/mfa/recover', {
    method: 'POST', body: JSON.stringify({ mfaToken, recoveryCode }),
  }),
  logout: () => adminFetch('/auth/logout', { method: 'POST' }),

  getStats: () => adminFetch('/api/admin/stats'),

  // Users
  getUsers: (params: QueryRecord = {}) => {
    const q = toQuery(params);
    return adminFetch(`/api/admin/users${q ? `?${q}` : ''}`);
  },
  getUserById: (id: string | number) => adminFetch(`/api/admin/users/${id}`),
  updateUser:  (id: string | number, body: Record<string, unknown>) => adminFetch(`/api/admin/users/${id}`, { method: 'PUT',    body: JSON.stringify(body) }),
  deleteUser:  (id: string | number)                                 => adminFetch(`/api/admin/users/${id}`, { method: 'DELETE' }),

  // Booking Codes
  getCodes: (params: QueryRecord = {}) => {
    const q = toQuery(params);
    return adminFetch(`/api/admin/codes${q ? `?${q}` : ''}`);
  },
  createCode:  (body: Record<string, unknown>)                         => adminFetch('/api/admin/codes',         { method: 'POST',   body: JSON.stringify(body) }),
  updateCode:  (id: string | number, body: Record<string, unknown>)    => adminFetch(`/api/admin/codes/${id}`,   { method: 'PUT',    body: JSON.stringify(body) }),
  deleteCode:  (id: string | number)                                   => adminFetch(`/api/admin/codes/${id}`,   { method: 'DELETE' }),

  // Subscriptions
  getSubscriptions: (params: QueryRecord = {}) => {
    const q = toQuery(params);
    return adminFetch(`/api/admin/subscriptions${q ? `?${q}` : ''}`);
  },
  createSubscription: (body: Record<string, unknown>)                      => adminFetch('/api/admin/subscriptions',       { method: 'POST',   body: JSON.stringify(body) }),
  updateSubscription: (id: string | number, body: Record<string, unknown>) => adminFetch(`/api/admin/subscriptions/${id}`, { method: 'PUT',    body: JSON.stringify(body) }),
  deleteSubscription: (id: string | number)                                => adminFetch(`/api/admin/subscriptions/${id}`, { method: 'DELETE' }),

  // Audit
  getAuditLogs: (params: QueryRecord = {}) => {
    const q = toQuery(params);
    return adminFetch(`/api/admin/audit-logs${q ? `?${q}` : ''}`);
  },

  // Predictions
  getPredictions: (params: QueryRecord = {}) => {
    const q = toQuery(params);
    return adminFetch(`/api/admin/predictions${q ? `?${q}` : ''}`);
  },
  createAdminPrediction: (body: Record<string, unknown>) =>
    adminFetch('/api/admin/predictions', { method: 'POST', body: JSON.stringify(body) }),
  updatePrediction: (id: string | number, body: { status?: string; isPremium?: boolean }) =>
    adminFetch(`/api/admin/predictions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  updatePredictionStatus: (id: string | number, status: string) =>
    adminFetch(`/api/admin/predictions/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
  deletePrediction: (id: string | number) => adminFetch(`/api/admin/predictions/${id}`, { method: 'DELETE' }),

  // Subscription Plans
  getPlans: () => adminFetch('/api/admin/subscription-plans'),
  getPlan: (id: string | number) => adminFetch(`/api/admin/subscription-plans/${id}`),
  createPlan: (body: Record<string, unknown>) => adminFetch('/api/admin/subscription-plans', { method: 'POST', body: JSON.stringify(body) }),
  updatePlan: (id: string | number, body: Record<string, unknown>) => adminFetch(`/api/admin/subscription-plans/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePlan: (id: string | number) => adminFetch(`/api/admin/subscription-plans/${id}`, { method: 'DELETE' }),

  // Forum
  getThreads: (params: QueryRecord = {}) => {
    const q = toQuery(params);
    return adminFetch(`/api/admin/forum/threads${q ? `?${q}` : ''}`);
  },
  getThread: (id: string | number) => adminFetch(`/api/admin/forum/threads/${id}`),
  deleteThread: (id: string | number) => adminFetch(`/api/admin/forum/threads/${id}`, { method: 'DELETE' }),
  togglePinThread: (id: string | number) => adminFetch(`/api/admin/forum/threads/${id}/pin`, { method: 'PUT' }),
  deleteComment: (id: string | number) => adminFetch(`/api/admin/forum/comments/${id}`, { method: 'DELETE' }),
  getModerationReports: (status='open') => adminFetch(`/api/admin/moderation/reports?status=${encodeURIComponent(status)}`),
  moderateReport: (body: {reportId:number;action:string;reason:string}) => adminFetch('/api/admin/moderation/actions',{method:'POST',body:JSON.stringify(body)}),
  resolveModerationAppeal: (body:{appealId:number;decision:string;reason:string}) => adminFetch('/api/admin/moderation/appeals/resolve',{method:'POST',body:JSON.stringify(body)}),

  // Feature Flags
  getFeatureFlags: () => adminFetch('/api/admin/feature-flags'),
  updateFeatureFlag: (key: string, body: { required_plan?: string; is_enabled?: boolean }) =>
    adminFetch(`/api/admin/feature-flags/${encodeURIComponent(key)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getAiSettings: () => adminFetch('/api/admin/ai/settings'),
  updateAiSettings: (settings: Record<string,number>) => adminFetch('/api/admin/ai/settings',{method:'PUT',body:JSON.stringify({settings})}),

  // Daily stats chart
  getDailyStats: () => adminFetch('/api/admin/stats/daily'),
  getCreators: () => adminFetch('/api/admin/creators'),
  getSubscriptionFunnel: () => adminFetch('/api/admin/subscriptions/funnel'),
  getFilteredAuditLogs: (params: QueryRecord = {}) => {
    const q = toQuery(params);
    return adminFetch(`/api/admin/audit-logs/filtered${q ? `?${q}` : ''}`);
  },
  bulkUserAction: (body: { ids: number[]; action: string; payload?: object }) => adminFetch('/api/admin/users/bulk', { method: 'POST', body: JSON.stringify(body) }),
  updateUserStatus: (id: number, status: string) => adminFetch(`/api/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  getEnums: () => adminFetch('/api/admin/enums'),

  // Profile
  getProfile: () => adminFetch('/api/admin/me'),
  updateProfile: (body: Record<string, unknown>) => adminFetch('/api/admin/me', { method: 'PUT', body: JSON.stringify(body) }),
  changePassword: (body: Record<string, unknown>) => adminFetch('/api/admin/me/password', { method: 'PUT', body: JSON.stringify(body) }),
  getMyActivity: (params: QueryRecord = {}) => {
    const q = toQuery(params);
    return adminFetch(`/api/admin/me/activity${q ? `?${q}` : ''}`);
  },
};

// ─── JWT helpers ───────────────────────────────────────────
export { clearAdminSession, getStoredUser, storeAdminUser, type AdminUser };
