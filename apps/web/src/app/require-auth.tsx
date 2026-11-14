"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth";
import { useTerms } from "@/lib/terms";

import { PageLoader } from "./logo-loader";
import { TermsGate } from "./terms-gate";
import { btnPrimary } from "./ui";

/**
 * Renders children only when signed in and the current terms are accepted;
 * otherwise points to the sign-in on the home page or asks to accept. The
 * account page passes needTerms={false} so someone who declines can still
 * delete their account.
 */
export function RequireAuth({ children, needTerms = true }: { children: ReactNode; needTerms?: boolean }) {
  const auth = useAuth();
  const terms = useTerms();
  if (auth.kind === "checking") {
    return <PageLoader label="กำลังตรวจสอบการเข้าสู่ระบบ…" />;
  }
  if (auth.kind === "signed-out") {
    return (
      <div className="flex flex-col items-start gap-4 py-6">
        <p className="text-base text-muted">หน้านี้ต้องเข้าสู่ระบบก่อน เพื่อเก็บข้อมูลการซ้อมของคุณ</p>
        <Link href="/" className={btnPrimary}>
          <LogIn aria-hidden size={18} /> ไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }
  if (needTerms && terms !== "accepted") return <TermsGate state={terms} />;
  return children;
}
