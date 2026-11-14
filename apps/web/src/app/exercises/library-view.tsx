"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { getExercises, type Exercise } from "@/lib/api";
import { useReportNavigating } from "@/lib/navigating";

import { ExercisePicker } from "../exercise-picker";
import { LogoLoader } from "../logo-loader";

/**
 * The splash's logo and bar while the list loads (the free API host can take a while to
 * wake). splash-in waits a beat before showing, so a fast load never flashes it.
 */
export function ExercisesLoading() {
  return <LogoLoader label="กำลังโหลดรายชื่อท่า…" className="splash-in min-h-[45dvh]" />;
}

/** Public exercise list; ?muscle=chest and ?equipment=dumbbell preselect the filters. */
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
  if (!exercises) return <ExercisesLoading />;

  const muscles = params.getAll("muscle");
  const equipment = params.getAll("equipment");
  return (
    // Next keeps this page's state between visits, so remount the picker when
    // ?muscle= or ?equipment= changes; otherwise a second visit keeps the old filter.
    <ExercisePicker
      key={`${muscles.join(",")}|${equipment.join(",")}`}
      exercises={exercises}
      initialMuscles={muscles}
      initialEquipment={equipment}
      mark3d
      onPick={(e) => startOpening(() => router.push(`/exercises/${e.slug}`))}
    />
  );
}
