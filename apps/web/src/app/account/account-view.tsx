"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { HEALTH_CONSENT_VERSION, grantConsent, listConsents, withdrawConsent, type Consent } from "@/lib/api";
import { deleteAccount, useAuth } from "@/lib/auth";
import { HEALTH_CONSENT_TEXT } from "@/lib/consent-text";

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
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">บัญชี</h2>
        <p className="text-base">{auth.user.display_name || auth.user.email}</p>
        <p className="text-sm text-zinc-500">{auth.user.email} · เข้าสู่ระบบด้วย Google</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">ข้อมูลสุขภาพ (อาการเจ็บ)</h2>
        <p className="text-sm text-zinc-500">{HEALTH_CONSENT_TEXT}</p>
        {consents === null ? (
          <p className="text-sm text-zinc-500">กำลังโหลด…</p>
        ) : health ? (
          <>
            <p className="text-base">
              ✓ ให้ความยินยอมแล้วเมื่อ {thDate(health.accepted_at)}
            </p>
            <button
              type="button"
              disabled={busy}
              className={secondaryBtn}
              onClick={() => {
                if (!window.confirm("ถอนความยินยอม? การบันทึกอาการเจ็บทั้งหมดจะถูกลบ")) return;
                void run(async () => {
                  await withdrawConsent("health_data");
                  setConsents(await listConsents());
                }, "ถอนความยินยอมไม่สำเร็จ ลองอีกครั้ง");
              }}
            >
              ถอนความยินยอม (ลบข้อมูลอาการเจ็บ)
            </button>
          </>
        ) : (
          <>
            <p className="text-base">ยังไม่ได้ให้ความยินยอม (บันทึกอาการเจ็บไม่ได้)</p>
            <button
              type="button"
              disabled={busy}
              className={secondaryBtn}
              onClick={() =>
                void run(async () => {
                  await grantConsent("health_data", HEALTH_CONSENT_VERSION);
                  setConsents(await listConsents());
                }, "บันทึกความยินยอมไม่สำเร็จ ลองอีกครั้ง")
              }
            >
              ให้ความยินยอม
            </button>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-red-500/50 p-4">
        <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">ลบบัญชี</h2>
        <p className="text-sm">
          ลบบัญชีและข้อมูลทั้งหมดอย่างถาวร ได้แก่ ประวัติการซ้อม ความยินยอม และการเข้าสู่ระบบทุกอุปกรณ์ กู้คืนไม่ได้
        </p>
        <label className="flex flex-col gap-2 text-sm">
          พิมพ์ “{CONFIRM_WORD}” เพื่อยืนยัน
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="h-12 rounded-lg border border-zinc-300 bg-transparent px-3 text-base dark:border-zinc-700"
          />
        </label>
        <button
          type="button"
          disabled={busy || confirmText.trim() !== CONFIRM_WORD}
          className="flex h-12 items-center justify-center rounded-full bg-red-600 px-6 font-medium text-white disabled:opacity-40"
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
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

const secondaryBtn =
  "flex h-12 items-center justify-center rounded-full border border-zinc-300 px-5 font-medium disabled:opacity-50 dark:border-zinc-700";
