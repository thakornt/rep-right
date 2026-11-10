"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { getExercises, type Exercise } from "@/lib/api";
import { useReportNavigating } from "@/lib/navigating";

import { ExercisePicker } from "../exercise-picker";

/** Public exercise list; ?muscle=chest preselects the muscle filter. */
export function LibraryView() {
  const router = useRouter();
  const params = useSearchParams();
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [error, setError] = useState(false);
  // Opening an exercise can wait on the network; the splash covers the wait.
  const [opening, startOpening] = useTransition();
  useReportNavigating(opening);

  useEffect(() => {
    getExercises()
      .then(setExercises)
      .catch(() => setError(true));
  }, []);

  if (error) return <p className="text-sm text-danger">โหลดรายชื่อท่าไม่สำเร็จ ลองรีเฟรชหน้า</p>;
  if (!exercises) return <p className="text-sm text-muted">กำลังโหลด…</p>;

  const muscles = params.getAll("muscle");
  return (
    // Next keeps this page's state between visits, so remount the picker when
    // ?muscle= changes; otherwise a second visit keeps the old filter.
    <ExercisePicker
      key={muscles.join(",")}
      exercises={exercises}
      initialMuscles={muscles}
      mark3d
      onPick={(e) => startOpening(() => router.push(`/exercises/${e.slug}`))}
    />
  );
}
