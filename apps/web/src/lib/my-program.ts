"use client";

// The program the user picked on /programs.
// - Signed out: kept in this browser only (localStorage).
// - Signed in: saved on the account (/v1/me/program). This browser keeps a
//   copy so the home page can show it at once; at sign-in the two are merged
//   by syncProgramAtSignIn (the account wins), and at sign-out the copy is
//   removed so the next person on this device does not see it.

import { useEffect, useSyncExternalStore } from "react";

import { programFromCustomId } from "../content/custom-program";
import { PROGRAMS, type Program } from "../content/programs";
import { deleteMyProgram, getMyProgram, putMyProgram } from "./api";
import { useAuth } from "./auth";
import { syncProgramAtSignIn } from "./program-sync";

const KEY = "repright.program";
const EVENT = "repright:program";

/** A ready-made program by id, or the week a custom id describes (content/custom-program.ts). */
export const programById = (id: string): Program | null =>
  PROGRAMS.find((p) => p.id === id) ?? programFromCustomId(id);

const known = (id: string) => programById(id) !== null;

/** The signed-in user whose account holds the choice; null when signed out. */
let accountUser: string | null = null;

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function writeLocal(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode or blocked storage: the choice just won't stick here.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Saves the choice here, and on the account when signed in. */
export async function saveMyProgram(id: string) {
  writeLocal(id);
  if (accountUser) await putMyProgram(id).catch(() => undefined);
}

/** Removes the choice here, and from the account when signed in. */
export async function clearMyProgram() {
  writeLocal(null);
  if (accountUser) await deleteMyProgram().catch(() => undefined);
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * The chosen program; null when none is chosen, undefined before the browser
 * has been read (server render and hydration), so callers can avoid a flash.
 */
export function useMyProgram(): Program | null | undefined {
  const id = useSyncExternalStore(subscribe, read, () => undefined);
  if (id === undefined) return undefined;
  return id ? programById(id) : null;
}

/** Mounted once in the layout: merges the choice at sign-in, drops the copy at sign-out. */
export function ProgramSync() {
  const auth = useAuth();
  const userId = auth.kind === "signed-in" ? auth.user.id : null;
  const signedOut = auth.kind === "signed-out";

  useEffect(() => {
    if (userId && userId !== accountUser) {
      accountUser = userId;
      syncProgramAtSignIn({ local: read(), fetchAccount: getMyProgram, upload: putMyProgram, known })
        .then((id) => {
          if (accountUser === userId) writeLocal(id);
        })
        .catch(() => undefined); // offline: keep this device's copy until next time
    } else if (signedOut && accountUser) {
      accountUser = null;
      writeLocal(null);
    }
  }, [userId, signedOut]);

  return null;
}
