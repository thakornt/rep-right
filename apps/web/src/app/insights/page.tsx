import type { Metadata } from "next";

import { RequireAuth } from "../require-auth";
import { InsightsView } from "./insights-view";

export const metadata: Metadata = {
  title: "คำเตือนและแผน — rep-right",
  robots: { index: false },
};

export default function InsightsPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">คำเตือนและแผน</h1>
      <RequireAuth>
        <InsightsView />
      </RequireAuth>
    </main>
  );
}
