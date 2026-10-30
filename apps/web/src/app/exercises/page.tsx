import type { Metadata } from "next";
import { Suspense } from "react";

import { LibraryView } from "./library-view";

export const metadata: Metadata = {
  title: "ท่าออกกำลังกายและฟอร์มที่ถูกต้อง — rep-right",
  description: "ค้นหาท่าเวทเทรนนิ่งตามกล้ามเนื้อที่อยากพัฒนา พร้อมจุดสำคัญของฟอร์มและข้อผิดพลาดที่พบบ่อย",
};

export default function ExercisesPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">ท่าออกกำลังกาย</h1>
      {/* useSearchParams needs a Suspense boundary so the rest of the page can prerender. */}
      <Suspense fallback={<p className="text-sm text-zinc-500">กำลังโหลด…</p>}>
        <LibraryView />
      </Suspense>
    </main>
  );
}
