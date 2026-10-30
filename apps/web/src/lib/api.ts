// API client. The access token lives only in memory (never localStorage);
// the refresh token is an httpOnly cookie the browser sends to /api itself.

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export type User = {
  id: string;
  email: string;
  display_name: string;
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

export async function signInWithGoogle(idToken: string): Promise<User> {
  const res = await post("/v1/auth/google", { id_token: idToken });
  if (!res.ok) throw await parseError(res);
  const body = (await res.json()) as TokenResponse;
  accessToken = body.access_token;
  return body.user!;
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
