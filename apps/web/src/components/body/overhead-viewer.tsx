"use client";

import { useState } from "react";

import { PressViewer } from "./press-viewer";
import { WaySwitch } from "./way-switch";

const WAYS = [
  ["overheadTwo", "สองมือ"],
  ["overheadOne", "แขนเดียว"],
] as const;

// The overhead triceps extension, done with both hands on one dumbbell or one arm at a time.
export function OverheadViewer({ steps }: { steps?: React.ReactNode }) {
  const [way, setWay] = useState<(typeof WAYS)[number][0]>("overheadTwo");
  return <PressViewer key={way} exercise={way} switcher={<WaySwitch ways={WAYS} value={way} onChange={setWay} />} steps={steps} />;
}
