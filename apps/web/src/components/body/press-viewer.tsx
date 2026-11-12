"use client";

import { Pause, Play } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";

import type { View } from "./body-scene";
import { REGION_LABELS, ROLE_COLORS, ROLE_LABELS, type Role } from "./muscles";
import type { CurlSide } from "./pose-curl";
import {
  PRESS_CONTENT,
  PRESS_PINS,
  pressActivation,
  type PressExercise,
  type PressPin,
} from "./press";
import { useDismissOnTap } from "./use-dismiss-on-tap";
import { WaySwitch } from "./way-switch";
import type { PressState } from "./press-scene";
import type { Phase } from "./squat";

// three.js only runs in the browser; the text around it is server-rendered.
const PressScene = dynamic(() => import("./press-scene"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-faint">
      กำลังโหลดโมเดล 3 มิติ…
    </div>
  ),
});

const VIEWS: [View, string][] = [
  ["side", "ด้านข้าง"],
  ["front", "ด้านหน้า"],
  ["back", "ด้านหลัง"],
  ["angle", "เฉียง 45°"],
];

const ROLES: Role[] = ["prime", "synergist", "stabilizer"];

const CURL_WAYS = [
  [false, "ยกพร้อมกัน"],
  [true, "สลับข้าง"],
] as const;

// `switcher` picks another way of doing the lift, shown above the 3D view; `steps`, the form's
// key points, sit under the view's controls, above the muscles.
export function PressViewer({
  exercise,
  switcher,
  steps,
}: {
  exercise: PressExercise;
  switcher?: React.ReactNode;
  steps?: React.ReactNode;
}) {
  const content = PRESS_CONTENT[exercise];
  const state = useRef<PressState>({
    depth: 0.5,
    playing: true,
    alternate: false,
    side: "l",
  });
  const [alternate, setAlternate] = useState(false);
  const [side, setSide] = useState<CurlSide>("l");
  const [view, setView] = useState<View>("angle");
  const [playing, setPlaying] = useState(true);
  const [depth, setDepth] = useState(0.5);
  const [phase, setPhase] = useState<Phase>("down");
  const [activePin, setActivePin] = useState<PressPin | null>(null);
  const closePin = useCallback(() => setActivePin(null), []);
  const popup = useDismissOnTap(activePin !== null, closePin);
  const pinEls = useRef<Record<string, HTMLElement | null>>({});

  const onFrame = useCallback((d: number, p: Phase, s: CurlSide) => {
    setDepth(d);
    setPhase(p);
    setSide(s);
    state.current.side = s;
  }, []);

  const arm = side === "l" ? "แขนซ้าย" : "แขนขวา";

  const onPinMove = useCallback(
    (id: string, x: number, y: number, visible: boolean, front: boolean) => {
      const el = pinEls.current[id];
      if (!el) return;
      el.style.visibility = visible ? "visible" : "hidden";
      // Spots on the far side of the body stay clickable but fade back.
      el.style.opacity = front ? "1" : "0.35";
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    },
    [],
  );

  const togglePlay = () => {
    // While playing the scene drives depth; hand it back to the slider on pause.
    state.current.depth = depth;
    state.current.playing = !state.current.playing;
    setPlaying(state.current.playing);
  };

  // Roles do not change with depth, only how hard each muscle works.
  const roles = pressActivation(exercise, 1, "up");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        {exercise === "hammer" ? (
          <WaySwitch
            ways={CURL_WAYS}
            value={alternate}
            onChange={(value) => {
              state.current.alternate = value;
              setAlternate(value);
            }}
          />
        ) : (
          switcher
        )}
        <div className="relative mx-4 h-[min(68vh,560px)] overflow-hidden rounded-3xl border border-faint/50 bg-inset shadow-inset sm:mx-0">
          <PressScene
            exercise={exercise}
            state={state}
            view={view}
            onPinMove={onPinMove}
            onFrame={onFrame}
          />
          {PRESS_PINS.map((id, i) => (
            <button
              key={id}
              ref={(el) => void (pinEls.current[id] = el)}
              type="button"
              data-pin
              onClick={() => setActivePin((cur) => (cur === id ? null : id))}
              aria-label={`จุดจัดท่าที่ ${i + 1}`}
              style={{ visibility: "hidden" }}
              className={`absolute top-0 left-0 grid h-7 w-7 cursor-pointer place-items-center rounded-full text-xs font-bold shadow-lg ${
                activePin === id
                  ? "bg-fg text-bg"
                  : "bg-primary text-primary-fg"
              }`}
            >
              {i + 1}
            </button>
          ))}
          <div className="pointer-events-none absolute top-3 left-3 rounded-full bg-bg/70 px-3 py-1 text-xs text-muted">
            {alternate && arm}
            {phase === "down"
              ? (content.lowering ?? "กำลังลง")
              : content.rising}{" "}
            · ลากเพื่อหมุนดู · กดตัวเลขดูวิธีจัดท่า
          </div>
          {activePin && (
            <div
              ref={popup}
              className="absolute inset-x-3 bottom-3 rounded-2xl bg-bg/90 p-3 text-sm leading-relaxed"
            >
              <span className="font-semibold text-primary">
                {PRESS_PINS.indexOf(activePin) + 1}.{" "}
              </span>
              {content.cues[activePin]}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {VIEWS.map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`h-10 shrink-0 cursor-pointer rounded-full px-4 text-sm transition-colors ${
              view === v
                ? "bg-primary font-semibold text-primary-fg"
                : "bg-raised text-fg hover:bg-hover"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "หยุด" : "เล่น"}
          className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-full bg-raised text-fg hover:bg-hover"
        >
          {playing ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <label className="flex flex-1 flex-col gap-1">
          <span className="sr-only">ระยะการยก</span>
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
            <span>{alternate ? `${arm}${content.top}` : content.top}</span>
            <span>
              {alternate ? `${arm}${content.bottom}` : content.bottom}
            </span>
          </span>
        </label>
      </div>

      {steps}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-faint">
          กล้ามเนื้อที่ทำงาน
        </h2>
        <ul className="flex flex-col gap-3">
          {ROLES.map((role) => (
            <li key={role} className="flex gap-3">
              <span
                aria-hidden
                className="mt-1 h-4 w-4 shrink-0 rounded-full"
                style={{ background: ROLE_COLORS[role] }}
              />
              <div className="text-sm leading-relaxed">
                <span className="font-semibold">{ROLE_LABELS[role].name}</span>
                <span className="text-muted"> — {ROLE_LABELS[role].hint}</span>
                <div className="text-fg/90">
                  {roles
                    .filter((a) => a.role === role)
                    .map((a) => REGION_LABELS[a.region])
                    .join(", ")}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-faint">
          สังเกตร่างกายระหว่างเล่น
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-fg/90">
          {content.notice.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="text-xs leading-relaxed text-faint">
          ภาพและสีกล้ามเนื้อเป็นแนวทางทั่วไปเพื่อช่วยเข้าใจท่า
          ไม่ใช่คำวินิจฉัยหรือคำแนะนำทางการแพทย์
        </p>
      </section>
    </div>
  );
}
