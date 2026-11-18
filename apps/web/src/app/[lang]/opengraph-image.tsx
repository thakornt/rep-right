import { LOCALES, isLocale } from "@/lib/i18n/locale";
import { OG_SIZE, ogCard } from "@/lib/og-card";

// The site's shared-link picture; exercise pages have their own (exercises/[slug]).
export const alt = "rep-right";
export const size = OG_SIZE;
export const contentType = "image/png";

const CARD = {
  th: {
    title: "ฟอร์มถูก ยกปลอดภัย",
    subtitle: "ดูท่าเวทแบบ 3D หมุนได้รอบตัว บันทึกการซ้อมเร็ว สำหรับมือใหม่ที่ไม่มีเทรนเนอร์",
  },
  en: {
    title: "Good form, safe lifting",
    subtitle: "See lifts in 3D from every side and log workouts fast. For people who lift without a coach.",
  },
};

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return ogCard(CARD[isLocale(lang) ? lang : "th"]);
}
