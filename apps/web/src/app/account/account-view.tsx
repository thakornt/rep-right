"use client";

import { Check, CircleAlert, Pencil, ShieldCheck, ShieldOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
import { deleteAccount, rename, useAuth } from "@/lib/auth";
import { HEALTH_CONSENT_TEXT } from "@/lib/consent-text";
import { TERMS_VERSION } from "@/lib/legal";

import { Avatar } from "../avatar";
import { GoogleG, LineIcon } from "../provider-icons";
import { btnPrimary, btnQuiet, btnText, iconBtn } from "../ui";

const CONFIRM_WORD = "ลบบัญชี";

const thDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

export function AccountView() {
  const auth = useAuth();
  const router = useRouter();
  const [consents, setConsents] = useState<Consent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    listConsents()
      .then(setConsents)
      .catch(() => setError("โหลดข้อมูลความยินยอมไม่สำเร็จ ลองรีเฟรชหน้า"));
  }, []);

  if (auth.kind !== "signed-in") return null;
  const health = consents?.filter((c) => c.kind === "health_data").at(-1);
  const terms = consents?.find((c) => c.kind === "terms" && c.version === TERMS_VERSION);

  async function run(action: () => Promise<void>, failMessage: string) {
    setBusy(true);
    setError("");
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
      <ProfileCard user={auth.user} />

      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-medium tracking-wide text-faint">บัญชีที่ใช้เข้าสู่ระบบ</h2>
        <ul className="flex flex-col gap-2">
          {auth.user.providers.map((p) => (
            <li key={p} className="flex items-center gap-3 rounded-3xl bg-surface px-5 py-4">
              <ProviderMark provider={p} />
              <span className="flex-1 font-medium">{PROVIDER_NAME[p]}</span>
              <span className="flex items-center gap-1 text-sm text-health">
                <Check aria-hidden size={16} /> เชื่อมแล้ว
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed text-muted">
          ชื่อ อีเมล และรูปโปรไฟล์ได้มาจากบัญชีนี้ตอนเข้าสู่ระบบ รูปจะอัปเดตเองทุกครั้งที่เข้าสู่ระบบ
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-medium tracking-wide text-faint">ข้อตกลงและนโยบาย</h2>
        <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
          {consents !== null && (
            <p className={`flex items-center gap-2 font-medium ${terms ? "text-health" : "text-muted"}`}>
              {terms ? <ShieldCheck aria-hidden size={20} /> : <ShieldOff aria-hidden size={20} />}
              {terms ? `ยอมรับฉบับปัจจุบันแล้ว · ${thDate(terms.accepted_at)}` : "ยังไม่ได้ยอมรับฉบับปัจจุบัน"}
            </p>
          )}
          <div className="flex flex-wrap gap-x-5">
            <Link href="/terms" className={btnText}>
              ข้อตกลงการใช้งาน
            </Link>
            <Link href="/privacy" className={btnText}>
              นโยบายความเป็นส่วนตัว
            </Link>
          </div>
          <p className="text-sm leading-relaxed text-muted">ถ้าไม่ต้องการให้เก็บข้อมูลต่อ ลบบัญชีได้ด้านล่าง</p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-medium tracking-wide text-faint">ข้อมูลสุขภาพ (อาการเจ็บ)</h2>
        <div className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
          {consents === null ? (
            <p className="text-sm text-muted">กำลังโหลด…</p>
          ) : (
            <p className={`flex items-center gap-2 font-medium ${health ? "text-health" : "text-muted"}`}>
              {health ? <ShieldCheck aria-hidden size={20} /> : <ShieldOff aria-hidden size={20} />}
              {health ? `ให้ความยินยอมแล้ว · ${thDate(health.accepted_at)}` : "ยังไม่ได้ให้ความยินยอม"}
            </p>
          )}
          <p className="text-sm leading-relaxed text-muted">{HEALTH_CONSENT_TEXT}</p>
          {consents !== null &&
            (health ? (
              <button
                type="button"
                disabled={busy}
                className={btnQuiet}
                onClick={() => {
                  if (!window.confirm("ถอนความยินยอม? การบันทึกอาการเจ็บทั้งหมดจะถูกลบ")) return;
                  void run(async () => {
                    await withdrawConsent("health_data");
                    setConsents(await listConsents());
                  }, "ถอนความยินยอมไม่สำเร็จ ลองอีกครั้ง");
                }}
              >
                ถอนความยินยอมและลบข้อมูลอาการเจ็บ
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
                  }, "บันทึกความยินยอมไม่สำเร็จ ลองอีกครั้ง")
                }
              >
                ให้ความยินยอม
              </button>
            ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-medium tracking-wide text-faint">ลบบัญชี</h2>
        <p className="text-sm leading-relaxed text-muted">
          ลบบัญชีและข้อมูลทั้งหมดอย่างถาวร ได้แก่ ประวัติการซ้อม ความยินยอม และการเข้าสู่ระบบทุกอุปกรณ์{" "}
          <span className="font-medium text-danger">กู้คืนไม่ได้</span>
        </p>
        <label className="flex flex-col gap-2 text-sm text-muted">
          พิมพ์ “{CONFIRM_WORD}” เพื่อยืนยัน
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="field" />
        </label>
        <button
          type="button"
          disabled={busy || confirmText.trim() !== CONFIRM_WORD}
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-danger-solid px-6 font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
          onClick={() =>
            void run(async () => {
              await deleteAccount();
              router.replace("/?deleted=1");
            }, "ลบบัญชีไม่สำเร็จ ลองอีกครั้ง")
          }
        >
          ลบบัญชีถาวร
        </button>
      </section>

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger">
          <CircleAlert aria-hidden size={18} className="mt-0.5 shrink-0" />
          {error}
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
function ProfileCard({ user }: { user: User }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const name = user.display_name || user.email || "ผู้ใช้ rep-right";
  const trimmed = draft.trim();

  async function save() {
    setSaving(true);
    setError("");
    try {
      await rename(trimmed);
      setEditing(false);
    } catch {
      setError("บันทึกชื่อไม่สำเร็จ ลองอีกครั้ง");
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
            ชื่อที่แสดงในแอป
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
              ยกเลิก
            </button>
            <button type="submit" className={btnPrimary} disabled={saving || !trimmed}>
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </form>
      ) : (
        <div className="flex min-w-0 max-w-full flex-col items-center gap-1">
          <div className="flex max-w-full items-center gap-1">
            <p className="truncate text-xl font-semibold">{name}</p>
            <button
              type="button"
              aria-label="แก้ชื่อที่แสดง"
              className={iconBtn}
              onClick={() => {
                setDraft(user.display_name);
                setEditing(true);
              }}
            >
              <Pencil aria-hidden size={18} />
            </button>
          </div>
          <p className="max-w-full truncate text-sm text-muted">{user.email || "บัญชีนี้ไม่ได้แชร์อีเมล"}</p>
        </div>
      )}
    </section>
  );
}
