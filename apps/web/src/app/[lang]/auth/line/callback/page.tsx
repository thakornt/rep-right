import type { Metadata } from "next";

import { getMessages } from "@/lib/i18n/server";

import { LineCallback } from "./line-callback";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).meta.lineCallback, robots: { index: false } };
}

export default function LineCallbackPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-6 pb-6">
      <LineCallback />
    </main>
  );
}
