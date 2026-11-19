// How a refresh answer is read, and how restoring a session waits out a
// sleeping or restarting API. Free of fetch and React so it can be unit tested.

/** What a refresh attempt tells us about the session. */
export type RefreshOutcome = "ok" | "signed-out" | "unavailable";

/**
 * Reads POST /v1/auth/refresh's status. Only 401 means the session is gone;
 * 409 means another tab refreshed the same cookie a moment ago (try again);
 * anything else (403, 429, 5xx) says nothing about the session.
 */
export function readRefreshStatus(status: number): RefreshOutcome | "raced" {
  if (status >= 200 && status < 300) return "ok";
  if (status === 401) return "signed-out";
  if (status === 409) return "raced";
  return "unavailable";
}

/**
 * Waits between attempts while the API cannot answer. Render's free plan
 * takes 30–60 s to wake, so these cover about 90 s before giving up.
 */
export const RESTORE_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 30_000, 30_000];

/**
 * Tries to restore the session until the API gives a real answer: "ok" or
 * "signed-out". While it is unreachable, onWaiting is called before each
 * wait, and stop() can end the loop early (e.g. the user signed in meanwhile).
 * Returns "unavailable" if every attempt failed.
 */
export async function restoreWithRetry({
  attempt,
  sleep,
  onWaiting,
  stop = () => false,
  delays = RESTORE_DELAYS_MS,
}: {
  attempt: () => Promise<RefreshOutcome>;
  sleep: (ms: number) => Promise<void>;
  onWaiting?: () => void;
  stop?: () => boolean;
  delays?: number[];
}): Promise<RefreshOutcome> {
  for (let i = 0; ; i++) {
    const outcome = await attempt();
    if (outcome !== "unavailable" || i >= delays.length || stop()) return outcome;
    onWaiting?.();
    await sleep(delays[i]);
    if (stop()) return outcome;
  }
}
