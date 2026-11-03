"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";

import type { SquatState, View } from "./body-scene";
import { REGION_LABELS, ROLE_COLORS, ROLE_LABELS, type Role } from "./muscles";
import { NO_FAULTS, SQUAT_PINS, squatActivation, type Phase, type SquatFaults, type SquatMetrics } from "./squat";

// three.js only runs in the browser; the text around it is server-rendered.
const BodyScene = dynamic(() => import("./body-scene"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-faint">กำลังโหลดโมเดล 3 มิติ…</div>
  ),
});

const VIEWS: [View, string][] = [
  ["side", "ด้านข้าง"],
  ["front", "ด้านหน้า"],
  ["back", "ด้านหลัง"],
  ["angle", "เฉียง 45°"],
];

const FAULTS: { key: keyof SquatFaults; label: string; effect: string }[] = [
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

const CUES: Record<string, string> = {
  feet: "เท้าทั้งฝ่าติดพื้น น้ำหนักอยู่กลางเท้า (วงสีเขียวที่พื้น)",
  knee: "เข่าชี้ไปทางเดียวกับปลายเท้า ไม่บีบเข้าหากัน",
  core: "หายใจเข้าลึกแล้วเกร็งท้องให้แน่นก่อนลง ค้างไว้จนยืนขึ้น",
  back: "หลังตรงเป็นแนวเดียวตั้งแต่สะโพกถึงคอ ลงลึกเท่าที่หลังล่างยังไม่งอ",
  bar: "วางบาร์บนหลังบนแล้วบีบสะบักเข้าหากัน ให้บาร์อยู่เหนือกลางเท้าตลอด (เส้นแนวดิ่ง)",
};

const ROLES: Role[] = ["prime", "synergist", "stabilizer"];

export function SquatViewer() {
  const state = useRef<SquatState>({ depth: 0.55, playing: true, faults: NO_FAULTS });
  const [view, setView] = useState<View>("angle");
  const [faults, setFaults] = useState<SquatFaults>(NO_FAULTS);
  const [playing, setPlaying] = useState(true);
  const [depth, setDepth] = useState(0.55);
  const [phase, setPhase] = useState<Phase>("down");
  const [metrics, setMetrics] = useState<SquatMetrics | null>(null);
  const [activePin, setActivePin] = useState<string | null>(null);
  const pinEls = useRef<Record<string, HTMLElement | null>>({});

  const onFrame = useCallback((d: number, p: Phase, m: SquatMetrics) => {
    setDepth(d);
    setPhase(p);
    setMetrics(m);
  }, []);

  const onPin = useCallback((id: string) => setActivePin((cur) => (cur === id ? null : id)), []);

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
  const toggleFault = (key: keyof SquatFaults) => {
    const next = { ...faults, [key]: !faults[key] };
    state.current.faults = next;
    setFaults(next);
  };

  // Roles do not change with depth, only how hard each muscle works.
  const roles = squatActivation(1, "up", NO_FAULTS);

  return (
    <div className="flex flex-col gap-5">
      <div className="relative h-[min(68vh,560px)] overflow-hidden rounded-3xl bg-inset shadow-inset">
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
              onClick={() => onPin(p.id)}
              aria-label={`จุดจัดท่าที่ ${i + 1}`}
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
          {phase === "down" ? "กำลังลง" : "กำลังดันขึ้น"} · ลากเพื่อหมุนดู
        </div>
        {activePin && (
          <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-bg/90 p-3 text-sm leading-relaxed">
            <span className="font-semibold text-primary">{SQUAT_PINS.findIndex((p) => p.id === activePin) + 1}. </span>
            {CUES[activePin]}
          </div>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {VIEWS.map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`h-10 shrink-0 cursor-pointer rounded-full px-4 text-sm transition-colors ${
              view === v ? "bg-primary font-semibold text-primary-fg" : "bg-raised text-fg hover:bg-[#1f3035]"
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
          className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-full bg-raised text-fg hover:bg-[#1f3035]"
        >
          {playing ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-faint">ความลึก</span>
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
        </label>
      </div>

      {metrics && <Metrics m={metrics} />}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-faint">ลองดูฟอร์มที่ผิด</h2>
        <div className="flex flex-wrap gap-2">
          {FAULTS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={faults[f.key]}
              onClick={() => toggleFault(f.key)}
              className={`h-10 cursor-pointer rounded-full px-4 text-sm transition-colors ${
                faults[f.key] ? "bg-danger font-semibold text-danger-fg" : "bg-raised text-fg hover:bg-[#1f3035]"
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
              <RotateCcw size={15} /> ฟอร์มที่ถูก
            </button>
          )}
        </div>
        {FAULTS.filter((f) => faults[f.key]).map((f) => (
          <p key={f.key} className="text-sm leading-relaxed text-fg/90">
            <span className="font-semibold text-danger">{f.label}: </span>
            {f.effect}
          </p>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-faint">กล้ามเนื้อที่ทำงาน</h2>
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
          <li className="flex gap-3">
            <span aria-hidden className="mt-1 h-4 w-4 shrink-0 rounded-full" style={{ background: ROLE_COLORS.warn }} />
            <p className="text-sm leading-relaxed text-muted">กะพริบสีแดง = ส่วนที่รับภาระเพิ่มเมื่อฟอร์มผิด</p>
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-faint">จุดจัดท่า (กดตัวเลขบนโมเดลได้)</h2>
        <ol className="flex flex-col gap-2">
          {SQUAT_PINS.map(({ id }, i) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onPin(id)}
                className={`flex w-full cursor-pointer gap-3 rounded-2xl p-2 text-left text-sm leading-relaxed transition-colors ${
                  activePin === id ? "bg-raised" : "hover:bg-raised/60"
                }`}
              >
                <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-fg">
                  {i + 1}
                </span>
                <span className="pt-0.5">{CUES[id]}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <p className="text-xs leading-relaxed text-faint">
        ภาพและสีกล้ามเนื้อเป็นแนวทางทั่วไปเพื่อช่วยเข้าใจท่า ไม่ใช่ค่าที่วัดจากร่างกายจริง และไม่ใช่คำวินิจฉัย
        สัดส่วนร่างกายแต่ละคนต่างกัน มุมที่เหมาะจึงต่างกันได้
      </p>
    </div>
  );
}

function Metrics({ m }: { m: SquatMetrics }) {
  const depthText =
    m.depthCm >= 0 ? `สะโพกสูงกว่าเข่า ${m.depthCm.toFixed(0)} ซม.` : `ต่ำกว่าเข่า ${(-m.depthCm).toFixed(0)} ซม.`;
  const barOk = Math.abs(m.barCm) <= 3;
  const barText = barOk
    ? "อยู่เหนือกลางเท้า"
    : `${m.barCm > 0 ? "เลยไปข้างหน้า" : "อยู่ค่อนไปทางส้น"} ${Math.abs(m.barCm).toFixed(0)} ซม.`;
  const items: [string, string, boolean?][] = [
    ["ลำตัวเอียง", `${m.torso.toFixed(0)}°`],
    ["หน้าแข้งเอียง", `${m.shin.toFixed(0)}°`],
    ["เข่างอ", `${m.knee.toFixed(0)}°`],
    ["สะโพกงอ", `${m.hip.toFixed(0)}°`],
    ["ความลึก (เทียบต้นขาขนานพื้น)", depthText],
    ["บาร์", barText, !barOk],
  ];
  return (
    <dl className="grid grid-cols-2 gap-2">
      {items.map(([k, v, bad]) => (
        <div key={k} className="rounded-2xl bg-surface p-3">
          <dt className="text-xs text-faint">{k}</dt>
          <dd className={`num mt-0.5 text-[0.95rem] font-semibold ${bad ? "text-warn" : ""}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
