"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";

import { useLocale, useMessages } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/locale";

import type { SquatState, View } from "./body-scene";
import { useDismissOnTap } from "./use-dismiss-on-tap";
import { REGION_LABELS, REGION_LABELS_EN, ROLE_COLORS, ROLE_LABELS, ROLE_LABELS_EN, type Role } from "./muscles";
import { NO_FAULTS, SQUAT_PINS, squatActivation, type Phase, type SquatFaults } from "./squat";

// three.js only runs in the browser; the text around it is server-rendered.
const BodyScene = dynamic(() => import("./body-scene"), {
  ssr: false,
  loading: () => <Loading3D />,
});

function Loading3D() {
  return <div className="grid h-full place-items-center text-sm text-faint">{useMessages().viewer.loading}</div>;
}

const VIEWS: View[] = ["side", "front", "back", "angle"];

type Fault = { key: keyof SquatFaults; label: string; effect: string };

const FAULTS_TH: Fault[] = [
  {
    key: "forwardLean",
    label: "โน้มตัวมากเกิน",
    effect: "ลำตัวโน้มจนบาร์เลยกลางเท้าไปข้างหน้า หลังล่างต้องออกแรงต้านมากขึ้น",
  },
  {
    key: "buttWink",
    label: "หลังล่างงอที่ก้นหลุม",
    effect: "ช่วงลึกสุดสะโพกม้วนเข้าและหลังล่างงอ ลองลงให้ตื้นขึ้นเล็กน้อยเท่าที่หลังยังตรง",
  },
  {
    key: "kneeValgus",
    label: "เข่าบีบเข้าใน",
    effect: "เข่าบีบเข้าหากันแทนที่จะชี้ตามปลายเท้า ดันเข่าออกให้อยู่แนวเดียวกับปลายเท้า",
  },
  {
    key: "heelRise",
    label: "ส้นเท้ายก",
    effect: "น้ำหนักเทไปที่ปลายเท้า ทรงตัวยากและเข่ารับแรงมากขึ้น กดส้นเท้าลงพื้นตลอด",
  },
];

const FAULTS_EN: Fault[] = [
  {
    key: "forwardLean",
    label: "Leaning too far forward",
    effect: "The body tips until the bar is in front of the middle of the foot, so the lower back has to work harder to hold it.",
  },
  {
    key: "buttWink",
    label: "Lower back rounding at the bottom",
    effect: "At the deepest point the hips tuck under and the lower back rounds. Try going a little less deep, only as far as your back stays straight.",
  },
  {
    key: "kneeValgus",
    label: "Knees caving in",
    effect: "The knees squeeze toward each other instead of following the toes. Push your knees out in line with your toes.",
  },
  {
    key: "heelRise",
    label: "Heels lifting",
    effect: "Your weight tips onto your toes, which makes balance harder and puts more strain on the knees. Keep your heels pressed into the floor.",
  },
];

const FAULTS: Record<Locale, Fault[]> = { th: FAULTS_TH, en: FAULTS_EN };

const CUES: Record<Locale, Record<string, string>> = {
  th: {
    feet: "เท้าทั้งฝ่าติดพื้น น้ำหนักอยู่กลางเท้า (วงสีเขียวที่พื้น)",
    knee: "เข่าชี้ไปทางเดียวกับปลายเท้า ไม่บีบเข้าหากัน",
    core: "หายใจเข้าลึกแล้วเกร็งท้องให้แน่นก่อนลง ค้างไว้จนยืนขึ้น",
    back: "หลังตรงเป็นแนวเดียวตั้งแต่สะโพกถึงคอ ลงลึกเท่าที่หลังล่างยังไม่งอ",
    bar: "วางบาร์บนหลังบนแล้วบีบสะบักเข้าหากัน ให้บาร์อยู่เหนือกลางเท้าตลอด (เส้นแนวดิ่ง)",
  },
  en: {
    feet: "Whole foot on the floor, weight over the middle of the foot (the green ring on the floor).",
    knee: "Knees point the same way as your toes, not squeezing in toward each other.",
    core: "Take a deep breath and brace your stomach tight before going down. Hold it until you're standing again.",
    back: "Back in one straight line from hips to neck. Go only as deep as your lower back stays unrounded.",
    bar: "Rest the bar on your upper back and squeeze your shoulder blades together. Keep the bar over the middle of your foot the whole time (the vertical line).",
  },
};

