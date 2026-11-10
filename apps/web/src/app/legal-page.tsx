import type { ReactNode } from "react";

import { CONTACT_EMAIL, CONTROLLER, LEGAL_UPDATED } from "@/lib/legal";

/** Shared layout for the terms and privacy pages. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 pt-6 pb-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-faint">ปรับปรุงล่าสุด {LEGAL_UPDATED}</p>
      </header>
      <div className="flex flex-col gap-8 text-[0.98rem] leading-relaxed text-fg/90">{children}</div>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-faint">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

export function Contact() {
  return CONTACT_EMAIL ? (
    <p>
      {CONTROLLER} ติดต่อได้ที่{" "}
      <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline-offset-4 hover:underline">
        {CONTACT_EMAIL}
      </a>
    </p>
  ) : (
    <p>{CONTROLLER}</p>
  );
}
