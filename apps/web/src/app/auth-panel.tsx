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
    gid.renderButton(buttonRef.current, { theme: "outline", size: "large", text: "signin_with", locale: "th", width });
  }, [gisReady, state.kind]);

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
          <div className="text-sm">
            <p>
              เข้าสู่ระบบแล้ว: <span className="font-medium">{state.user.display_name || state.user.email}</span>
            </p>
            <Link href="/account" className="text-zinc-500 underline">
              บัญชีและความเป็นส่วนตัว
            </Link>
          </div>
          <button
            type="button"
            className="h-11 rounded-full border border-zinc-300 px-5 text-sm font-medium dark:border-zinc-700"
            onClick={async () => {
              window.google?.accounts.id.disableAutoSelect();
              await signOut();
            }}
          >
            ออกจากระบบ
          </button>
        </div>
      )}
    </section>
  );
}
