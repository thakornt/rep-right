// Line icons for the equipment an exercise uses; keys match EQUIPMENT in lib/exercise-groups.
// Drawn on a 24 grid with one stroke width so they read as a set at tag size (16-18 px).
// The owner approved this set on 2026-11-16.

const PATHS: Record<string, React.ReactNode> = {
  barbell: (
    <>
      <path d="M1 12h22" />
      <rect x="4" y="6" width="2.5" height="12" rx="1" />
      <rect x="17.5" y="6" width="2.5" height="12" rx="1" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M8 12h8" />
      <rect x="3" y="7.5" width="5" height="9" rx="1.5" />
      <rect x="16" y="7.5" width="5" height="9" rx="1.5" />
    </>
  ),
  // A weight stack with a seat beside it, seen from the side.
  machine: (
    <>
      <rect x="3" y="4" width="7" height="16" rx="1" />
      <path d="M3 9.3h7M3 14.6h7M6.5 1.5V4" />
      <path d="M14 7l1 9h6M18 16v4M13.5 20h8" />
    </>
  ),
  band: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="6" />
      <rect x="6" y="9.2" width="12" height="5.6" rx="2.8" />
    </>
  ),
  // A pulley with the cable hanging from it to a triangle handle.
  cable: (
    <>
      <circle cx="9" cy="6.5" r="4.5" />
      <circle cx="9" cy="6.5" r="1.2" />
      <path d="M13.5 6.5V14" />
      <path d="M13.5 14L9.4 20.3Q9 21.5 10.4 21.5H16.6Q18 21.5 17.6 20.3Z" />
      <path d="M10.2 19H16.8" />
    </>
  ),
  bodyweight: (
    <>
      <circle cx="12" cy="4.6" r="2.4" />
      <path d="M3.2 6.8Q3 5 4.6 5.4L10 9.8Q12 11 14 9.8L19.4 5.4Q21 5 20.8 6.8L15.6 11.6L15.8 15.5L17.3 20.6Q17.4 22 15.3 21.2L12 14.8L8.7 21.2Q6.6 22 6.7 20.6L8.2 15.5L8.4 11.6Z" />
    </>
  ),
};

export function EquipmentIcon({ kind, size = 18, className }: { kind: string; size?: number; className?: string }) {
  const paths = PATHS[kind];
  if (!paths) return null;
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className ?? ""}`}
    >
      {paths}
    </svg>
  );
}
