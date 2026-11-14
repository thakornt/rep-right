"use client";

import { useState } from "react";

import { PressViewer } from "./press-viewer";
import { WaySwitch } from "./way-switch";

const WAYS = [
  ["overheadTwo", "สองมือ"],
  ["overheadOne", "แขนเดียว"],
] as const;

// The overhead triceps extension with a dumbbell, done with both hands on it or one arm at a time.
// `switcher`, another choice on the exercise's page (dumbbell or cable), sits above this one.
export function OverheadViewer({ switcher, steps }: { switcher?: React.ReactNode; steps?: React.ReactNode }) {
  const [way, setWay] = useState<(typeof WAYS)[number][0]>("overheadTwo");
  return (
    <PressViewer
      key={way}
      exercise={way}
      switcher={
        <div className="flex flex-col gap-2">
          {switcher}
          <WaySwitch ways={WAYS} value={way} onChange={setWay} />
        </div>
      }
      steps={steps}
    />
  );
}