const NOTICE: Record<Locale, string[]> = {
  th: [
    "ร่างกายแต่ละคนไม่เหมือนกัน ความลึกและการเอียงตัวที่เหมาะจึงต่างกันได้ ไม่ต้องให้เหมือนโมเดลเป๊ะ",
    "ลงลึกเท่าที่หลังยังตรงและส้นเท้ายังติดพื้น ตรงนั้นคือความลึกที่เหมาะกับคุณตอนนี้",
    "ถ้ารู้สึกเจ็บแปลบ ปวดผิดปกติที่เข่า หลัง หรือสะโพก ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
  ],
  en: [
    "Everybody's body is different, so the right depth and lean can differ. You don't have to match the model exactly.",
    "Go as deep as your back stays straight and your heels stay down. That's the right depth for you for now.",
    "If you feel a sharp or unusual pain in your knees, back or hips, stop right away and talk to a professional.",
  ],
};

const ROLES: Role[] = ["prime", "synergist", "stabilizer"];

// `switcher` picks another way of doing the lift, shown above the 3D view; `steps`, the form's
// key points, sit above the muscles.
export function SquatViewer({ switcher, steps }: { switcher?: React.ReactNode; steps?: React.ReactNode }) {
  const locale = useLocale();
  const t = useMessages().viewer;
  const regionLabels = locale === "en" ? REGION_LABELS_EN : REGION_LABELS;
  const roleLabels = locale === "en" ? ROLE_LABELS_EN : ROLE_LABELS;
  const state = useRef<SquatState>({ depth: 0.55, playing: true, faults: NO_FAULTS });
  const [view, setView] = useState<View>("angle");
  const [faults, setFaults] = useState<SquatFaults>(NO_FAULTS);
  const [playing, setPlaying] = useState(true);
  const [depth, setDepth] = useState(0.55);
  const [phase, setPhase] = useState<Phase>("down");
  const [activePin, setActivePin] = useState<string | null>(null);
  const pinEls = useRef<Record<string, HTMLElement | null>>({});

  const onFrame = useCallback((d: number, p: Phase) => {
    setDepth(d);
    setPhase(p);
  }, []);

  const onPin = useCallback((id: string) => setActivePin((cur) => (cur === id ? null : id)), []);
  const closePin = useCallback(() => setActivePin(null), []);
  const popup = useDismissOnTap(activePin !== null, closePin);

  const onPinMove = useCallback((id: string, x: number, y: number, visible: boolean, front: boolean) => {
    const el = pinEls.current[id];
    if (!el) return;
    el.style.visibility = visible ? "visible" : "hidden";
    // Spots on the far side of the body stay clickable but fade back.
    el.style.opacity = front ? "1" : "0.35";
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  }, []);

  const togglePlay = () => {
    // While playing the scene drives depth; hand it back to the slider on pause.
    state.current.depth = depth;
    state.current.playing = !state.current.playing;
    setPlaying(state.current.playing);
  };
  // One fault at a time: mixed together they stop showing any one mistake.
  const toggleFault = (key: keyof SquatFaults) => {
    const next = { ...NO_FAULTS, [key]: !faults[key] };
    state.current.faults = next;
    setFaults(next);
  };

  // Roles do not change with depth, only how hard each muscle works.
  const roles = squatActivation(1, "up", NO_FAULTS);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        {switcher}
        <div className="relative mx-4 h-[min(68vh,560px)] overflow-hidden rounded-3xl border border-faint/50 bg-inset shadow-inset sm:mx-0">
          <BodyScene
            state={state}
            view={view}
            onPinMove={onPinMove}
            onFrame={onFrame}
          />
          {SQUAT_PINS.map((p, i) => {
            const warn = p.warn(faults);
            const active = activePin === p.id;
            return (
              <button
                key={p.id}
                ref={(el) => void (pinEls.current[p.id] = el)}
                type="button"
                data-pin
                onClick={() => onPin(p.id)}
                aria-label={t.pin(i + 1)}
                style={{ visibility: "hidden" }}
                className={`absolute top-0 left-0 grid h-7 w-7 cursor-pointer place-items-center rounded-full text-xs font-bold shadow-lg ${
                  warn ? "bg-danger text-danger-fg" : active ? "bg-fg text-bg" : "bg-primary text-primary-fg"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
          <div className="pointer-events-none absolute top-3 left-3 rounded-full bg-bg/70 px-3 py-1 text-xs text-muted">
            {phase === "down" ? t.lowering : t.rising} · {t.howTo}
          </div>
          {activePin && (
            <div ref={popup} className="absolute inset-x-3 bottom-3 rounded-2xl bg-bg/90 p-3 text-sm leading-relaxed">
              <span className="font-semibold text-primary">{SQUAT_PINS.findIndex((p) => p.id === activePin) + 1}. </span>
              {CUES[locale][activePin]}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`h-10 shrink-0 cursor-pointer rounded-full px-4 text-sm transition-colors ${
              view === v ? "bg-primary font-semibold text-primary-fg" : "bg-raised text-fg hover:bg-hover"
            }`}
          >
            {t.views[v]}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? t.pause : t.play}
          className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-full bg-raised text-fg hover:bg-hover"
        >
          {playing ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <label className="flex flex-1 flex-col gap-1">
          <span className="sr-only">{t.depth}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={depth}
            onChange={(e) => {
              const d = Number(e.target.value);
              state.current.playing = false;
              state.current.depth = d;
              setPlaying(false);
              setDepth(d);
            }}
            className="w-full accent-[var(--primary)]"
          />
          <span aria-hidden className="flex justify-between text-xs text-faint">
            <span>{t.standing}</span>
            <span>{t.deep}</span>
          </span>
        </label>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-faint">{t.faults}</h2>
        <div className="flex flex-wrap gap-2">
          {FAULTS[locale].map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={faults[f.key]}
              onClick={() => toggleFault(f.key)}
              className={`h-10 cursor-pointer rounded-full px-4 text-sm transition-colors ${
                faults[f.key] ? "bg-danger font-semibold text-danger-fg" : "bg-raised text-fg hover:bg-hover"
              }`}
            >
              {f.label}
            </button>
          ))}
          {Object.values(faults).some(Boolean) && (
            <button
              type="button"
              onClick={() => {
                state.current.faults = NO_FAULTS;
                setFaults(NO_FAULTS);
              }}
              className="inline-flex h-10 cursor-pointer items-center gap-1.5 px-2 text-sm text-primary"
            >
              <RotateCcw size={15} /> {t.goodForm}
            </button>
          )}
        </div>
        {FAULTS[locale].filter((f) => faults[f.key]).map((f) => (
          <p key={f.key} className="text-sm leading-relaxed text-fg/90">
            <span className="font-semibold text-danger">{f.label}: </span>
            {f.effect}
          </p>
        ))}
      </section>

      {steps}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-faint">{t.muscles}</h2>
        <ul className="flex flex-col gap-3">
          {ROLES.map((role) => (
            <li key={role} className="flex gap-3">
              <span
                aria-hidden
                className="mt-1 h-4 w-4 shrink-0 rounded-full"
                style={{ background: ROLE_COLORS[role] }}
              />
              <div className="text-sm leading-relaxed">
                <span className="font-semibold">{roleLabels[role].name}</span>
                <span className="text-muted"> — {roleLabels[role].hint}</span>
                <div className="text-fg/90">
                  {roles
                    .filter((a) => a.role === role)
                    .map((a) => regionLabels[a.region])
                    .join(", ")}
                </div>
              </div>
            </li>
          ))}
          <li className="flex gap-3">
            <span aria-hidden className="mt-1 h-4 w-4 shrink-0 rounded-full" style={{ background: ROLE_COLORS.warn }} />
            <p className="text-sm leading-relaxed text-muted">{t.warnLegend}</p>
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-faint">{t.notice}</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-fg/90">
          {NOTICE[locale].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="text-xs leading-relaxed text-faint">
          {t.disclaimer}
        </p>
      </section>
    </div>
  );
}
