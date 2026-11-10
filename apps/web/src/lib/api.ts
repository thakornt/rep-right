// API client. The access token lives only in memory (never localStorage);
// the refresh token is an httpOnly cookie the browser sends to /api itself.

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export type Provider = "google" | "line";

export type User = {
  id: string;
  email: string; // "" when LINE did not share one
  display_name: string;
  picture_url: string; // "" = no picture
  providers: Provider[];
  created_at: string;
};

type TokenResponse = { access_token: string; expires_in: number; user?: User };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
// One refresh at a time: concurrent 401s wait on the same promise instead of
// each rotating the cookie (which the server would treat as token reuse).
let refreshing: Promise<boolean> | null = null;

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    return new ApiError(res.status, body.error?.code ?? "unknown", body.error?.message ?? res.statusText);
  } catch {
    return new ApiError(res.status, "unknown", res.statusText);
  }
}

function post(path: string, body?: unknown): Promise<Response> {
  return fetch(`${apiUrl}${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Exchanges the refresh cookie for a new access token. False = signed out. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= post("/v1/auth/refresh")
    .then(async (res) => {
      if (!res.ok) {
        accessToken = null;
        return false;
      }
      accessToken = ((await res.json()) as TokenResponse).access_token;
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function startSession(path: string, body: unknown): Promise<User> {
  const res = await post(path, body);
  if (!res.ok) throw await parseError(res);
  const tokens = (await res.json()) as TokenResponse;
  accessToken = tokens.access_token;
  return tokens.user!;
}

/** Google sign-in with an ID token (Google's own button) or an authorization code (our button). */
export const signInWithGoogle = (proof: { id_token: string } | { code: string }) =>
  startSession("/v1/auth/google", proof);

/** Finishes LINE Login with what LINE sent to /auth/line/callback. */
export const signInWithLine = (code: string, state: string) => startSession("/v1/auth/line", { code, state });

export type AuthProviders = { google_code: boolean; line: boolean };

/** Which sign-in buttons this API can serve. An older API (404) means Google's own button only. */
export async function getAuthProviders(): Promise<AuthProviders> {
  try {
    const res = await fetch(`${apiUrl}/v1/auth/providers`);
    if (res.ok) return (await res.json()) as AuthProviders;
  } catch {
    // offline or API down: fall through
  }
  return { google_code: false, line: false };
}

/** Starts LINE Login; returns the LINE page to send the browser to. */
export async function startLineLogin(redirectUri: string): Promise<string> {
  const res = await post("/v1/auth/line/start", { redirect_uri: redirectUri });
  if (!res.ok) throw await parseError(res);
  return ((await res.json()) as { url: string }).url;
}

export async function signOut(): Promise<void> {
  accessToken = null;
  await post("/v1/auth/logout").catch(() => undefined);
}

/** Authenticated request; on 401 refreshes once and retries. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const send = () =>
    fetch(`${apiUrl}${path}`, {
      ...init,
      credentials: "same-origin",
      headers: {
        ...init.headers,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });

  let res = await send();
  if (res.status === 401 && (await refreshSession())) {
    res = await send();
  }
  if (!res.ok) throw await parseError(res);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const getMe = () => apiFetch<User>("/v1/me");

/** Longest display name the API accepts, in characters. */
export const MAX_DISPLAY_NAME = 50;

export const updateDisplayName = (displayName: string) =>
  apiFetch<User>("/v1/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: displayName }),
  });

export type Exercise = {
  id: number;
  slug: string;
  name_th: string;
  name_en: string;
  category: string;
  is_lower_body: boolean;
  muscles: string[];
};

export type SetEntry = { exercise_id: number; weight_kg: number; reps: number; rpe: number | null };

export type SessionInput = {
  performed_at: string; // YYYY-MM-DD
  notes: string;
  pain_flag: boolean;
  sets: SetEntry[];
};

export type Session = SessionInput & { id: string; created_at: string; updated_at: string };

const json = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function getExercises(): Promise<Exercise[]> {
  const res = await fetch(`${apiUrl}/v1/exercises`);
  if (!res.ok) throw await parseError(res);
  return ((await res.json()) as { exercises: Exercise[] }).exercises;
}

export const createSession = (s: SessionInput) =>
  apiFetch<Session>("/v1/sessions", { method: "POST", ...json(s) });

export const listSessions = async (from?: string, to?: string) => {
  const q = new URLSearchParams();
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  const qs = q.size ? `?${q}` : "";
  return (await apiFetch<{ sessions: Session[] }>(`/v1/sessions${qs}`)).sessions;
};

export const deleteSession = (id: string) => apiFetch<void>(`/v1/sessions/${id}`, { method: "DELETE" });

/** Latest session with this exercise (its sets only), or null if never done. */
export async function getLastSession(slug: string): Promise<Session | null> {
  try {
    return await apiFetch<Session>(`/v1/sessions/last?exercise=${encodeURIComponent(slug)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** Current wording version of the health-data consent shown in the app. */
export const HEALTH_CONSENT_VERSION = "2026-10";

export type ConsentKind = "terms" | "health_data";
export type Consent = { kind: ConsentKind; version: string; accepted_at: string };

export const grantConsent = (kind: ConsentKind, version: string) =>
  apiFetch<Consent>("/v1/me/consents", { method: "POST", ...json({ kind, version }) });

export const listConsents = async () => (await apiFetch<{ consents: Consent[] }>("/v1/me/consents")).consents;

/** Removes every version of the consent; withdrawing health_data also clears all pain flags. */
export const withdrawConsent = (kind: ConsentKind) =>
  apiFetch<void>(`/v1/me/consents/${kind}`, { method: "DELETE" });

/** Hard-deletes the account and all its data; the server also clears the refresh cookie. */
export async function deleteAccount(): Promise<void> {
  await apiFetch<void>("/v1/me", { method: "DELETE" });
  accessToken = null;
}

export type Finding = {
  rule: "weight_jump" | "volume_spike" | "high_rpe_streak" | "pain";
  level: "caution" | "risk";
  value: number;
  message: string;
};

export type LoadExercise = {
  exercise_id: number;
  slug: string;
  name_th: string;
  advice: "progress_ok" | "hold" | "no_increase";
  findings: Finding[];
};

export type LoadReport = { disclaimer: string; pain: boolean; exercises: LoadExercise[] };

export type ReturnPlan = {
  exercise_id: number;
  slug: string;
  name_th: string;
  last_performed_at: string;
  days_off: number;
  top_set_kg: number;
  start_percent_min: number;
  start_percent_max: number;
  start_weight_kg: number;
  ramp_weeks: number;
  steps: { week: number; percent: number; weight_kg: number }[];
};

export const getLoadInsights = () => apiFetch<LoadReport>("/v1/insights/load");

export const getReturnPlan = async () =>
  (await apiFetch<{ disclaimer: string; exercises: ReturnPlan[] }>("/v1/insights/return-plan")).exercises;
