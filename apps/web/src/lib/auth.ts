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
  type User,
} from "./api";

export type AuthState =
  | { kind: "checking" }
  | { kind: "signed-out"; error?: string }
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
  refreshSession()
    .then(async (ok) => (ok ? getMe() : null))
    .then((user) => settle(user ? { kind: "signed-in", user } : { kind: "signed-out" }))
    .catch(() => settle({ kind: "signed-out" }));
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
    set({ kind: "signed-out", error: "เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง" });
  }
}

/** Google's own button gives an ID token; our button gives an authorization code. */
export const signIn = (proof: { id_token: string } | { code: string }) => signInWith(() => signInWithGoogle(proof));

export const signInLine = (code: string, state: string) => signInWith(() => signInWithLine(code, state));

/** Shows a sign-in error on the home page (e.g. the user cancelled at LINE). */
export function signInFailed(error: string) {
  decided();
  set({ kind: "signed-out", error });
}

export async function signOut() {
  await apiSignOut();
  set({ kind: "signed-out" });
}

export async function deleteAccount() {
  await apiDeleteAccount();
  set({ kind: "signed-out" });
}
