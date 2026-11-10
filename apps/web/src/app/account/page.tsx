import type { Metadata } from "next";

import { RequireAuth } from "../require-auth";
import { AccountView } from "./account-view";

export const metadata: Metadata = {
  title: "โปรไฟล์ — rep-right",
  robots: { index: false },
};

export default function AccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-6 pb-6">
      <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">โปรไฟล์</h1>
      <RequireAuth needTerms={false}>
        <AccountView />
      </RequireAuth>
    </main>
  );
}
