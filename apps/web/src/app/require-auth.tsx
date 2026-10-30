"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth";

/** Renders children only when signed in; otherwise points to the sign-in on the home page. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.kind === "checking") {
    return <p className="text-sm text-zinc-500">กำลังตรวจสอบการเข้าสู่ระบบ…</p>;
  }
  if (auth.kind === "signed-out") {
    return (
      <p className="text-base">
        กรุณา{" "}
        <Link href="/" className="font-medium underline">
          เข้าสู่ระบบ
        </Link>{" "}
        ก่อน
      </p>
    );
  }
  return children;
}
