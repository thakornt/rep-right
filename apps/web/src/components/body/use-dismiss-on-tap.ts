"use client";

import { useEffect, useRef } from "react";

const TAP_SLOP = 8; // pixels a press may move and still count as a tap rather than a drag to turn the view

// Closes an open popup when the user taps anywhere outside it, so they needn't hit a moving pin
// again. A drag (turning the view) doesn't close it, and taps on the pins themselves are left to
// the pins, which open their own tip or close their own.
export function useDismissOnTap(open: boolean, close: () => void) {
  const popup = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    let start: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      start = { x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      if (!start) return;
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      start = null;
      if (moved > TAP_SLOP) return;
      const target = e.target as Element | null;
      if (target && (popup.current?.contains(target) || target.closest("[data-pin]"))) return;
      close();
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("pointerup", up);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointerup", up);
    };
  }, [open, close]);
  return popup;
}
