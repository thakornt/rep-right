"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { signInFailed, signInLine } from "@/lib/auth";

import { PageLoader } from "../../../logo-loader";

/**
 * LINE sends the browser here with ?code&state (or ?error when the user
 * cancels). The API checks state against the cookie it set when the login
 * started, swaps the code for a verified ID token and starts our session.
 */
export function LineCallback() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // the code works once; StrictMode runs effects twice
    ran.current = true;
    const q = new URLSearchParams(window.location.search);
    const code = q.get("code");
    const state = q.get("state");
    // Drop the one-time code from the address bar and history.
    window.history.replaceState(null, "", window.location.pathname);
    void (async () => {
      if (code && state) await signInLine(code, state);
      else signInFailed("ยกเลิกการเข้าสู่ระบบด้วย LINE แล้ว");
      router.replace("/");
    })();
  }, [router]);

  return <PageLoader label="กำลังเข้าสู่ระบบด้วย LINE…" />;
}
