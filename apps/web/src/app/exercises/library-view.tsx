"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { getExercises, type Exercise } from "@/lib/api";

import { ExercisePicker } from "../exercise-picker";

/** Public exercise list; ?muscle=chest preselects the muscle filter. */
export function LibraryView() {
  const router = useRouter();
  const params = useSearchParams();
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getExercises()
      .then(setExercises)
      .catch(() => setError(true));
  }, []);

  if (error) return <p className="text-sm text-danger">โหลดรายชื่อท่าไม่สำเร็จ ลองรีเฟรชหน้า</p>;
  if (!exercises) return <p className="text-sm text-muted">กำลังโหลด…</p>;

  return (
    <ExercisePicker
      exercises={exercises}
      initialMuscles={params.getAll("muscle")}
      onPick={(e) => router.push(`/exercises/${e.slug}`)}
    />
  );
}
