import type { Metadata } from "next";

import { RequireAuth } from "../require-auth";
import { LogForm } from "./log-form";

export const metadata: Metadata = {
  title: "บันทึกการซ้อม — rep-right",
  robots: { index: false },
};

export default function LogPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">บันทึกการซ้อม</h1>
      <RequireAuth>
        <LogForm />
      </RequireAuth>
    </main>
  );
}
