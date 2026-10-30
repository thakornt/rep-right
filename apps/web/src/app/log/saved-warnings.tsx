"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getLoadInsights, type LoadReport, type Session } from "@/lib/api";

import { LoadWarnings } from "../insights/load-warnings";

/** Load warnings for the exercises in the session that was just saved. */
export function SavedWarnings({ session }: { session: Session }) {
  const [report, setReport] = useState<LoadReport | null>(null);

  useEffect(() => {
    getLoadInsights()
      .then(setReport)
      .catch(() => setReport(null)); // optional: the session is already saved
  }, [session.id]);

  if (!report) return null;
  const ids = new Set(session.sets.map((s) => s.exercise_id));
  return (
    <div className="flex flex-col gap-3">
      <LoadWarnings report={report} onlyIds={ids} />
      <Link href="/insights" className="text-sm font-medium underline">
        ดูคำเตือนทุกท่าและแผนกลับมาซ้อม
      </Link>
    </div>
  );
}
