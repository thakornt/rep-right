"use client";

import { useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";

type Status =
  | { state: "loading" }
  | { state: "ok"; version: string }
  | { state: "error" };

const dot = { loading: "bg-warn animate-pulse", ok: "bg-health", error: "bg-danger" };

// Checks the web → /api rewrite → Go API path end to end. Runs in the browser
// so the page stays static; the free API host can take ~60s to wake up.
export function ApiStatus() {
  const [status, setStatus] = useState<Status>({ state: "loading" });

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`${apiUrl}/healthz`, { signal: ctrl.signal, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((body: { version?: string }) =>
        setStatus({ state: "ok", version: body.version ?? "unknown" }),
      )
      .catch(() => {
        if (!ctrl.signal.aborted) setStatus({ state: "error" });
      });
    return () => ctrl.abort();
  }, []);

  return (
    <p className="flex items-center gap-2 text-xs text-faint" aria-live="polite">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot[status.state]}`} />
      {status.state === "loading" && "กำลังเชื่อมต่อ server (ครั้งแรกอาจใช้เวลาถึง 1 นาที)…"}
      {status.state === "ok" && (
        <>
          server พร้อมใช้งาน <code className="font-mono">{status.version.slice(0, 7)}</code>
        </>
      )}
      {status.state === "error" && "เชื่อมต่อ server ไม่ได้"}
    </p>
  );
}
