"use client";

import { useAuth } from "@/lib/auth";
import { useMessages } from "@/lib/i18n/client";

import { RequireAuth } from "../require-auth";
import { AccountView } from "./account-view";
import { LanguageSetting } from "./language-setting";
import { MyProgramSection } from "./my-program-section";

/**
 * The settings page in order: picture, name and email; the program; the language; then the
 * account sections. The program and language work signed out too (kept in this browser),
 * so then they come first, above the sign-in prompt.
 */
export function AccountSections() {
  const auth = useAuth();
  const t = useMessages();
  const mine = (
    <div className="flex flex-col gap-6">
      <MyProgramSection />
      <LanguageSetting />
    </div>
  );
  return (
    <>
      {auth.kind !== "signed-in" && mine}
      <RequireAuth needTerms={false} signInNote={t.account.signInNote}>
        <AccountView afterProfile={mine} />
      </RequireAuth>
    </>
  );
}
