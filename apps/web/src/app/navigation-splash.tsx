"use client";

import { useNavigating } from "@/lib/navigating";

import { LogoLoader } from "./logo-loader";

/**
 * Full-screen splash while a page change waits on the network, so a tap never
 * looks ignored. It fades in after a short delay, so fast navigations never
 * flash it, and sits under the tab bar, so the tapped tab stays visible.
 */
export function NavigationSplash() {
  const navigating = useNavigating();
  if (!navigating) return null;
  return <LogoLoader label="กำลังเปิดหน้า…" className="splash-in fixed inset-0 z-10 bg-bg" />;
}
