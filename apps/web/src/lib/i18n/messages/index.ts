import type { Locale } from "../locale";
import { en } from "./en";
import { th, type Messages } from "./th";

export type { Messages };

export const MESSAGES: Record<Locale, Messages> = { en, th };
