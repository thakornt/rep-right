"use client";

import { useState } from "react";

import { useMessages } from "@/lib/i18n/client";

import { PressViewer } from "./press-viewer";
import { WaySwitch } from "./way-switch";

type Way = "overheadTwo" | "overheadOne";

// The overhead triceps extension. With a dumbbell, done with both hands on it or one arm at a time;
// with a cable, both hands on a rope. `switcher`, the choice of tool on the exercise's page, sits
// above the dumbbell's own choice.
export function OverheadViewer({ cable, switcher, steps }: { cable?: boolean; switcher?: React.ReactNode; steps?: React.ReactNode }) {
  const [way, setWay] = useState<Way>("overheadTwo");
  const t = useMessages().viewer;
  const ways = [
    ["overheadTwo", t.twoHands],
    ["overheadOne", t.oneArm],
  ] as const;
  if (cable) return <PressViewer key="cable" exercise="overheadCable" switcher={switcher} steps={steps} />;
  return (
    <PressViewer
      key={way}
      exercise={way}
      switcher={
        <div className="flex flex-col gap-2">
          {switcher}
          <WaySwitch ways={ways} value={way} onChange={setWay} />
        </div>
      }
      steps={steps}
    />
  );
}
