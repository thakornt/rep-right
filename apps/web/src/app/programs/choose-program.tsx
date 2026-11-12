"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { saveMyProgram, useMyProgram } from "@/lib/my-program";

import { btnPrimary } from "../ui";

/** "Use this program" under a program card; saves it and goes home to today's session. */
export function ChooseProgram({ id }: { id: string }) {
  const router = useRouter();
  const mine = useMyProgram();
  const chosen = mine?.id === id;

  return (
    <div className="flex flex-col gap-2">
      {chosen ? (
        <p className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-raised font-semibold text-primary">
          <CircleCheck aria-hidden size={20} /> โปรแกรมของคุณตอนนี้
        </p>
      ) : (
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            void saveMyProgram(id);
            router.push("/");
          }}
        >
          ใช้โปรแกรมนี้
        </button>
      )}
      <p className="text-center text-sm text-faint">
        เปลี่ยนโปรแกรมที่เลือกได้เสมอใน{" "}
        <Link href="/account" className="text-primary underline-offset-4 hover:underline">
          หน้าโปรไฟล์
        </Link>
      </p>
    </div>
  );
}
