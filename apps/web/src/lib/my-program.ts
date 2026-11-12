"use client";

// The program the user picked on /programs, kept in this browser only
// (a preference, not account data; nothing here is sent to the API).

import { useSyncExternalStore } from "react";

import { PROGRAMS, type Program } from "../content/programs";

const KEY = "repright.program";
const EVENT = "repright:program";

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveMyProgram(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Private mode or blocked storage: the choice just won't stick.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function clearMyProgram() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
  window.dispatchEvent(new Event(EVENT));
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
  return PROGRAMS.find((p) => p.id === id) ?? null;
}
