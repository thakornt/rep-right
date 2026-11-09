import type { Metadata, Viewport } from "next";
import { Dumbbell } from "lucide-react";
import { Manrope, Noto_Sans_Thai } from "next/font/google";
import Link from "next/link";

import "./globals.css";
import { Nav } from "./nav";

// Manrope for Latin and numbers, Noto Sans Thai for Thai (the navy + orange preset).
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
const notoSansThai = Noto_Sans_Thai({ variable: "--font-noto-sans-thai", subsets: ["thai"] });

export const metadata: Metadata = {
  title: "rep-right — ฟอร์มถูก ยกปลอดภัย",
  description:
    "ดูฟอร์มท่าเวทแบบ 3D บันทึกการซ้อมเร็ว และเตือนเมื่อเพิ่มโหลดเร็วเกินไป สำหรับคนเล่นเวทที่ไม่มีเทรนเนอร์",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d1426",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${manrope.variable} ${notoSansThai.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
        <header className="mx-auto flex w-full max-w-xl items-center px-4 pt-4">
          <Link href="/" className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-[0.6rem] bg-raised text-primary shadow-[inset_0_0_0_1px_#34446f]"
            >
              <Dumbbell size={18} strokeWidth={2.25} />
            </span>
            rep-right
          </Link>
        </header>
        {children}
        <Nav />
      </body>
    </html>
  );
}
