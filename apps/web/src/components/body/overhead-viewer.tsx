"use client";

import { useState } from "react";

import { PressViewer } from "./press-viewer";
import { WaySwitch } from "./way-switch";

const WAYS = [
  ["overheadTwo", "สองมือ"],
  ["overheadOne", "แขนเดียว"],
] as const;

// The overhead triceps extension. With a dumbbell, done with both hands on it or one arm at a time;
// with a cable, both hands on a rope. `switcher`, the choice of tool on the exercise's page, sits
// above the dumbbell's own choice.
export function OverheadViewer({ cable, switcher, steps }: { cable?: boolean; switcher?: React.ReactNode; steps?: React.ReactNode }) {
  const [way, setWay] = useState<(typeof WAYS)[number][0]>("overheadTwo");
  if (cable) return <PressViewer key="cable" exercise="overheadCable" switcher={switcher} steps={steps} />;
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
