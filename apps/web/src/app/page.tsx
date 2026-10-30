import { ApiStatus } from "./api-status";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">rep-right</h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          ดูฟอร์มท่าเวทแบบ 3D บันทึกการซ้อมเร็ว และเตือนเมื่อเพิ่มโหลดเร็วเกินไป
        </p>
        <p className="text-sm text-zinc-500">กำลังพัฒนา เร็วๆ นี้</p>
      </header>
      <ApiStatus />
    </main>
  );
}
