"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth";
import { useMessages } from "@/lib/i18n/client";
import { useTerms } from "@/lib/terms";

import { PageLoader } from "./logo-loader";
import { TermsGate } from "./terms-gate";
import { btnPrimary } from "./ui";

/**
 * Renders children only when signed in and the current terms are accepted;
 * otherwise points to the sign-in on the home page or asks to accept. The
 * settings page passes needTerms={false} so someone who declines can still
 * delete their account.
 */
export function RequireAuth({
  children,
  needTerms = true,
  signInNote,
}: {
  children: ReactNode;
  needTerms?: boolean;
  /** Replaces the default "sign in first" line, for pages that work partly signed out. */
  signInNote?: string;
}) {
  const auth = useAuth();
  const terms = useTerms();
  const t = useMessages();
  if (auth.kind === "checking") {
    return <PageLoader label={auth.reconnecting ? t.common.reconnecting : t.common.checkingSignIn} />;
  }
  if (auth.kind === "signed-out") {
    return (
      <div className="flex flex-col items-start gap-4 py-6">
        <p className="text-base text-muted">{signInNote ?? t.requireAuth.needSignIn}</p>
        <Link href="/" className={btnPrimary}>
          <LogIn aria-hidden size={18} /> {t.requireAuth.goSignIn}
        </Link>
      </div>
    );
  }
  if (needTerms && terms !== "accepted") return <TermsGate state={terms} />;
  return children;
}
