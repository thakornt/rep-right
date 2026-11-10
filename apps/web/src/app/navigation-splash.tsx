"use client";

import { useNavigating } from "@/lib/navigating";

import { LogoMark } from "./logo-mark";

/**
 * Full-screen splash while a page change waits on the network, so a tap never
 * looks ignored. It fades in after a short delay, so fast navigations never
 * flash it, and sits under the tab bar, so the tapped tab stays visible.
 */
export function NavigationSplash() {
  const navigating = useNavigating();
  if (!navigating) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="splash-in fixed inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-bg"
    >
      <LogoMark className="splash-breathe h-16 w-16" />
      <div aria-hidden className="h-1 w-28 overflow-hidden rounded-full bg-raised">
        <div className="splash-bar h-full w-1/3 rounded-full bg-primary" />
      </div>
      <span className="sr-only">กำลังเปิดหน้า…</span>
    </div>
  );
}
