"use client";

// Signed-in state shared by every page. The first subscriber restores the
// session from the refresh cookie; later pages reuse the result.

import { useSyncExternalStore } from "react";

import { getMe, refreshSession, signInWithGoogle, signOut as apiSignOut, type User } from "./api";

export type AuthState =
  | { kind: "checking" }
  | { kind: "signed-out"; error?: string }
  | { kind: "signed-in"; user: User };

let state: AuthState = { kind: "checking" };
let started = false;
const listeners = new Set<() => void>();

function set(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

function restore() {
  if (started) return;
  started = true;
  refreshSession()
    .then(async (ok) => (ok ? getMe() : null))
    .then((user) => set(user ? { kind: "signed-in", user } : { kind: "signed-out" }))
    .catch(() => set({ kind: "signed-out" }));
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

export async function signIn(credential: string) {
  try {
    set({ kind: "signed-in", user: await signInWithGoogle(credential) });
  } catch {
    set({ kind: "signed-out", error: "เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง" });
  }
}

export async function signOut() {
  await apiSignOut();
  set({ kind: "signed-out" });
}
