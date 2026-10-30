"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import { signIn, signOut, useAuth } from "@/lib/auth";

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

export function AuthPanel() {
  const state = useAuth();
  const [gisReady, setGisReady] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const gid = window.google?.accounts.id;
    if (!gisReady || !gid || !clientId || state.kind !== "signed-out" || !buttonRef.current) return;
    gid.initialize({ client_id: clientId, callback: ({ credential }) => signIn(credential) });
    // A fixed width keeps the generic and the personalised ("ลงชื่อเข้าใช้เป็น …")
    // buttons the same size; GIS caps width at 400px.
    const width = Math.min(400, buttonRef.current.clientWidth);
    gid.renderButton(buttonRef.current, {
      theme: "filled_black",
      size: "large",
      shape: "pill",
      text: "signin_with",
      locale: "th",
      width,
    });
  }, [gisReady, state.kind]);

  return (
    <div className="flex flex-col gap-2">
      <Script src="https://accounts.google.com/gsi/client" onReady={() => setGisReady(true)} />
      {state.kind === "checking" && <p className="text-sm text-faint">กำลังตรวจสอบการเข้าสู่ระบบ…</p>}
      {state.kind === "signed-out" && (
        <>
          <p className="text-sm text-muted">เข้าสู่ระบบเพื่อเก็บประวัติและรับคำเตือน (ดูท่าและวิธีทำได้โดยไม่ต้องเข้าสู่ระบบ)</p>
          {/* GIS buttons are at most 400px wide, so center it instead of leaving a gap. */}
          <div ref={buttonRef} className="flex min-h-11 w-full justify-center" />
          {!clientId && <p className="text-sm text-danger">ยังไม่ได้ตั้งค่า NEXT_PUBLIC_GOOGLE_CLIENT_ID</p>}
          {state.error && <p className="text-sm text-danger">{state.error}</p>}
        </>
      )}
      {state.kind === "signed-in" && (
        <div className="flex items-center gap-3 pt-1">
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-raised text-sm font-semibold text-primary"
          >
            {(state.user.display_name || state.user.email).slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-medium">{state.user.display_name || state.user.email}</p>
            <Link href="/account" className="text-muted hover:text-fg">
              บัญชีและความเป็นส่วนตัว
            </Link>
          </div>
          <button
            type="button"
            className="h-10 shrink-0 rounded-full px-3 text-sm text-muted transition-colors hover:bg-raised hover:text-fg cursor-pointer"
            onClick={async () => {
              window.google?.accounts.id.disableAutoSelect();
              await signOut();
            }}
          >
            ออกจากระบบ
          </button>
        </div>
      )}
    </div>
  );
}
