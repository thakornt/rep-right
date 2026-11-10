"use client";

import { CircleAlert, FileCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { signOut } from "@/lib/auth";
import { acceptTerms, retryTerms, type TermsState } from "@/lib/terms";

import { btnPrimary, btnQuiet } from "./ui";

const link = "text-primary underline-offset-4 hover:underline";

/** Asks a signed-in user to accept the current terms and privacy policy. */
export function TermsGate({ state }: { state: TermsState }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (state === "checking") return <p className="text-sm text-faint">กำลังโหลด…</p>;
  if (state === "error") {
    return (
      <div className="flex flex-col items-start gap-4 py-6">
        <p className="text-base text-muted">โหลดข้อมูลบัญชีไม่สำเร็จ</p>
        <button type="button" className={btnQuiet} onClick={retryTerms}>
          ลองอีกครั้ง
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
          <h2 className="text-lg font-semibold">ก่อนเริ่มใช้งาน</h2>
          <p className="text-sm leading-relaxed text-muted">อ่านและยอมรับข้อตกลงก่อนบันทึกการซ้อม</p>
        </div>
      </div>
      <ul className="flex list-disc flex-col gap-2 pl-5 text-[0.98rem] leading-relaxed marker:text-faint">
        <li>คำแนะนำในแอปเป็นแนวทางทั่วไป ไม่ใช่คำวินิจฉัยหรือคำแนะนำทางการแพทย์</li>
        <li>ถ้ารู้สึกเจ็บระหว่างซ้อม ให้หยุดและปรึกษาผู้เชี่ยวชาญ</li>
        <li>เราเก็บอีเมล ชื่อ และประวัติการซ้อมไว้บนเซิร์ฟเวอร์ในสิงคโปร์ จนกว่าคุณจะลบบัญชี</li>
      </ul>
      <p className="text-sm leading-relaxed text-muted">
        อ่านฉบับเต็ม:{" "}
        <Link href="/terms" className={link}>
          ข้อตกลงการใช้งาน
        </Link>{" "}
        และ{" "}
        <Link href="/privacy" className={link}>
          นโยบายความเป็นส่วนตัว
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
          ยอมรับและเริ่มใช้งาน
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
          ไม่ยอมรับ ออกจากระบบ
        </button>
        <p className="text-xs leading-relaxed text-faint">
          ถ้าไม่ต้องการใช้งานต่อ ลบบัญชีได้ที่หน้า{" "}
          <Link href="/account" className={link}>
            โปรไฟล์
          </Link>
        </p>
      </div>
      {failed && (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger">
          <CircleAlert aria-hidden size={18} className="mt-0.5 shrink-0" />
          บันทึกไม่สำเร็จ ลองอีกครั้ง
        </p>
      )}
    </section>
  );
}
