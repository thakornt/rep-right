"use client";

import { CircleAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { HEALTH_CONSENT_VERSION, grantConsent, listConsents, withdrawConsent, type Consent } from "@/lib/api";
import { deleteAccount, useAuth } from "@/lib/auth";
import { HEALTH_CONSENT_TEXT } from "@/lib/consent-text";

import { btnQuiet } from "../ui";

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
  const name = auth.user.display_name || auth.user.email;

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
      <section className="flex items-center gap-4">
        <span aria-hidden className="grid h-14 w-14 place-items-center rounded-full bg-raised text-xl font-semibold text-primary">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{name}</p>
          <p className="truncate text-sm text-muted">{auth.user.email} · Google</p>
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
