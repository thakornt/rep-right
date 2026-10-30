"use client";

import { Activity, ClipboardPen, Dumbbell, History, House } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "หน้าแรก", Icon: House },
  { href: "/exercises", label: "ท่า", Icon: Dumbbell },
  { href: "/log", label: "บันทึก", Icon: ClipboardPen },
  { href: "/history", label: "ประวัติ", Icon: History },
  { href: "/insights", label: "คำเตือน", Icon: Activity },
];

/** Bottom tab bar: within thumb reach on a phone in the gym. */
export function Nav() {
  const path = usePathname();
  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-20 bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--line)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {links.map(({ href, label, Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[0.72rem] transition-colors ${
                  active ? "text-primary" : "text-muted hover:text-fg"
                }`}
              >
                <Icon aria-hidden size={22} strokeWidth={active ? 2.25 : 1.75} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
