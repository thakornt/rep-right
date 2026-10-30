import type { Metadata } from "next";

import { RequireAuth } from "../require-auth";
import { AccountView } from "./account-view";

export const metadata: Metadata = {
  title: "บัญชีและความเป็นส่วนตัว — rep-right",
  robots: { index: false },
};

export default function AccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">บัญชีและความเป็นส่วนตัว</h1>
      <RequireAuth>
        <AccountView />
      </RequireAuth>
    </main>
  );
}
