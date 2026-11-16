// Wording shown when asking for health-data consent. Changing its meaning
// needs a new HEALTH_CONSENT_VERSION (lib/api.ts) so users are asked again.
import type { Locale } from "./i18n/locale";

export const HEALTH_CONSENT_TEXT =
  "การบันทึกว่ามีอาการเจ็บถือเป็นข้อมูลสุขภาพ เราจะเก็บไว้เพียงว่า “มี/ไม่มี” ต่อการซ้อมหนึ่งครั้ง " +
  "เพื่อใช้หยุดแนะนำการเพิ่มน้ำหนัก และคุณถอนความยินยอมได้ทุกเมื่อ (ข้อมูลอาการเจ็บจะถูกลบ)";

const HEALTH_CONSENT_TEXT_EN =
  "Noting that something hurt counts as health information. We keep only a “yes/no” for each workout, " +
  "used to stop suggesting heavier weights, and you can withdraw your consent at any time (your pain notes are then deleted).";

export const healthConsentText = (locale: Locale) => (locale === "en" ? HEALTH_CONSENT_TEXT_EN : HEALTH_CONSENT_TEXT);
