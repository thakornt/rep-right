import type { Metadata } from "next";

import { RequireAuth } from "../require-auth";
import { HistoryList } from "./history-list";

export const metadata: Metadata = {
  title: "ประวัติการซ้อม — rep-right",
  robots: { index: false },
};

export default function HistoryPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-6 pb-6">
      <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">ประวัติการซ้อม</h1>
      <RequireAuth>
        <HistoryList />
      </RequireAuth>
    </main>
  );
}
