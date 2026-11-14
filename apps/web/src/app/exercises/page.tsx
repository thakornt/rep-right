import type { Metadata } from "next";
import { Suspense } from "react";

import { Badge3D } from "../badge-3d";
import { ExercisesLoading, LibraryView } from "./library-view";

export const metadata: Metadata = {
  title: "ท่าออกกำลังกายและฟอร์มที่ถูกต้อง — rep-right",
  description: "ค้นหาท่าเวทเทรนนิ่งตามกล้ามเนื้อที่อยากพัฒนา พร้อมจุดสำคัญของฟอร์มและข้อผิดพลาดที่พบบ่อย",
};

export default function ExercisesPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pt-6 pb-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[2.1rem] leading-tight font-semibold tracking-tight">ท่าออกกำลังกาย</h1>
        <p className="text-[0.95rem] leading-8 text-muted">
          เลือกกล้ามเนื้อที่อยากพัฒนา แล้วเปิดดูจุดสำคัญของฟอร์ม ท่าที่มีป้าย{" "}
          <Badge3D className="align-middle" />{" "}
          <span className="whitespace-nowrap">หมุนดูได้รอบตัว</span>
        </p>
      </header>
      {/* useSearchParams needs a Suspense boundary so the rest of the page can prerender. */}
      <Suspense fallback={<ExercisesLoading />}>
        <LibraryView />
      </Suspense>
    </main>
  );
}
