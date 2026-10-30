import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { Nav } from "./nav";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: "rep-right — ฟอร์มถูก ยกปลอดภัย",
  description:
    "ดูฟอร์มท่าเวทแบบ 3D บันทึกการซ้อมเร็ว และเตือนเมื่อเพิ่มโหลดเร็วเกินไป สำหรับคนเล่นเวทที่ไม่มีเทรนเนอร์",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${notoSansThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Nav />
        {children}
      </body>
    </html>
  );
}
