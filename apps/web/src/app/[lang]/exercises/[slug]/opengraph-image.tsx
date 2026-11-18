import { EXERCISE_NAMES, HAS_3D } from "@/content/exercise-names";
import { FORM_CUES } from "@/content/form-cues";
import { LOCALES } from "@/lib/i18n/locale";
import { OG_SIZE, ogCard } from "@/lib/og-card";

// Each exercise page's shared-link picture: its name, big, in the page's language.
export const alt = "rep-right";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return LOCALES.flatMap((lang) => Object.keys(FORM_CUES).map((slug) => ({ lang, slug })));
}

export default async function Image({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const name = EXERCISE_NAMES[slug] ?? { th: slug, en: slug };
  const has3D = HAS_3D.has(slug);
  if (lang === "en") {
    return ogCard({ title: name.en, subtitle: has3D ? "Good form, in 3D from every side" : "Good form, step by step" });
  }
  return ogCard({
    title: `ท่า${name.th}`,
    subtitle: `${name.en} · ${has3D ? "ฟอร์มที่ถูกต้อง ดู 3D รอบตัว" : "ฟอร์มที่ถูกต้อง ทีละขั้น"}`,
  });
}
