"use client";

import { Pause, Play } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";

import { useLocale, useMessages } from "@/lib/i18n/client";

import type { View } from "./body-scene";
import { REGION_LABELS, REGION_LABELS_EN, ROLE_COLORS, ROLE_LABELS, ROLE_LABELS_EN, type Role } from "./muscles";
import type { CurlSide } from "./pose-curl";
import { pressContent } from "./press-en";
import {
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
  loading: () => <Loading3D />,
});

function Loading3D() {
  return <div className="grid h-full place-items-center text-sm text-faint">{useMessages().viewer.loading}</div>;
}

const VIEWS: View[] = ["side", "front", "back", "angle"];

const ROLES: Role[] = ["prime", "synergist", "stabilizer"];

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
  const locale = useLocale();
  const t = useMessages().viewer;
  const content = pressContent(exercise, locale);
  const regionLabels = locale === "en" ? REGION_LABELS_EN : REGION_LABELS;
  const roleLabels = locale === "en" ? ROLE_LABELS_EN : ROLE_LABELS;
  const curlWays = [
    [false, t.together],
    [true, t.alternate],
  ] as const;
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

  const arm = side === "l" ? t.leftArm : t.rightArm;
  const phaseText = phase === "down" ? (content.lowering ?? t.lowering) : content.rising;

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
            ways={curlWays}
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
              aria-label={t.pin(i + 1)}
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
            {alternate ? t.withArm(arm, phaseText) : phaseText} · {t.howTo}
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
        {VIEWS.map((v) => (
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
          <span className="sr-only">{t.range}</span>
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
            <span>{alternate ? t.withArm(arm, content.top) : content.top}</span>
            <span>{alternate ? t.withArm(arm, content.bottom) : content.bottom}</span>
          </span>
        </label>
      </div>

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
        </ul>
        {content.grips && (
          <div className="mt-2 flex flex-col gap-3 rounded-2xl bg-raised p-4">
            <h3 className="text-sm font-semibold">{t.grips}</h3>
            {content.grips.map((g) => (
              <div key={g.label} className="text-sm leading-relaxed">
                <div className="font-semibold">{g.label}</div>
                <div className="text-fg/90">{g.text}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-faint">{t.notice}</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-fg/90">
          {content.notice.map((line) => (
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
