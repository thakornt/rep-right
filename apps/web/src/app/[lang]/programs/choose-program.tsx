"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useMessages } from "@/lib/i18n/client";
import { saveMyProgram, useMyProgram } from "@/lib/my-program";

import { btnPrimary } from "../ui";

/** "Use this program" under a program card; saves it and goes home to today's session. */
export function ChooseProgram({ id }: { id: string }) {
  const router = useRouter();
  const mine = useMyProgram();
  const chosen = mine?.id === id;
  const t = useMessages().programs;

  return (
    <div className="flex flex-col gap-2">
      {chosen ? (
        <p className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-raised font-semibold text-primary">
          <CircleCheck aria-hidden size={20} /> {t.current}
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
          {t.use}
        </button>
      )}
      <p className="text-center text-sm text-faint">
        {t.changeAnytime}{" "}
        <Link href="/account" className="text-primary underline-offset-4 hover:underline">
          {t.profilePage}
        </Link>
      </p>
    </div>
  );
}
