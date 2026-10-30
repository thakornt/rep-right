"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth";

import { btnPrimary } from "./ui";

/** Renders children only when signed in; otherwise points to the sign-in on the home page. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.kind === "checking") {
    return <p className="text-sm text-faint">กำลังตรวจสอบการเข้าสู่ระบบ…</p>;
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
  return children;
}
