import Link from "next/link";

import { REGIONS, muscleLabel } from "@/lib/exercise-groups";

// Background photo per region, in REGIONS order.
// Photos: Unsplash License and one supplied by the owner; see public/images/regions/CREDITS.md.
const LOOKS: { photo: string; focus: string }[] = [
  { photo: "upper", focus: "object-[55%_45%]" },
  { photo: "core", focus: "object-[55%_75%]" },
  { photo: "lower", focus: "object-[60%_35%]" },
];

export function RegionCards() {
  return (
    <div className="relative isolate">
      {/* Soft light behind the glass, so the blur has something to catch. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-10 -left-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-1/3 -right-20 h-64 w-64 rounded-full bg-white/[0.07] blur-3xl" />
        <div className="absolute -bottom-12 left-1/4 h-48 w-48 rounded-full bg-primary/12 blur-3xl" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {REGIONS.map(([region, muscles], i) => {
          const look = LOOKS[i];
          return (
            <section
              key={region}
              aria-labelledby={`region-${i}`}
              className={`region-card group relative isolate flex min-h-52 flex-col justify-between gap-6 overflow-hidden rounded-[1.75rem] p-5 ${
                i === 0 ? "sm:col-span-2" : ""
              }`}
            >
              <picture>
                <source srcSet={`/images/regions/${look.photo}.avif`} type="image/avif" />
                <img
                  src={`/images/regions/${look.photo}.webp`}
                  alt=""
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className={`region-photo pointer-events-none absolute inset-y-0 right-0 h-full w-[78%] object-cover ${look.focus} ${
                    i === 0 ? "sm:w-[58%]" : ""
                  }`}
                />
              </picture>

              <div className="flex items-start justify-between gap-3">
                <h2 id={`region-${i}`} className="text-2xl font-semibold tracking-tight text-fg">
                  {region}
                </h2>
                <span className="region-count">{muscles.length} กลุ่ม</span>
              </div>

              <ul className="flex flex-wrap gap-2">
                {muscles.map((m) => (
                  <li key={m}>
                    <Link href={`/exercises?muscle=${m}`} className="region-chip">
                      {muscleLabel(m)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
