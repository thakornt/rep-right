import type { Metadata, Viewport } from "next";
import { Manrope, Noto_Sans_Thai } from "next/font/google";
import Link from "next/link";

import "./globals.css";
import { Nav } from "./nav";
import { ServiceWorker } from "./service-worker";

// Manrope for Latin and numbers, Noto Sans Thai for Thai (the navy + orange preset).
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
const notoSansThai = Noto_Sans_Thai({ variable: "--font-noto-sans-thai", subsets: ["thai"] });

export const metadata: Metadata = {
  title: "rep-right — ฟอร์มถูก ยกปลอดภัย",
  description:
    "ดูฟอร์มท่าเวทแบบ 3D บันทึกการซ้อมเร็ว และเตือนเมื่อเพิ่มโหลดเร็วเกินไป สำหรับคนเล่นเวทที่ไม่มีเทรนเนอร์",
  appleWebApp: { capable: true, title: "rep-right", statusBarStyle: "black-translucent" },
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
              {/* The Rep Right figure from app/icon.svg, cropped tighter to fit the small tile. */}
              <svg viewBox="-330 -40 1260 1460" className="h-[1.3rem] w-[1.3rem]" fill="currentColor">
                <circle cx="360" cy="150" r="110" />
                <path
                  d="M140 360 L580 360 L480 700 L240 700 L440 870 L205 1380 L225 960 L20 800 Z"
                  stroke="currentColor"
                  strokeWidth="28"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            rep-right
          </Link>
        </header>
        {children}
        <Nav />
        <ServiceWorker />
      </body>
    </html>
  );
}
