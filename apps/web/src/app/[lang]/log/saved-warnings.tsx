"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getExercises, getLoadInsights, type Exercise, type LoadReport, type Session } from "@/lib/api";
import { useMessages } from "@/lib/i18n/client";

import { LoadWarnings } from "../insights/load-warnings";

/** Load warnings for the exercises in the session that was just saved. */
export function SavedWarnings({ session }: { session: Session }) {
  const [report, setReport] = useState<LoadReport | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const t = useMessages();

  useEffect(() => {
    getLoadInsights()
      .then(setReport)
      .catch(() => setReport(null)); // optional: the session is already saved
    getExercises()
      .then(setExercises)
      .catch(() => undefined); // names fall back to the report's own
  }, [session.id]);

  if (!report) return null;
  const ids = new Set(session.sets.map((s) => s.exercise_id));
  return (
    <div className="flex flex-col gap-3">
      <LoadWarnings report={report} exercises={exercises} onlyIds={ids} />
      <Link href="/insights" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary">
        {t.log.allWarnings} <ArrowRight aria-hidden size={16} />
      </Link>
    </div>
  );
}
