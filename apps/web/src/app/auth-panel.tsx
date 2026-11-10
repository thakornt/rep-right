"use client";

import Link from "next/link";
import Script from "next/script";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { getAuthProviders, startLineLogin, type AuthProviders } from "@/lib/api";
import { signIn, signInFailed, signOut, useAuth } from "@/lib/auth";

import { Avatar } from "./avatar";

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type GoogleId = {
  initialize(opts: { client_id: string; callback: (r: { credential: string }) => void }): void;
  prompt(listener?: (n: PromptMoment) => void): void;
  disableAutoSelect(): void;
};

type CodeClient = { requestCode(): void };

type PromptMoment = { isNotDisplayed?: () => boolean; isSkippedMoment?: () => boolean };

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

  const signedOut = state.kind === "signed-out";

  useEffect(() => {
    if (signedOut) void getAuthProviders().then(setProviders);
  }, [signedOut]);

  useEffect(() => {
    const google = window.google?.accounts;
    if (!gisReady || !google || !clientId || !signedOut || !providers) return;
    if (providers.google_code) {
      // GIS opens Google's account chooser in a popup and returns a one-time
      // code; the API swaps it for a verified ID token.
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
    // API without GOOGLE_CLIENT_SECRET: our button opens Google's own
    // account prompt (One Tap), which hands back an ID token directly.
    google.id.initialize({
      client_id: clientId,
      callback: async ({ credential }) => {
        await signIn({ id_token: credential });
        setPending(null);
      },
    });
  }, [gisReady, signedOut, providers]);

  function startGoogle() {
    const google = window.google?.accounts;
    if (!google) return;
    setPending("google");
    if (codeClient.current) {
      codeClient.current.requestCode();
      return;
    }
    google.id.prompt((n) => {
      if (n.isNotDisplayed?.() || n.isSkippedMoment?.()) {
        setPending(null);
        signInFailed("เปิดหน้าต่าง Google ไม่ได้ ลองใหม่อีกครั้ง หรือรีเฟรชหน้า");
      }
    });
  }

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
          <div className="flex flex-col items-center gap-1 pb-1 text-center">
            <h2 className="text-xl font-semibold tracking-tight text-primary">เข้าสู่ระบบ</h2>
            <p className="text-sm text-balance text-muted">เพื่อเก็บประวัติและรับคำเตือน (ดูท่าและวิธีทำได้โดยไม่ต้องเข้าสู่ระบบ)</p>
          </div>
          <SignInButton
            icon={<GoogleMark />}
            label={pending === "google" ? "กำลังเปิด Google…" : "เข้าสู่ระบบด้วย Google"}
            disabled={!gisReady || !providers || !clientId || pending !== null}
            onClick={startGoogle}
          />
          {providers?.line && (
            <SignInButton
              icon={<LineMark />}
              label={pending === "line" ? "กำลังไปที่ LINE…" : "เข้าสู่ระบบด้วย LINE"}
              disabled={pending !== null}
              onClick={startLine}
            />
          )}
          <p className="text-center text-xs leading-relaxed text-faint">
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

type ButtonProps = { icon: ReactNode; label: string; disabled: boolean; onClick: () => void };

/**
 * Both providers share one outlined button with the primary gradient border, told apart by
 * its mark and label. The marks are our own one-colour drawings, not the
 * providers' official logos: the owner chose the app's look over Google's
 * and LINE's button guidelines (white/dark Google button, LINE green).
 */
function SignInButton({ icon, label, disabled, onClick }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-13 w-full items-center justify-center gap-3 btn-outline-grad rounded-2xl px-6 text-base font-semibold transition-transform duration-150 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 cursor-pointer"
    >
      {icon}
      {label}
    </button>
  );
}

/** A "G" drawn as an open ring with a bar, in the button's text colour. */
function GoogleMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-6 w-6 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
    >
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M12.5 12h7" />
    </svg>
  );
}

/** A speech bubble with "LINE" knocked out, in the button's text colour. */
function LineMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6 shrink-0">
      <path
        fill="currentColor"
        d="M12 2.5c-5.8 0-10.5 3.8-10.5 8.5 0 4.2 3.7 7.7 8.8 8.4.4.1.8.3.9.6.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.6 1.1-.5 6-3.6 8.2-6.1 1.5-1.7 2.3-3.4 2.3-5.4 0-4.7-4.7-8.5-10.5-8.5Z"
      />
      <text
        x="12"
        y="13.4"
        textAnchor="middle"
        fontSize="5.2"
        fontWeight="800"
        fill="var(--surface)"
        fontFamily="system-ui, sans-serif"
      >
        LINE
      </text>
    </svg>
  );
}
