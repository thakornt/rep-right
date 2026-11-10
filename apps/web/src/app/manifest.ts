import type { MetadataRoute } from "next";

// Lets phones install the app to the home screen and open it full screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "rep-right — ฟอร์มถูก ยกปลอดภัย",
    short_name: "rep-right",
    description: "ดูฟอร์มท่าเวทแบบ 3D บันทึกการซ้อมเร็ว และเตือนเมื่อเพิ่มโหลดเร็วเกินไป",
    lang: "th",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d1426",
    theme_color: "#0d1426",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
