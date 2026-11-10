"use client";

// Whether the signed-in user has accepted the current terms and privacy policy.
// Shared across pages so moving between them doesn't ask the API again.

import { useEffect, useSyncExternalStore } from "react";

import { grantConsent, listConsents } from "./api";
import { useAuth } from "./auth";
import { TERMS_VERSION } from "./legal";

export type TermsState = "checking" | "accepted" | "needed" | "error";

let forUser = "";
let state: TermsState = "checking";
const listeners = new Set<() => void>();

function set(user: string, next: TermsState) {
  if (user !== forUser) return; // signed out or switched account meanwhile
  state = next;
  listeners.forEach((l) => l());
}

function load(user: string) {
  forUser = user;
  state = "checking";
  listConsents()
    .then((cs) => set(user, cs.some((c) => c.kind === "terms" && c.version === TERMS_VERSION) ? "accepted" : "needed"))
    .catch(() => set(user, "error"));
}

export function useTerms(): TermsState {
  const auth = useAuth();
  const user = auth.kind === "signed-in" ? auth.user.id : "";
  useEffect(() => {
    if (user && user !== forUser) load(user);
    if (!user) forUser = "";
  }, [user]);
  const current = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => "checking" as const,
  );
  return user && user === forUser ? current : "checking";
}

export async function acceptTerms() {
  const user = forUser;
  await grantConsent("terms", TERMS_VERSION);
  set(user, "accepted");
}

export function retryTerms() {
  if (forUser) load(forUser);
}
