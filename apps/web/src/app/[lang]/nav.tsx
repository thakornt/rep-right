"use client";

import { Activity, ClipboardPen, Dumbbell, History, House } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

import { useMessages } from "@/lib/i18n/client";
import { useReportNavigating } from "@/lib/navigating";

const links = [
  { href: "/", key: "home", Icon: House },
  { href: "/exercises", key: "exercises", Icon: Dumbbell },
  { href: "/log", key: "log", Icon: ClipboardPen },
  { href: "/history", key: "history", Icon: History },
  { href: "/insights", key: "insights", Icon: Activity },
] as const;

/** Bottom tab bar: within thumb reach on a phone in the gym. */
export function Nav() {
  const path = usePathname();
  const t = useMessages().nav;
  return (
    <nav
      aria-label={t.label}
      className="fixed inset-x-0 bottom-0 z-20 bg-bg/60 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--line)] backdrop-blur-xl backdrop-saturate-150"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {links.map(({ href, key, Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[0.72rem] transition-colors ${
                  active ? "font-semibold text-fg" : "text-faint hover:text-fg"
                }`}
              >
                {active && (
                  <span aria-hidden className="absolute inset-x-[30%] top-0 h-0.5 rounded-full bg-primary" />
                )}
                <TabPending />
                <Icon aria-hidden size={22} strokeWidth={active ? 2.25 : 1.75} className={active ? "text-primary" : ""} />
                {t[key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** While this tab's page is loading: a pulsing bar on the tab, and the full-screen splash. */
function TabPending() {
  const { pending } = useLinkStatus();
  useReportNavigating(pending);
  if (!pending) return null;
  return <span aria-hidden className="absolute inset-x-[30%] top-0 h-0.5 animate-pulse rounded-full bg-primary" />;
}
