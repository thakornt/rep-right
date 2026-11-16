"use client";

import { useAuth } from "@/lib/auth";

import { RequireAuth } from "../require-auth";
import { AccountView } from "./account-view";
import { LanguageSetting } from "./language-setting";
import { MyProgramSection } from "./my-program-section";

/**
 * The profile page in order: picture, name and email; the program; the language; then the
 * account sections. The program and language work signed out too (kept in this browser),
 * so then they come first, above the sign-in prompt.
 */
export function AccountSections() {
  const auth = useAuth();
  const mine = (
    <div className="flex flex-col gap-6">
      <MyProgramSection />
      <LanguageSetting />
    </div>
  );
  return (
    <>
      {auth.kind === "signed-out" && mine}
      <RequireAuth needTerms={false}>
        <AccountView afterProfile={mine} />
      </RequireAuth>
    </>
  );
}
