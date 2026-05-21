const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type QueryParams = Record<string, string | number | boolean | undefined | null>;

function token(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage?.getItem("token");
}

function query(params: QueryParams = {}): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") q.set(key, String(value));
  });
  const text = q.toString();
  return text ? `?${text}` : "";
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const authToken = token();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    },
  });

  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((json.error as string) || (json.message as string) || "Request failed");
  }
  return json.data ?? json;
}

interface CreatePredictionBody {
  [key: string]: unknown;
}

interface CreateThreadBody {
  [key: string]: unknown;
}

interface CreateCommentBody {
  [key: string]: unknown;
}

interface CreateCodeBody {
  [key: string]: unknown;
}

interface TrackClickBody {
  eventName: string;
  [key: string]: unknown;
}

export const communityApi = {
  getPredictions: (params?: QueryParams) => apiFetch(`/api/predictions${query(params)}`),
  getPrediction: (id: string | number) => apiFetch(`/api/predictions/${id}`),
  createPrediction: (body: CreatePredictionBody) => apiFetch("/api/predictions", {
    method: "POST",
    body: JSON.stringify(body),
  }),
  likePrediction: (id: string | number) => apiFetch(`/api/predictions/${id}/like`, {
    method: "POST",
  }),

  getCreators: () => apiFetch("/api/creators"),
  getCreator: (id: string | number) => apiFetch(`/api/creators/${id}`),
  getLeaderboard: () => apiFetch("/api/creators/leaderboard"),
  getPlatformStats: () => apiFetch("/api/platform/stats"),
  getCreatorDashboard: () => apiFetch("/api/dashboard/creator"),
  getUserDashboard: () => apiFetch("/api/dashboard/me"),

  getThreads: (params?: QueryParams) => apiFetch(`/api/forum/threads${query(params)}`),
  getThread: (id: string | number) => apiFetch(`/api/forum/threads/${id}`),
  createThread: (body: CreateThreadBody) => apiFetch("/api/forum/threads", {
    method: "POST",
    body: JSON.stringify(body),
  }),
  likeThread: (id: string | number) => apiFetch(`/api/forum/threads/${id}/like`, {
    method: "POST",
  }),

  getComments: (targetType: string, targetId: string | number) => apiFetch(`/api/comments${query({ targetType, targetId })}`),
  createComment: (body: CreateCommentBody) => apiFetch("/api/comments", {
    method: "POST",
    body: JSON.stringify(body),
  }),
  likeComment: (id: string | number) => apiFetch(`/api/comments/${id}/like`, {
    method: "POST",
  }),

  followCreator: (id: string | number) => apiFetch(`/api/creators/${id}/follow`, {
    method: "POST",
  }) as Promise<{ following: boolean; followers: number }>,

  createCode: (body: CreateCodeBody) => apiFetch("/api/codes", {
    method: "POST",
    body: JSON.stringify(body),
  }),

  trackClick: (body: TrackClickBody) => apiFetch("/api/tracking/click", {
    method: "POST",
    body: JSON.stringify(body),
  }),

  getMe: () => apiFetch("/api/me"),
  updateProfile: (body: { display_name?: string; bio?: string; avatar_url?: string }) =>
    apiFetch("/api/me/profile", { method: "PUT", body: JSON.stringify(body) }),
  becomeCreator: () => apiFetch("/api/me/become-creator", { method: "POST" }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    apiFetch("/api/me/password", { method: "PUT", body: JSON.stringify(body) }),
};
