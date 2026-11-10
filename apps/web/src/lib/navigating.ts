"use client";

import { useEffect, useId, useSyncExternalStore } from "react";

// Which navigations are still waiting on the network. Any component that starts
// one reports it here; the loading splash shows while the set is not empty.
const waiting = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Report that this component's navigation is pending (e.g. from useLinkStatus or useTransition). */
export function useReportNavigating(pending: boolean) {
  const id = useId();
  useEffect(() => {
    if (!pending) return;
    waiting.add(id);
    emit();
    return () => {
      waiting.delete(id);
      emit();
    };
  }, [id, pending]);
}

/** True while any reported navigation is pending. */
export function useNavigating() {
  return useSyncExternalStore(
    subscribe,
    () => waiting.size > 0,
    () => false,
  );
}
