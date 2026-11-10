import { WifiOff } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ไม่มีอินเทอร์เน็ต — rep-right",
  robots: { index: false },
};

// Shown by the service worker when a page that was never opened before is
// asked for without a connection.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start gap-4 px-4 pt-10 pb-6">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-raised text-primary">
        <WifiOff aria-hidden size={24} />
      </span>
      <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">ตอนนี้ไม่มีอินเทอร์เน็ต</h1>
      <p className="leading-relaxed text-muted">
        หน้านี้ยังไม่เคยเปิดตอนมีเน็ต จึงยังไม่มีเก็บไว้ในเครื่อง หน้าท่าที่เคยเปิดแล้วยังเปิดดูได้
        การบันทึกการซ้อมต้องใช้เน็ต ตัวเลขที่กรอกไว้แล้วยังอยู่ในเครื่อง กดบันทึกอีกครั้งเมื่อเน็ตกลับมา
      </p>
    </main>
  );
}
