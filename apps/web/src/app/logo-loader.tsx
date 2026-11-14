import { LogoMark } from "./logo-mark";

/**
 * The loading mark: the logo breathing over a sliding bar. The full-screen
 * navigation splash and in-page loading states both use it, so waiting always
 * looks the same.
 */
export function LogoLoader({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-5 ${className}`}>
      <LogoMark className="splash-breathe h-16 w-16" />
      <div aria-hidden className="h-1 w-28 overflow-hidden rounded-full bg-raised">
        <div className="splash-bar h-full w-1/3 rounded-full bg-primary" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
