"use client";

import { CircleAlert, FileCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { signOut } from "@/lib/auth";
import { useMessages } from "@/lib/i18n/client";
import { acceptTerms, retryTerms, type TermsState } from "@/lib/terms";

import { PageLoader } from "./logo-loader";
import { btnPrimary, btnQuiet } from "./ui";

const link = "text-primary underline-offset-4 hover:underline";

/** Asks a signed-in user to accept the current terms and privacy policy. */
export function TermsGate({ state }: { state: TermsState }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const m = useMessages();
  const t = m.termsGate;

  if (state === "checking") return <PageLoader label={t.loadingAccount} />;
  if (state === "error") {
    return (
      <div className="flex flex-col items-start gap-4 py-6">
        <p className="text-base text-muted">{t.loadFailed}</p>
        <button type="button" className={btnQuiet} onClick={retryTerms}>
          {t.retry}
        </button>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-5 rounded-3xl bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <FileCheck aria-hidden size={20} />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{t.title}</h2>
          <p className="text-sm leading-relaxed text-muted">{t.subtitle}</p>
        </div>
      </div>
      <ul className="flex list-disc flex-col gap-2 pl-5 text-[0.98rem] leading-relaxed marker:text-faint">
        {t.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <p className="text-sm leading-relaxed text-muted">
        {t.readFull}{" "}
        <Link href="/terms" className={link}>
          {m.common.terms}
        </Link>{" "}
        {m.common.and}{" "}
        <Link href="/privacy" className={link}>
          {m.common.privacy}
        </Link>
      </p>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={busy}
          className={btnPrimary}
          onClick={async () => {
            setBusy(true);
            setFailed(false);
            try {
              await acceptTerms();
            } catch {
              setFailed(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t.accept}
        </button>
        <button
          type="button"
          disabled={busy}
          className={btnQuiet}
          onClick={async () => {
            window.google?.accounts.id.disableAutoSelect();
            await signOut();
          }}
        >
          {t.decline}
        </button>
        <p className="text-xs leading-relaxed text-faint">
          {t.deleteHint}{" "}
          <Link href="/account" className={link}>
            {m.common.profile}
          </Link>
        </p>
      </div>
      {failed && (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger">
          <CircleAlert aria-hidden size={18} className="mt-0.5 shrink-0" />
          {t.saveFailed}
        </p>
      )}
    </section>
  );
}
