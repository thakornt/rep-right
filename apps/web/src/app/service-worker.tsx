"use client";

import { useEffect } from "react";

// Registers public/sw.js in production builds only: in development it would
// cache pages that hot reload is about to change.
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
