"use client";

// Signed-in state shared by every page. The first subscriber restores the
// session from the refresh cookie; later pages reuse the result.

import { useSyncExternalStore } from "react";

import {
  deleteAccount as apiDeleteAccount,
  getMe,
  refreshSession,
  signInWithGoogle,
  signInWithLine,
  signOut as apiSignOut,
  updateDisplayName,
  type User,
} from "./api";
import type { Messages } from "./i18n/messages";
import { restoreWithRetry } from "./session-restore";

/** Why the last sign-in failed; the page shows it in the visitor's language. */
export type AuthError = keyof Messages["auth"]["errors"];

export type AuthState =
  /** reconnecting: the API is asleep or restarting; we keep trying before deciding. */
  | { kind: "checking"; reconnecting?: boolean }
  | { kind: "signed-out"; error?: AuthError }
  | { kind: "signed-in"; user: User };

let state: AuthState = { kind: "checking" };
let started = false;
// Bumped by every explicit sign-in result so a session restore cannot
// overwrite it: one that started earlier (e.g. on the LINE callback page) is
// ignored, and none starts later.
let generation = 0;

function decided() {
  generation++;
  started = true;
}
const listeners = new Set<() => void>();

function set(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

function restore() {
  if (started) return;
  started = true;
  const gen = generation;
  const settle = (next: AuthState) => {
    if (gen === generation) set(next);
  };
  // Only a 401 on refresh means signed out. While the API cannot answer
  // (asleep, restarting after a deploy, offline) keep "checking" and retry,
  // so a slow server never looks like a lost session.
  restoreWithRetry({
    attempt: refreshSession,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    onWaiting: () => settle({ kind: "checking", reconnecting: true }),
    stop: () => gen !== generation,
  })
    .then(async (outcome) => {
      if (outcome === "ok") return settle({ kind: "signed-in", user: await getMe() });
      settle(outcome === "unavailable" ? { kind: "signed-out", error: "unavailable" } : { kind: "signed-out" });
    })
    .catch(() => settle({ kind: "signed-out", error: "unavailable" }));
}

function subscribe(l: () => void) {
  listeners.add(l);
  restore();
  return () => listeners.delete(l);
}

const serverState: AuthState = { kind: "checking" };

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => state, () => serverState);
}

async function signInWith(attempt: () => Promise<User>) {
  decided();
  try {
    set({ kind: "signed-in", user: await attempt() });
  } catch {
    set({ kind: "signed-out", error: "failed" });
  }
}

/** Google's own button gives an ID token; our button gives an authorization code. */
export const signIn = (proof: { id_token: string } | { code: string }) => signInWith(() => signInWithGoogle(proof));

export const signInLine = (code: string, state: string) => signInWith(() => signInWithLine(code, state));

/** Shows a sign-in error on the home page (e.g. the user cancelled at LINE). */
export function signInFailed(error: AuthError) {
  decided();
  set({ kind: "signed-out", error });
}

export async function signOut() {
  await apiSignOut();
  set({ kind: "signed-out" });
}

/** Saves a new display name and shows it everywhere at once. */
export async function rename(displayName: string) {
  const user = await updateDisplayName(displayName);
  if (state.kind === "signed-in") set({ kind: "signed-in", user });
}

export async function deleteAccount() {
  await apiDeleteAccount();
  set({ kind: "signed-out" });
}
