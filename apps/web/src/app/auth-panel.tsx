"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import { getAuthProviders, startLineLogin, type AuthProviders } from "@/lib/api";
import { signIn, signInFailed, signOut, useAuth } from "@/lib/auth";

import { Avatar } from "./avatar";
import { GoogleG, LineIcon } from "./provider-icons";

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type GoogleId = {
  initialize(opts: { client_id: string; callback: (r: { credential: string }) => void }): void;
  renderButton(el: HTMLElement, opts: Record<string, string | number>): void;
  disableAutoSelect(): void;
};

type CodeClient = { requestCode(): void };

type GoogleOAuth2 = {
  initCodeClient(cfg: {
    client_id: string;
    scope: string;
    ux_mode: "popup";
    select_account?: boolean;
    callback: (r: { code?: string; error?: string }) => void;
    error_callback?: (e: { type: string }) => void;
  }): CodeClient;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId; oauth2: GoogleOAuth2 } };
  }
}

const LINE_CALLBACK = "/auth/line/callback";

export function AuthPanel() {
  const state = useAuth();
  const [gisReady, setGisReady] = useState(false);
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const [pending, setPending] = useState<"google" | "line" | null>(null);
  const codeClient = useRef<CodeClient | null>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);

  const signedOut = state.kind === "signed-out";

  useEffect(() => {
    if (signedOut) void getAuthProviders().then(setProviders);
  }, [signedOut]);

  useEffect(() => {
    const google = window.google?.accounts;
    if (!gisReady || !google || !clientId || !signedOut || !providers) return;
    if (providers.google_code) {
      // Our own button: GIS opens Google's account chooser in a popup and
      // returns a one-time code; the API swaps it for a verified ID token.
      codeClient.current = google.oauth2.initCodeClient({
        client_id: clientId,
        scope: "openid email profile",
        ux_mode: "popup",
        select_account: true,
        callback: async (r) => {
          if (r.code) await signIn({ code: r.code });
          setPending(null);
        },
        error_callback: () => setPending(null), // popup closed or blocked
      });
      return;
    }
    // API without GOOGLE_CLIENT_SECRET: fall back to Google's rendered button.
    if (!fallbackRef.current) return;
    google.id.initialize({ client_id: clientId, callback: ({ credential }) => signIn({ id_token: credential }) });
    google.id.renderButton(fallbackRef.current, {
      theme: "filled_black",
      size: "large",
      shape: "pill",
      text: "signin_with",
      locale: "th",
      width: Math.min(400, fallbackRef.current.clientWidth),
    });
  }, [gisReady, signedOut, providers]);

  async function startLine() {
    setPending("line");
    try {
      window.location.assign(await startLineLogin(window.location.origin + LINE_CALLBACK));
    } catch {
      setPending(null);
      signInFailed("เปิดหน้าเข้าสู่ระบบ LINE ไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Script src="https://accounts.google.com/gsi/client" onReady={() => setGisReady(true)} />
      {state.kind === "checking" && <p className="text-sm text-faint">กำลังตรวจสอบการเข้าสู่ระบบ…</p>}
      {state.kind === "signed-out" && (
        <>
          <p className="text-sm text-muted">เข้าสู่ระบบเพื่อเก็บประวัติและรับคำเตือน (ดูท่าและวิธีทำได้โดยไม่ต้องเข้าสู่ระบบ)</p>
          {providers?.google_code ? (
            <GoogleButton
              disabled={!gisReady || pending !== null}
              busy={pending === "google"}
              onClick={() => {
                setPending("google");
                codeClient.current?.requestCode();
              }}
            />
          ) : (
            // GIS buttons are at most 400px wide, so center it instead of leaving a gap.
            <div ref={fallbackRef} className="flex min-h-11 w-full justify-center" />
          )}
          {providers?.line && <LineButton disabled={pending !== null} busy={pending === "line"} onClick={startLine} />}
          <p className="text-xs leading-relaxed text-faint">
            เมื่อเข้าสู่ระบบ จะมีให้อ่านและยอมรับ{" "}
            <Link href="/terms" className="underline underline-offset-4 hover:text-fg">
              ข้อตกลงการใช้งาน
            </Link>{" "}
            และ{" "}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-fg">
              นโยบายความเป็นส่วนตัว
            </Link>{" "}
            ก่อนเริ่มบันทึก
          </p>
          {!clientId && <p className="text-sm text-danger">ยังไม่ได้ตั้งค่า NEXT_PUBLIC_GOOGLE_CLIENT_ID</p>}
          {state.error && (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          )}
        </>
      )}
      {state.kind === "signed-in" && (
        <div className="flex items-center gap-3 pt-1">
          <Avatar user={state.user} size="sm" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-medium">{state.user.display_name || state.user.email}</p>
            <Link href="/account" className="text-muted hover:text-fg">
              โปรไฟล์และความเป็นส่วนตัว
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

type ButtonProps = { disabled: boolean; busy: boolean; onClick: () => void };

// Shared shape: same height and corners as the app's primary buttons.
const signInBtn =
  "relative inline-flex h-13 w-full items-center justify-center gap-3 rounded-2xl px-5 text-base font-semibold transition-[filter,transform] duration-150 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 cursor-pointer";

/**
 * Google's branding rules: the "G" in its own four colours, unaltered, on a
 * white, #131314 or #F2F2F2 button. We use the white ("light") theme with
 * Google's #747775 border and #1F1F1F text; only the shape is ours.
 */
function GoogleButton({ disabled, busy, onClick }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${signInBtn} border border-[#747775] bg-white text-[#1F1F1F] hover:brightness-95`}
    >
      <GoogleG />
      {busy ? "กำลังเปิด Google…" : "เข้าสู่ระบบด้วย Google"}
    </button>
  );
}

/**
 * LINE's branding rules: LINE green #06C755 with the white LINE icon, a thin
 * divider after the icon, and a darker overlay on hover/press.
 */
function LineButton({ disabled, busy, onClick }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${signInBtn} bg-[#06C755] text-white hover:brightness-90 active:brightness-75`}
    >
      <span className="flex items-center gap-3">
        <LineIcon />
        <span aria-hidden className="h-6 w-px bg-black/10" />
      </span>
      {busy ? "กำลังไปที่ LINE…" : "เข้าสู่ระบบด้วย LINE"}
    </button>
  );
}
