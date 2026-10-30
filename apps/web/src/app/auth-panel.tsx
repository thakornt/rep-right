"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

import { getMe, refreshSession, signInWithGoogle, signOut, type User } from "@/lib/api";

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type GoogleId = {
  initialize(opts: { client_id: string; callback: (r: { credential: string }) => void }): void;
  renderButton(el: HTMLElement, opts: Record<string, string | number>): void;
  disableAutoSelect(): void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

type State = { kind: "checking" } | { kind: "signed-out"; error?: string } | { kind: "signed-in"; user: User };

export function AuthPanel() {
  const [state, setState] = useState<State>({ kind: "checking" });
  const [gisReady, setGisReady] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  // Restore the session from the refresh cookie on load.
  useEffect(() => {
    let cancelled = false;
    refreshSession()
      .then(async (ok) => (ok ? getMe() : null))
      .then((user) => {
        if (!cancelled) setState(user ? { kind: "signed-in", user } : { kind: "signed-out" });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "signed-out" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onCredential = useCallback(async ({ credential }: { credential: string }) => {
    try {
      setState({ kind: "signed-in", user: await signInWithGoogle(credential) });
    } catch {
      setState({ kind: "signed-out", error: "เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง" });
    }
  }, []);

  useEffect(() => {
    const gid = window.google?.accounts.id;
    if (!gisReady || !gid || !clientId || state.kind !== "signed-out" || !buttonRef.current) return;
    gid.initialize({ client_id: clientId, callback: onCredential });
    // A fixed width keeps the generic and the personalised ("ลงชื่อเข้าใช้เป็น …")
    // buttons the same size; GIS caps width at 400px.
    const width = Math.min(400, buttonRef.current.clientWidth);
    gid.renderButton(buttonRef.current, { theme: "outline", size: "large", text: "signin_with", locale: "th", width });
  }, [gisReady, state.kind, onCredential]);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <Script src="https://accounts.google.com/gsi/client" onReady={() => setGisReady(true)} />
      {state.kind === "checking" && <p className="text-sm text-zinc-500">กำลังตรวจสอบการเข้าสู่ระบบ…</p>}
      {state.kind === "signed-out" && (
        <>
          {/* GIS buttons are at most 400px wide, so center it instead of leaving a gap. */}
          <div ref={buttonRef} className="flex min-h-11 w-full justify-center" />
          {!clientId && <p className="text-sm text-red-600">ยังไม่ได้ตั้งค่า NEXT_PUBLIC_GOOGLE_CLIENT_ID</p>}
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        </>
      )}
      {state.kind === "signed-in" && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm">
            เข้าสู่ระบบแล้ว: <span className="font-medium">{state.user.display_name || state.user.email}</span>
          </p>
          <button
            type="button"
            className="h-11 rounded-full border border-zinc-300 px-5 text-sm font-medium dark:border-zinc-700"
            onClick={async () => {
              await signOut();
              window.google?.accounts.id.disableAutoSelect();
              setState({ kind: "signed-out" });
            }}
          >
            ออกจากระบบ
          </button>
        </div>
      )}
    </section>
  );
}
