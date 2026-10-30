"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "หน้าแรก" },
  { href: "/log", label: "บันทึก" },
  { href: "/history", label: "ประวัติ" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="border-b border-zinc-200 dark:border-zinc-800">
      <ul className="mx-auto flex max-w-xl gap-1 px-2">
        {links.map((l) => {
          const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-12 items-center px-3 text-base ${active ? "font-semibold" : "text-zinc-500"}`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
