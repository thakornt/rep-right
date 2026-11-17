"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The header gear. It sits up here, not in the bottom bar, because language works signed
 * out too; it hides on the settings page itself, where it would lead nowhere.
 */
export function SettingsLink({ label }: { label: string }) {
  if (usePathname() === "/settings") return null;
  return (
    <Link
      href="/settings"
      aria-label={label}
      title={label}
      className="-mr-2 ml-auto flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-raised hover:text-fg"
    >
      <Settings aria-hidden size={22} />
    </Link>
  );
}
