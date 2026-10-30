"use client";

import { useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";

type Status =
  | { state: "loading" }
  | { state: "ok"; version: string }
  | { state: "error" };

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
    <p className="text-sm text-zinc-500" aria-live="polite">
      {status.state === "loading" && "กำลังเชื่อมต่อ server (ครั้งแรกอาจใช้เวลาถึง 1 นาที)…"}
      {status.state === "ok" && (
        <>
          server พร้อมใช้งาน{" "}
          <code className="font-mono text-xs">{status.version.slice(0, 7)}</code>
        </>
      )}
      {status.state === "error" && "เชื่อมต่อ server ไม่ได้"}
    </p>
  );
}
