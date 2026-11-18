"use client";

import { useMessages } from "@/lib/i18n/client";

// Picks one way of doing a lift, above its 3D view: both arms or one, together or in turn.
export function WaySwitch<T extends string | boolean>({
  ways,
  value,
  onChange,
}: {
  ways: readonly (readonly [T, string])[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useMessages().viewer;
  return (
    <div
      role="group"
      aria-label={t.ways}
      className="flex gap-1 self-start rounded-full bg-raised p-1"
    >
      {ways.map(([v, label]) => (
        <button
          key={String(v)}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`h-9 cursor-pointer rounded-full px-4 text-sm transition-colors ${
            value === v
              ? "bg-primary font-semibold text-primary-fg"
              : "text-fg hover:bg-hover"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
