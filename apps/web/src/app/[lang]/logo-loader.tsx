import { LogoMark } from "./logo-mark";

/**
 * The loading mark: the logo breathing over a sliding bar. The full-screen
 * navigation splash and in-page loading states all use it, so waiting always
 * looks the same. "sm" fits inside a card.
 */
export function LogoLoader({
  label,
  className = "",
  size = "md",
}: {
  label: string;
  className?: string;
  size?: "md" | "sm";
}) {
  const sm = size === "sm";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center ${sm ? "gap-3" : "gap-5"} ${className}`}
    >
      <LogoMark className={`splash-breathe ${sm ? "h-10 w-10" : "h-16 w-16"}`} />
      <div aria-hidden className={`h-1 overflow-hidden rounded-full bg-raised ${sm ? "w-20" : "w-28"}`}>
        <div className="splash-bar h-full w-1/3 rounded-full bg-primary" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * A page's content is still on its way: the loader in the space the content
 * will fill. splash-in waits a beat before showing, so a fast load never
 * flashes it (the free API host can take a while to wake).
 */
export function PageLoader({ label }: { label: string }) {
  return <LogoLoader label={label} className="splash-in min-h-[45dvh]" />;
}
