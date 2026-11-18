"use client";

import { Check, CircleAlert, LogOut, Pencil, ShieldCheck, ShieldOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import {
  HEALTH_CONSENT_VERSION,
  MAX_DISPLAY_NAME,
  grantConsent,
  listConsents,
  withdrawConsent,
  type Consent,
  type Provider,
  type User,
} from "@/lib/api";
import { deleteAccount, rename, signOut, useAuth } from "@/lib/auth";
import { healthConsentText } from "@/lib/consent-text";
import { useLocale } from "@/lib/i18n/client";
import { DATE_LOCALE, type Locale } from "@/lib/i18n/locale";
import { MESSAGES, type Messages } from "@/lib/i18n/messages";
import { TERMS_VERSION } from "@/lib/legal";

import { Avatar } from "../avatar";
import { LogoLoader } from "../logo-loader";
import { GoogleG, LineIcon } from "../provider-icons";
import { btnPrimary, btnQuiet, btnText, iconBtn } from "../ui";

const fullDate = (iso: string, locale: Locale) =>
  new Date(iso).toLocaleDateString(DATE_LOCALE[locale], { day: "numeric", month: "short", year: "numeric" });

// Errors are kept as keys, so they show in whatever language the page is in.
type AccountError = keyof Messages["account"]["errors"];

/** `afterProfile` sits right under the picture, name and email. */
export function AccountView({ afterProfile }: { afterProfile?: ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const [consents, setConsents] = useState<Consent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccountError | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const locale = useLocale();
  const t = MESSAGES[locale].account;
  const m = MESSAGES[locale];
  const date = (iso: string) => fullDate(iso, locale);
  const confirmWord = t.confirmWord;

  useEffect(() => {
    listConsents()
      .then(setConsents)
      .catch(() => setError("loadConsents"));
  }, []);

  if (auth.kind !== "signed-in") return null;
  const health = consents?.filter((c) => c.kind === "health_data").at(-1);
  const terms = consents?.find((c) => c.kind === "terms" && c.version === TERMS_VERSION);

  async function run(action: () => Promise<void>, failMessage: AccountError) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError(failMessage);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <ProfileCard user={auth.user} t={t} />
      {afterProfile}

      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-medium tracking-wide text-faint">{t.signedInWith}</h2>
        <ul className="flex flex-col gap-2">
          {auth.user.providers.map((p) => (
            <li key={p} className="flex items-center gap-3 rounded-3xl bg-surface px-5 py-4">
              <ProviderMark provider={p} />
              <span className="flex-1 font-medium">{PROVIDER_NAME[p]}</span>
              <span className="flex items-center gap-1 text-sm text-health">
                <Check aria-hidden size={16} /> {t.connected}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed text-muted">
          {t.providerNote}
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-medium tracking-wide text-faint">{t.legal}</h2>
        <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
          {consents !== null && (
            <p className={`flex items-center gap-2 font-medium ${terms ? "text-health" : "text-muted"}`}>
              {terms ? <ShieldCheck aria-hidden size={20} /> : <ShieldOff aria-hidden size={20} />}
              {terms ? t.termsAccepted(date(terms.accepted_at)) : t.termsNotAccepted}
            </p>
          )}
          <div className="flex flex-wrap gap-x-5">
            <Link href="/terms" className={btnText}>
              {m.common.terms}
            </Link>
            <Link href="/privacy" className={btnText}>
              {m.common.privacy}
            </Link>
          </div>
          <p className="text-sm leading-relaxed text-muted">{t.legalNote}</p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-medium tracking-wide text-faint">{t.health}</h2>
        <div className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
          {consents === null ? (
            <LogoLoader size="sm" label={t.loadingConsent} className="py-3" />
          ) : (
            <p className={`flex items-center gap-2 font-medium ${health ? "text-health" : "text-muted"}`}>
              {health ? <ShieldCheck aria-hidden size={20} /> : <ShieldOff aria-hidden size={20} />}
              {health ? t.consentGiven(date(health.accepted_at)) : t.consentNotGiven}
            </p>
          )}
          <p className="text-sm leading-relaxed text-muted">{healthConsentText(locale)}</p>
          {consents !== null &&
            (health ? (
              <button
                type="button"
                disabled={busy}
                className={btnQuiet}
                onClick={() => {
                  if (!window.confirm(t.confirmWithdraw)) return;
                  void run(async () => {
                    await withdrawConsent("health_data");
                    setConsents(await listConsents());
                  }, "withdraw");
                }}
              >
                {t.withdraw}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                className={btnQuiet}
                onClick={() =>
                  void run(async () => {
                    await grantConsent("health_data", HEALTH_CONSENT_VERSION);
                    setConsents(await listConsents());
                  }, "give")
                }
              >
                {t.give}
              </button>
            ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-medium tracking-wide text-faint">{t.deleteTitle}</h2>
        <p className="text-sm leading-relaxed text-muted">
          {t.deleteBody} <span className="font-medium text-danger">{t.cannotUndo}</span>
        </p>
        <label className="flex flex-col gap-2 text-sm text-muted">
          {t.typeToConfirm(confirmWord)}
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="field" />
        </label>
        <button
          type="button"
          disabled={busy || confirmText.trim().toLowerCase() !== confirmWord}
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-danger-solid px-6 font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
          onClick={() =>
            void run(async () => {
              await deleteAccount();
              router.replace("/?deleted=1");
            }, "delete")
          }
        >
          {t.deleteForever}
        </button>
      </section>

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger">
          <CircleAlert aria-hidden size={18} className="mt-0.5 shrink-0" />
          {t.errors[error]}
        </p>
      )}
    </div>
  );
}

const PROVIDER_NAME: Record<Provider, string> = { google: "Google", line: "LINE" };

function ProviderMark({ provider }: { provider: Provider }) {
  return provider === "google" ? (
    <span className="grid h-9 w-9 place-items-center rounded-full bg-white">
      <GoogleG />
    </span>
  ) : (
    <span className="grid h-9 w-9 place-items-center rounded-full bg-[#06C755]">
      <LineIcon />
    </span>
  );
}

/** Picture, name (editable) and email. */
function ProfileCard({ user, t }: { user: User; t: Messages["account"] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const name = user.display_name || user.email || t.defaultName;
  const m = MESSAGES[useLocale()];
  const trimmed = draft.trim();

  async function save() {
    setSaving(true);
    setFailed(false);
    try {
      await rename(trimmed);
      setEditing(false);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col items-center gap-4 rounded-3xl bg-surface px-5 pt-7 pb-6 text-center">
      <Avatar user={user} size="lg" />
      {editing ? (
        <form
          className="flex w-full flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed) void save();
          }}
        >
          <label className="flex flex-col gap-2 text-left text-sm text-muted">
            {t.displayName}
            <input
              autoFocus
              value={draft}
              maxLength={MAX_DISPLAY_NAME}
              onChange={(e) => setDraft(e.target.value)}
              className="field"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className={btnQuiet} onClick={() => setEditing(false)} disabled={saving}>
              {m.common.cancel}
            </button>
            <button type="submit" className={btnPrimary} disabled={saving || !trimmed}>
              {saving ? m.common.saving : m.common.save}
            </button>
          </div>
          {failed && (
            <p role="alert" className="text-sm text-danger">
              {t.errors.rename}
            </p>
          )}
        </form>
      ) : (
        <div className="flex min-w-0 max-w-full flex-col items-center gap-1">
          <div className="flex max-w-full items-center gap-1">
            <p className="truncate text-xl font-semibold">{name}</p>
            <button
              type="button"
              aria-label={t.editName}
              className={iconBtn}
              onClick={() => {
                setDraft(user.display_name);
                setEditing(true);
              }}
            >
              <Pencil aria-hidden size={18} />
            </button>
          </div>
          <p className="max-w-full truncate text-sm text-muted">{user.email || t.noEmail}</p>
        </div>
      )}
      {!editing && (
        <button
          type="button"
          className={`${btnQuiet} mt-1 w-full`}
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true);
            window.google?.accounts.id.disableAutoSelect();
            try {
              await signOut();
            } finally {
              setSigningOut(false);
            }
          }}
        >
          <LogOut aria-hidden size={18} /> {m.auth.signOut}
        </button>
      )}
    </section>
  );
}
