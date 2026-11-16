import { WifiOff } from "lucide-react";
import type { Metadata } from "next";

import { getMessages } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).meta.offline, robots: { index: false } };
}

// Shown by the service worker when a page that was never opened before is
// asked for without a connection.
export default async function OfflinePage() {
  const t = (await getMessages()).offline;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start gap-4 px-4 pt-10 pb-6">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-raised text-primary">
        <WifiOff aria-hidden size={24} />
      </span>
      <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">{t.title}</h1>
      <p className="leading-relaxed text-muted">{t.body}</p>
    </main>
  );
}
