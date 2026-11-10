import type { Metadata } from "next";

import { LineCallback } from "./line-callback";

export const metadata: Metadata = {
  title: "กำลังเข้าสู่ระบบด้วย LINE — rep-right",
  robots: { index: false },
};

export default function LineCallbackPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-6 pb-6">
      <LineCallback />
    </main>
  );
}
