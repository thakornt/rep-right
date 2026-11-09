/** Marks an exercise that has a 3D viewer: a small isometric cube and "3D" on a green pill. */
export function Badge3D({ className = "" }: { className?: string }) {
  return (
    <span
      title="มีภาพ 3D"
      className={`num inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-[linear-gradient(160deg,#6ee7b7_0%,var(--health)_55%,#10b981_100%)] pr-2 pl-[0.3rem] text-[0.7rem] leading-none font-extrabold text-health-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.45),inset_0_-1px_0_rgb(4_120_87/0.5)] ${className}`}
    >
      <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5">
        <path d="M8 1.5 14 5v6L8 14.5 2 11V5z" fill="#047857" />
        <path d="M8 1.5 14 5 8 8.5 2 5z" fill="#ecfdf5" />
        <path d="M2 5l6 3.5v6L2 11z" fill="#a7f3d0" />
      </svg>
      3D
    </span>
  );
}
