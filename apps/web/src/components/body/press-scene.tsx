"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { memo, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  bodyMaterial,
  CameraRig,
  Floor,
  PLAY_SECONDS,
  useBody,
  useMuscleMap,
  type View,
} from "./body-scene";
import { REGION_IDS, ROLE_COLORS, ROLE_STRENGTH } from "./muscles";
import { overBody, PIN_RADIUS } from "./pin-cover";
import { BAR_RADIUS, worldPos, worldQuat, type Rig } from "./pose";
import {
  alternateAt,
  alternateTime,
  bicepsBulge,
  HAMMER_CURL,
  poseCurl,
  readCurlRig,
  type CurlSide,
} from "./pose-curl";
import {
  DUMBBELL_SQUAT,
  poseDumbbellSquat,
  readDumbbellSquatRig,
} from "./pose-dumbbell-squat";
import { CRUNCH, poseCrunch, readCrunchRig } from "./pose-crunch";
import {
  LAT_PULLDOWN,
  posePulldown,
  pulleyAt,
  readPulldownRig,
  type PulldownRig,
} from "./pose-pulldown";
import {
  posePulldownVariant,
  PULLDOWN_NEUTRAL,
  PULLDOWN_SINGLE,
  readPulldownVariantRig,
  type PulldownGrip,
} from "./pose-pulldown-variants";
import {
  LEG_EXTENSION,
  poseLegExtension,
  readLegExtensionRig,
  seatTopAt,
  type LegExtensionRig,
} from "./pose-leg-extension";
import {
  benchLayout,
  DUMBBELL,
  INCLINE_PRESS,
  posePress,
  readPressRig,
  SHOULDER_PRESS,
} from "./pose-press";
import {
  posePushdown,
  pushdownPulley,
  readPushdownRig,
  ROPE_PUSHDOWN,
  tricepsGather,
} from "./pose-pushdown";
import {
  OVERHEAD_ONE,
  OVERHEAD_TWO,
  SHOULDER_GIRDLE,
  poseOverheadOne,
  poseOverheadTwo,
  readOverheadRig,
} from "./pose-overhead";
import { posePushUp, PUSH_UP, readPushUpRig } from "./pose-pushup";
import { FACE_PULL, poseFacePull, readFacePullRig } from "./pose-face-pull";
import { DUMBBELL_RDL, poseRdl, readRdlRig } from "./pose-rdl";
import { DUMBBELL_ROW, poseRow, readRowRig } from "./pose-row";
import { LATERAL_RAISE, poseRaise, readRaiseRig } from "./pose-raise";
import { PRESS_PINS, pressActivation, type PressExercise } from "./press";
import type { Phase } from "./squat";
import { DOWN_SHARE, repDepthAt, repTimeAt } from "./tempo";

// Alternating, depth is the moving arm's, `side`, and the other arm waits down.
export type PressState = {
  depth: number;
  playing: boolean;
  alternate: boolean;
  side: CurlSide;
};

type Props = {
  exercise: PressExercise;
  state: React.RefObject<PressState>;
  view: View;
  onPinMove: (
    id: string,
    x: number,
    y: number,
    visible: boolean,
    front: boolean,
  ) => void;
  onFrame: (depth: number, phase: Phase, side: CurlSide) => void;
};

const SPECS = {
  incline: INCLINE_PRESS,
  shoulder: SHOULDER_PRESS,
  hammer: HAMMER_CURL,
  raise: LATERAL_RAISE,
  squat: DUMBBELL_SQUAT,
  pulldown: LAT_PULLDOWN,
  pulldownNeutral: PULLDOWN_NEUTRAL,
  pulldownSingle: PULLDOWN_SINGLE,
  pushdown: ROPE_PUSHDOWN,
  pushup: PUSH_UP,
  overheadOne: OVERHEAD_ONE,
  overheadTwo: OVERHEAD_TWO,
  crunch: CRUNCH,
  row: DUMBBELL_ROW,
  rdl: DUMBBELL_RDL,
  facePull: FACE_PULL,
  legExtension: LEG_EXTENSION,
};
const REACH: Partial<Record<PressExercise, number>> = {
  raise: LATERAL_RAISE.cameraReach,
  pulldown: LAT_PULLDOWN.cameraReach,
  pulldownNeutral: PULLDOWN_NEUTRAL.cameraReach,
  pulldownSingle: PULLDOWN_SINGLE.cameraReach,
  pushdown: ROPE_PUSHDOWN.cameraReach,
  pushup: PUSH_UP.cameraReach,
  crunch: CRUNCH.cameraReach,
  row: DUMBBELL_ROW.cameraReach,
  rdl: DUMBBELL_RDL.cameraReach,
  facePull: FACE_PULL.cameraReach,
  legExtension: LEG_EXTENSION.cameraReach,
};
const ALONG = new THREE.Vector3(1, 0, 0);
const ALONG_CABLE = new THREE.Vector3(0, 1, 0);

// The rig, how it moves, and the bench if the lift has one.
type Held = {
  grip: THREE.Vector3;
  handle: THREE.Vector3;
  enter?: THREE.Vector3;
  end?: THREE.Vector3;
};
type Lift = {
  rig: Rig;
  pose: (
    left: number,
    right: number,
  ) => { l: Held; r: Held; bar?: THREE.Vector3; knot?: THREE.Vector3; pad?: THREE.Vector3; shinAngle?: number; pulley?: THREE.Vector3 };
  biceps: (depth: number) => number;
  triceps?: (depth: number) => number;
  bench: ReturnType<typeof benchLayout> | null;
  machine?: PulldownRig;
  grip?: PulldownGrip; // the pulldown's handle, if not the wide bar
  legMachine?: LegExtensionRig; // the leg extension machine, fitted to the body
  rope?: THREE.Vector3; // the pulley a rope hangs from
  bare?: boolean; // nothing held: the hands are on the floor
  one?: boolean; // one dumbbell, the right hand's
  pinSide?: "l" | "r"; // the arm the elbow and dumbbell pins sit on
  mat?: boolean;
  support?: THREE.Vector3; // where the free hand presses on a support box, for its top
};

function readLift(root: THREE.Object3D, exercise: PressExercise): Lift {
  if (exercise === "hammer") {
    const curl = readCurlRig(root);
    return {
      rig: curl.rig,
      pose: (left: number, right: number) => poseCurl(curl, left, right),
      biceps: bicepsBulge,
      bench: null,
    };
  }
  if (exercise === "raise") {
    const raise = readRaiseRig(root);
    return {
      rig: raise.rig,
      pose: (depth: number) => poseRaise(raise, depth),
      biceps: () => 0,
      bench: null,
    };
  }
  if (exercise === "rdl") {
    const rdl = readRdlRig(root);
    return {
      rig: rdl.rig,
      pose: (depth: number) => poseRdl(rdl, depth),
      biceps: () => 0,
      bench: null,
    };
  }
  if (exercise === "squat") {
    const squat = readDumbbellSquatRig(root);
    return {
      rig: squat.rig,
      pose: (depth: number) => poseDumbbellSquat(squat, depth),
      biceps: () => 0,
      bench: null,
    };
  }
  if (exercise === "pulldownNeutral" || exercise === "pulldownSingle") {
    const grip: PulldownGrip = exercise === "pulldownNeutral" ? "neutral" : "single";
    const pull = readPulldownVariantRig(root, grip);
    return {
      rig: pull.rig,
      pose: (depth: number) => posePulldownVariant(pull, depth),
      biceps: () => 0,
      bench: null,
      machine: pull,
      grip,
    };
  }
  if (exercise === "pulldown") {
    const pull = readPulldownRig(root);
    return {
      rig: pull.rig,
      pose: (depth: number) => posePulldown(pull, depth),
      biceps: () => 0,
      bench: null,
      machine: pull,
    };
  }
  if (exercise === "overheadOne" || exercise === "overheadTwo") {
    const o = readOverheadRig(root);
    if (exercise === "overheadTwo")
      return {
        rig: o.rig,
        pose: (depth: number) => poseOverheadTwo(o, depth),
        biceps: () => 0,
        bench: null,
        one: true,
      };
    return {
      rig: o.rig,
      pose: (depth: number) => {
        const g = poseOverheadOne(o, depth);
        return { l: g.r, r: g.r };
      },
      biceps: () => 0,
      bench: null,
      one: true,
      pinSide: "r",
    };
  }
  if (exercise === "row") {
    const row = readRowRig(root);
    const support = poseRow(row, 1).support.clone();
    return {
      rig: row.rig,
      pose: (depth: number) => {
        const { work } = poseRow(row, depth);
        return { l: work, r: work };
      },
      biceps: () => 0,
      bench: null,
      one: true,
      pinSide: "l",
      support,
    };
  }
  if (exercise === "pushup") {
    const push = readPushUpRig(root);
    return {
      rig: push.rig,
      pose: (depth: number) => posePushUp(push, depth),
      biceps: () => 0,
      bench: null,
      bare: true,
    };
  }
  if (exercise === "crunch") {
    const crunch = readCrunchRig(root);
    return {
      rig: crunch.rig,
      pose: (depth: number) => poseCrunch(crunch, depth),
      biceps: () => 0,
      bench: null,
      mat: true,
    };
  }
  if (exercise === "pushdown") {
    const push = readPushdownRig(root);
    return {
      rig: push.rig,
      pose: (depth: number) => posePushdown(push, depth),
      biceps: () => 0,
      triceps: tricepsGather,
      bench: null,
      rope: pushdownPulley(),
    };
  }
  if (exercise === "legExtension") {
    const ext = readLegExtensionRig(root);
    return {
      rig: ext.rig,
      pose: (depth: number) => poseLegExtension(ext, depth),
      biceps: () => 0,
      bench: null,
      legMachine: ext,
    };
  }
  if (exercise === "facePull") {
    const fp = readFacePullRig(root);
    return {
      rig: fp.rig,
      pose: (depth: number) => poseFacePull(fp, depth),
      biceps: () => 0,
      bench: null,
      rope: fp.pulley,
    };
  }
  const press = readPressRig(root, SPECS[exercise]);
  return {
    rig: press.rig,
    pose: (depth: number) => posePress(press, depth),
    biceps: () => 0,
    bench: benchLayout(press),
  };
}

export default memo(function PressScene(props: Props) {
  const target = useMemo(
    () => new THREE.Vector3(...SPECS[props.exercise].cameraTarget),
    [props.exercise],
  );
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [2.1, 1.1, 2.1], fov: 32, near: 0.1, far: 50 }}
      gl={{ antialias: true }}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#0c0c0e"]} />
      <hemisphereLight args={["#ffffff", "#2a2a2a", 1.1]} />
      <directionalLight position={[2, 4, 3]} intensity={2.2} />
      <directionalLight position={[-3, 2, -2]} intensity={0.8} />
      <Floor />
      <Presser {...props} />
      <CameraRig
        view={props.view}
        target={target}
        reach={REACH[props.exercise] ?? 0}
      />
    </Canvas>
  );
});

function Dumbbell({ inner }: { inner: React.RefObject<THREE.Group | null> }) {
  return (
    <group ref={inner}>
      <mesh rotation-z={Math.PI / 2}>
        <cylinderGeometry
          args={[
            DUMBBELL.handleRadius,
            DUMBBELL.handleRadius,
            DUMBBELL.handleLength,
            16,
          ]}
        />
        <meshStandardMaterial color="#9aa6ab" metalness={0.8} roughness={0.3} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position-x={side * DUMBBELL.headAt}
          rotation-z={Math.PI / 2}
        >
          <cylinderGeometry
            args={[
              DUMBBELL.headRadius,
              DUMBBELL.headRadius,
              DUMBBELL.headWidth,
              6,
            ]}
          />
          <meshStandardMaterial
            color="#3f4a4e"
            metalness={0.4}
            roughness={0.55}
          />
        </mesh>
      ))}
    </group>
  );
}

function Bench({ layout }: { layout: ReturnType<typeof benchLayout> }) {
  const padMat = <meshStandardMaterial color="#20292c" roughness={0.75} />;
  const frameMat = (
    <meshStandardMaterial color="#3a4548" metalness={0.5} roughness={0.5} />
  );
  const { pad, seat } = layout;
  const seatBottom = seat.position.y - seat.size[1] / 2;
  return (
    <group>
      <mesh position={pad.position} rotation-x={pad.rotationX}>
        <boxGeometry args={pad.size} />
        {padMat}
      </mesh>
      <mesh position={seat.position}>
        <boxGeometry args={seat.size} />
        {padMat}
      </mesh>
      {/* Post under the seat, a strut under the pad, and feet on the floor. */}
      <mesh position={[0, seatBottom / 2, 0.08]}>
        <boxGeometry args={[0.06, seatBottom, 0.06]} />
        {frameMat}
      </mesh>
      <mesh position={[0, (pad.position.y - 0.05) / 2, pad.position.z - 0.03]}>
        <boxGeometry args={[0.06, pad.position.y - 0.05, 0.06]} />
        {frameMat}
      </mesh>
      <mesh position={[0, 0.025, -0.1]}>
        <boxGeometry args={[0.06, 0.05, 1.05]} />
        {frameMat}
      </mesh>
      {[0.32, -0.56].map((z) => (
        <mesh key={z} position={[0, 0.02, z]}>
          <boxGeometry args={[0.42, 0.04, 0.06]} />
          {frameMat}
        </mesh>
      ))}
    </group>
  );
}

// The leg extension machine, fitted to the body: the seat, the back pad at the trunk's lean,
// the seat and back pad reclined together, a handle along each side of the seat at its height,
// and the lever turning about a pivot in line with the knees, with the
// pad across the front of the shins. The frame stands behind and under the seat, and the lever on
// the outside of the right leg, so the set views see the legs. The lever and pad move.
function LegExtensionMachine({
  machine,
  lever,
}: {
  machine: LegExtensionRig;
  lever: React.RefObject<THREE.Group | null>;
}) {
  const padMat = <meshStandardMaterial color="#20292c" roughness={0.75} />;
  const frameMat = (
    <meshStandardMaterial color="#3a4548" metalness={0.5} roughness={0.5} />
  );
  const P = LEG_EXTENSION;
  const seatThick = 0.08;
  const lean = ((P.lean + P.recline) * Math.PI) / 180;
  const recline = (P.recline * Math.PI) / 180;
  const seatBack = machine.backAt * Math.cos(lean) - 0.02;
  const seatFront = machine.seatFront;
  const seatMid = (seatBack + seatFront) / 2;
  const seatLength = (seatFront - seatBack) / Math.cos(recline);
  const seatWidth = 0.36; // barely wider than the legs, as the owner asked, so the handles and elbows stay in
  const backH = 0.62; // the back pad is narrower than the back (0.32 m across), so seen from behind it doesn't hide the arms (owner, 2026-11-12)
  const backThick = 0.07;
  // The back pad's middle: behind the hips along the trunk's front, up along its length.
  const chest = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(1, 0, 0), -lean);
  const up = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), -lean);
  const backMid = new THREE.Vector3(0, P.hipHeight, 0)
    .addScaledVector(chest, machine.backAt - backThick / 2)
    .addScaledVector(up, backH / 2 + 0.02);
  return (
    <group>
      <mesh
        position={[0, seatTopAt(machine, seatMid) - seatThick / 2 / Math.cos(recline), seatMid]}
        rotation-x={-recline}
      >
        <boxGeometry args={[seatWidth, seatThick, seatLength]} />
        {padMat}
      </mesh>
      <mesh position={backMid.toArray()} rotation-x={-lean}>
        <boxGeometry args={[0.24, backH, backThick]} />
        {padMat}
      </mesh>
      {/* Post under the seat, a foot along the floor, and the column behind the back pad. */}
      <mesh position={[0, (seatTopAt(machine, seatMid) - seatThick) / 2, seatMid]}>
        <boxGeometry args={[0.08, seatTopAt(machine, seatMid) - seatThick, 0.08]} />
        {frameMat}
      </mesh>
      <mesh position={[0, 0.025, (seatBack + machine.knee.z) / 2]}>
        <boxGeometry args={[0.08, 0.05, machine.knee.z - seatBack + 0.3]} />
        {frameMat}
      </mesh>
      {/* The handles beside the hips, each lying along the hole through the fist, on a short
          post down to the seat frame from its back end. */}
      {machine.handles.map((h, i) => {
        const tilt = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          h.dir.clone().normalize().multiplyScalar(h.dir.z < 0 ? -1 : 1),
        );
        const back = h.at
          .clone()
          .addScaledVector(h.dir.clone().normalize().multiplyScalar(h.dir.z < 0 ? -1 : 1), -P.handleLength / 2);
        const postH = back.y - (machine.seatY - seatThick);
        return (
          <group key={i}>
            <mesh position={h.at.toArray()} quaternion={tilt}>
              <cylinderGeometry args={[DUMBBELL.handleRadius, DUMBBELL.handleRadius, P.handleLength, 16]} />
              <meshStandardMaterial color="#9aa6ab" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[back.x, back.y - postH / 2, back.z]}>
              <boxGeometry args={[0.03, postH, 0.03]} />
              {frameMat}
            </mesh>
          </group>
        );
      })}
      {/* The pivot, outside the right knee and in line with it, on its own post. */}
      <mesh position={[-P.pivotOut, machine.knee.y / 2, machine.knee.z]}>
        <boxGeometry args={[0.06, machine.knee.y, 0.06]} />
        {frameMat}
      </mesh>
      <mesh position={[-P.pivotOut + 0.02, machine.knee.y, machine.knee.z]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.045, 0.045, 0.06, 24]} />
        {frameMat}
      </mesh>
      {/* The lever turns about the pivot; the pad hangs across the shins at its end. */}
      <group ref={lever}>
        <mesh name="arm">
          <boxGeometry args={[0.04, 1, 0.05]} />
          {frameMat}
        </mesh>
        <mesh name="pad" rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[P.padRadius, P.padRadius, P.padWidth, 20]} />
          {padMat}
        </mesh>
        <mesh name="rod" rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.015, 0.015, P.pivotOut - P.padWidth / 2 + 0.02, 12]} />
          {frameMat}
        </mesh>
      </group>
    </group>
  );
}

// The pulldown machine, fitted to the body: the seat, the pads over the thighs, and the
// cable from the pulley to the bar. Real machines have one column in front of the lifter,
// which would hide the body here, so two uprights stand wide of the bar and behind the
// seat, where none of the set views look through them. The bar and cable move.
function PulldownMachine({
  machine,
  bar,
  cable,
  grip,
}: {
  machine: PulldownRig;
  bar: React.RefObject<THREE.Group | null>;
  cable: React.RefObject<THREE.Mesh | null>;
  grip?: PulldownGrip;
}) {
  const pulleyX = 0; // every grip hangs from the pulley in the middle
  const steel = <meshStandardMaterial color="#9aa6ab" metalness={0.8} roughness={0.3} />;
  const padMat = <meshStandardMaterial color="#20292c" roughness={0.75} />;
  const frameMat = (
    <meshStandardMaterial color="#3a4548" metalness={0.5} roughness={0.5} />
  );
  const { padAhead, padRadius, pulleyHeight, pulleyAhead, barLength, stance } =
    LAT_PULLDOWN;
  const COLUMN = -0.38; // metres from the hips: behind them
  const WIDE = barLength / 2 + 0.16; // metres from the middle to each upright
  const seatThick = 0.08;
  return (
    <group>
      <mesh position={[0, machine.seatY - seatThick / 2, 0.02]}>
        <boxGeometry args={[0.36, seatThick, 0.36]} />
        {padMat}
      </mesh>
      {/* Post under the seat, and a rail along the floor from the uprights to the pads. */}
      <mesh position={[0, (machine.seatY - seatThick) / 2, 0.02]}>
        <boxGeometry args={[0.07, machine.seatY - seatThick, 0.07]} />
        {frameMat}
      </mesh>
      <mesh position={[0, 0.025, (padAhead + COLUMN) / 2]}>
        <boxGeometry args={[0.07, 0.05, padAhead - COLUMN]} />
        {frameMat}
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (stance + 0.02), machine.padY, padAhead]}
          rotation-z={Math.PI / 2}
        >
          <cylinderGeometry args={[padRadius, padRadius, 0.24, 20]} />
          {padMat}
        </mesh>
      ))}
      {/* The pads' post, up from the rail between the legs, and the bar joining them. */}
      <mesh position={[0, machine.padY / 2, padAhead]}>
        <boxGeometry args={[0.05, machine.padY, 0.05]} />
        {frameMat}
      </mesh>
      <mesh position={[0, machine.padY, padAhead]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.018, 0.018, 0.1, 12]} />
        {frameMat}
      </mesh>
      {/* The uprights, joined along the floor and overhead, see-through so they hide nothing. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * WIDE, pulleyHeight / 2 + 0.05, COLUMN]}
        >
          <boxGeometry args={[0.08, pulleyHeight + 0.1, 0.08]} />
          <FrameMat />
        </mesh>
      ))}
      <mesh position={[0, 0.025, COLUMN]}>
        <boxGeometry args={[WIDE * 2, 0.05, 0.08]} />
        <FrameMat />
      </mesh>
      <mesh position={[0, pulleyHeight + 0.06, COLUMN]}>
        <boxGeometry args={[WIDE * 2, 0.08, 0.08]} />
        <FrameMat />
      </mesh>
      {/* The beam out over the lifter, and the pulley under it. */}
      <mesh position={[pulleyX, pulleyHeight + 0.06, (pulleyAhead + COLUMN) / 2]}>
        <boxGeometry args={[0.08, 0.08, pulleyAhead - COLUMN + 0.08]} />
        <FrameMat />
      </mesh>
      <mesh
        position={[pulleyX, pulleyHeight - 0.01, pulleyAhead]}
        rotation-z={Math.PI / 2}
      >
        <cylinderGeometry args={[0.035, 0.035, 0.03, 20]} />
        {frameMat}
      </mesh>
      <mesh ref={cable}>
        <cylinderGeometry args={[0.004, 0.004, 1, 8]} />
        <meshStandardMaterial color="#c8ced1" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* The handle, turned each frame so its grips lie along the hands' (local z). */}
      <group ref={bar}>
        {grip === "neutral" ? (
          <>
            {[-1, 1].map((side) => (
              <mesh key={side} position-x={side * PULLDOWN_NEUTRAL.gripHalf} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[DUMBBELL.handleRadius, DUMBBELL.handleRadius, 0.13, 16]} />
                {steel}
              </mesh>
            ))}
            {/* The bridge joining the two grips over the hands, where the cable clips on. */}
            {[-1, 1].map((end) => (
              <mesh key={end} position={[0, 0.045, end * 0.065]} rotation-z={Math.PI / 2}>
                <cylinderGeometry args={[0.008, 0.008, PULLDOWN_NEUTRAL.gripHalf * 2, 10]} />
                {steel}
              </mesh>
            ))}
            {[-1, 1].flatMap((side) =>
              [-1, 1].map((end) => (
                <mesh key={`${side}${end}`} position={[side * PULLDOWN_NEUTRAL.gripHalf, 0.0225, end * 0.065]}>
                  <cylinderGeometry args={[0.008, 0.008, 0.045, 10]} />
                  {steel}
                </mesh>
              )),
            )}
          </>
        ) : grip === "single" ? (
          <>
            <mesh rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[DUMBBELL.handleRadius, DUMBBELL.handleRadius, 0.13, 16]} />
              {steel}
            </mesh>
            {/* The D-shaped loop over the grip, where the cable clips on. */}
            <mesh rotation-y={Math.PI / 2}>
              <torusGeometry args={[0.07, 0.007, 8, 24, Math.PI]} />
              {steel}
            </mesh>
          </>
        ) : (
          <mesh rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, barLength, 16]} />
            {steel}
          </mesh>
        )}
      </group>
    </group>
  );
}

// Machine frames stand round the body, so they let it show through from every view.
function FrameMat() {
  return (
    <meshStandardMaterial
      color="#3a4548"
      metalness={0.5}
      roughness={0.5}
      transparent
      opacity={0.22}
      depthWrite={false}
    />
  );
}

// The box the free hand presses on in the row, its top under the palm.
function SupportBox({ at }: { at: THREE.Vector3 }) {
  const SIZE = 0.4; // metres across and deep
  return (
    <mesh position={[at.x, at.y / 2, at.z - 0.04]}>
      <boxGeometry args={[SIZE, at.y, SIZE]} />
      <meshStandardMaterial color="#20292c" roughness={0.75} />
    </mesh>
  );
}

// The mat the crunch lies on.
function Mat() {
  const { matTop, matWidth, matLength } = CRUNCH;
  return (
    <mesh position={[0, matTop / 2, -0.1]}>
      <boxGeometry args={[matWidth, matTop, matLength]} />
      <meshStandardMaterial color="#1b2742" roughness={0.85} />
    </mesh>
  );
}

// Lay a unit-long cylinder from one point to another.
function span(
  mesh: THREE.Object3D | null | undefined,
  from: THREE.Vector3,
  to: THREE.Vector3,
) {
  if (!mesh) return;
  const run = to.clone().sub(from);
  mesh.position.copy(from).addScaledVector(run, 0.5);
  mesh.scale.set(1, run.length(), 1);
  mesh.quaternion.setFromUnitVectors(ALONG_CABLE, run.normalize());
}

// A cable tower with its rope. A real one's column stands in front of the lifter, which would
// hide the body, so two uprights stand wide of it with the pulley on a beam between them, as on
// a functional trainer. The cable, knot and two strands move.
function CableTower({
  rope,
  pulley,
}: {
  rope: React.RefObject<THREE.Group | null>;
  pulley: THREE.Vector3;
}) {
  const frameMat = <FrameMat />; // see-through: the uprights and beams stand in front of the body from some views
  const ropeMat = <meshStandardMaterial color="#14191b" roughness={0.9} />;
  const { ropeRadius, stopperRadius } = ROPE_PUSHDOWN; // the face pull's rope is the same
  const pulleyHeight = pulley.y;
  const pulleyAhead = pulley.z;
  const WIDE = 0.95; // metres from the middle to each upright: wide enough to stay out of the 45 degree view
  const BEHIND = 0.14; // metres the uprights stand beyond the pulley
  const z = pulleyAhead + BEHIND;
  const unit = <cylinderGeometry args={[ropeRadius, ropeRadius, 1, 10]} />;
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * WIDE, (pulleyHeight + 0.1) / 2, z]}>
          <boxGeometry args={[0.08, pulleyHeight + 0.1, 0.08]} />
          {frameMat}
        </mesh>
      ))}
      <mesh position={[0, 0.025, z]}>
        <boxGeometry args={[WIDE * 2, 0.05, 0.08]} />
        {frameMat}
      </mesh>
      <mesh position={[0, pulleyHeight + 0.06, z]}>
        <boxGeometry args={[WIDE * 2, 0.08, 0.08]} />
        {frameMat}
      </mesh>
      <mesh position={[0, pulleyHeight + 0.06, pulleyAhead + BEHIND / 2]}>
        <boxGeometry args={[0.08, 0.08, BEHIND]} />
        {frameMat}
      </mesh>
      <mesh position={[0, pulleyHeight, pulleyAhead]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.035, 0.035, 0.03, 20]} />
        {frameMat}
      </mesh>
      <group ref={rope}>
        <mesh name="cable">
          <cylinderGeometry args={[0.004, 0.004, 1, 8]} />
          <meshStandardMaterial
            color="#c8ced1"
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
        <mesh name="clip">
          <sphereGeometry args={[0.022, 12, 10]} />
          <meshStandardMaterial
            color="#9aa6ab"
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>
        {[0, 1].map((i) => (
          <group key={i}>
            <mesh name={`strand${i}`}>
              {unit}
              {ropeMat}
            </mesh>
            <mesh name={`through${i}`}>
              {unit}
              {ropeMat}
            </mesh>
            <mesh name={`stopper${i}`}>
              <sphereGeometry args={[stopperRadius, 12, 10]} />
              {ropeMat}
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function Presser({ exercise, state, onPinMove, onFrame }: Props) {
  const scene = useBody();
  const muscleMap = useMuscleMap();
  const body = useMemo(() => bodyMaterial(muscleMap), [muscleMap]);
  const lift = useMemo(() => {
    scene.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
        const m = o as THREE.SkinnedMesh;
        m.material = body.mat;
        m.frustumCulled = false;
      }
    });
    return readLift(scene, exercise);
  }, [scene, body, exercise]);

  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const barRef = useRef<THREE.Group>(null);
  const cableRef = useRef<THREE.Mesh>(null);
  const ropeRef = useRef<THREE.Group>(null);
  const leverRef = useRef<THREE.Group>(null);
  const clock = useRef({
    t: 0,
    depth: 0,
    wasPlaying: false,
    wasAlternate: false,
    lastReport: 0,
    phase: "down" as Phase,
    side: "l" as CurlSide,
  });
  const colors = useMemo(
    () => ({
      prime: new THREE.Color(ROLE_COLORS.prime),
      synergist: new THREE.Color(ROLE_COLORS.synergist),
      stabilizer: new THREE.Color(ROLE_COLORS.stabilizer),
    }),
    [],
  );

  useFrame(({ camera, size }, dt) => {
    const s = state.current;
    const c = clock.current;
    let depth = s.depth;
    if (!s.playing) c.side = s.side;
    if (s.playing) {
      // Resume the loop from wherever the slider left it.
      if (!c.wasPlaying || c.wasAlternate !== s.alternate) {
        c.t = s.alternate
          ? alternateTime(c.depth, c.side, PLAY_SECONDS)
          : repTimeAt(c.depth, PLAY_SECONDS, DOWN_SHARE[exercise]);
      }
      c.t += dt;
      if (s.alternate) {
        const at = alternateAt(c.t, PLAY_SECONDS);
        depth = at.depth;
        c.side = at.side;
      } else {
        depth = repDepthAt(c.t, PLAY_SECONDS, DOWN_SHARE[exercise]);
      }
    }
    c.wasPlaying = s.playing;
    c.wasAlternate = s.alternate;
    if (depth > c.depth + 1e-4) c.phase = "down";
    else if (depth < c.depth - 1e-4) c.phase = "up";
    c.depth = depth;

    const depthL = s.alternate && c.side === "r" ? 1 : depth;
    const depthR = s.alternate && c.side === "l" ? 1 : depth;
    const g = lift.pose(depthL, depthR);
    body.setBiceps(lift.biceps(depthL), lift.biceps(depthR));
    body.setTriceps(lift.triceps?.(depthL) ?? 0, lift.triceps?.(depthR) ?? 0);
    // The upper trapezius thickens on the side whose arm is overhead.
    const traps =
      exercise === "overheadOne" || exercise === "overheadTwo"
        ? SHOULDER_GIRDLE.trapsBulge
        : 0;
    body.setTraps(exercise === "overheadOne" ? 0 : traps, traps);
    left.current?.position.copy(g.l.grip);
    left.current?.quaternion.setFromUnitVectors(ALONG, g.l.handle);
    right.current?.position.copy(g.r.grip);
    right.current?.quaternion.setFromUnitVectors(ALONG, g.r.handle);
    if (g.bar) {
      barRef.current?.position.copy(g.bar);
      // A handle's grips lie along the hands' (local z), its loop toward the pulley (local y).
      if (lift.grip && barRef.current) {
        // Both grips of the neutral handle lie on one line: average the hands' and keep it square
        // across the body, so it can't twist to one side.
        const z = lift.grip === "neutral"
          ? g.l.handle.clone().normalize().add(g.r.handle.clone().normalize().multiplyScalar(Math.sign(g.l.handle.dot(g.r.handle)) || 1)).setX(0).normalize()
          : g.r.handle.clone().normalize();
        const y = (g.pulley?.clone() ?? pulleyAt()).sub(g.bar);
        y.addScaledVector(z, -y.dot(z)).normalize();
        barRef.current.quaternion.setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(y.clone().cross(z), y, z),
        );
      }
      // The cable runs from the pulley to the bar, at whatever slant that takes.
      // From the loop's top on a handle, from the bar's middle otherwise.
      const from = lift.grip === "single"
        ? g.bar.clone().addScaledVector((g.pulley?.clone() ?? pulleyAt()).sub(g.bar).normalize(), 0.07)
        : lift.grip === "neutral"
          ? g.bar.clone().addScaledVector((g.pulley?.clone() ?? pulleyAt()).sub(g.bar).normalize(), 0.045)
          : g.bar;
      const run = (g.pulley?.clone() ?? pulleyAt()).sub(from);
      cableRef.current?.position.copy(from).addScaledVector(run, 0.5);
      cableRef.current?.scale.set(1, run.length(), 1);
      cableRef.current?.quaternion.setFromUnitVectors(
        ALONG_CABLE,
        run.normalize(),
      );
    }
    if (g.pad && lift.legMachine && leverRef.current) {
      // The lever runs from the pivot to the pad, outside the right leg; the pad lies across.
      const pivot = lift.legMachine.knee
        .clone()
        .setX(-LEG_EXTENSION.pivotOut + 0.02);
      const end = g.pad.clone().setX(pivot.x);
      const part = (name: string) => leverRef.current?.getObjectByName(name);
      span(part("arm"), pivot, end);
      part("pad")?.position.copy(g.pad);
      const rod = part("rod");
      rod?.position.set(
        (pivot.x - LEG_EXTENSION.padWidth / 2) / 2,
        g.pad.y,
        g.pad.z,
      );
    }
    if (g.knot) {
      const part = (name: string) => ropeRef.current?.getObjectByName(name);
      span(part("cable"), g.knot, lift.rope!);
      part("clip")?.position.copy(g.knot);
      [g.l, g.r].forEach((hand, i) => {
        span(part(`strand${i}`), g.knot!, hand.enter!);
        span(part(`through${i}`), hand.enter!, hand.end!);
        part(`stopper${i}`)?.position.copy(hand.end!);
      });
    }

    body.clear();
    for (const act of pressActivation(exercise, depth, c.phase)) {
      body.setRegion(
        REGION_IDS[act.region],
        colors[act.role],
        (0.2 + 0.8 * act.amount) * ROLE_STRENGTH[act.role],
      );
    }

    const { rig } = lift;
    const chestFront = new THREE.Vector3(0, 0, 1).applyQuaternion(
      worldQuat(rig.spine3).multiply(rig.spine3Rest.clone().invert()),
    );
    const arm = rig[lift.pinSide ?? "l"];
    const overhead = exercise === "overheadOne" || exercise === "overheadTwo";
    const row = exercise === "row";
    const facePull = exercise === "facePull";
    const legExt = exercise === "legExtension";
    const at: Record<(typeof PRESS_PINS)[number], THREE.Vector3> = {
      feet: legExt && g.pad
        ? g.pad.clone().add(new THREE.Vector3(0.06, 0.05, 0.04)) // on the shin pad
        : worldPos(rig.l.ball).setY(0.03),
      back: worldPos(rig.spine3).addScaledVector(chestFront, -0.14),
      elbow: legExt
        ? worldPos(rig.l.calf).add(new THREE.Vector3(0.09, 0, 0)) // beside the knee, in line with the pivot
        : overhead
        ? worldPos(arm.lowerarm).add(
            new THREE.Vector3(arm.sign * 0.06, 0.03, 0.03),
          ) // out beside the raised elbow
        : row || facePull
          ? worldPos(arm.lowerarm).add(
              new THREE.Vector3(arm.sign * 0.06, 0.04, -0.02),
            ) // out beside the rowing elbow
          : worldPos(rig.l.lowerarm).add(
              new THREE.Vector3(0.04, -0.03, exercise === "hammer" ? -0.09 : 0),
            ), // behind the elbow in a curl, clear of its crease
      dumbbell: legExt
        ? g.l.grip.clone().add(new THREE.Vector3(0.06, 0.06, 0)) // by the left handle
        : facePull
        ? g.l.grip.clone().add(new THREE.Vector3(0.08, 0.06, 0)) // outside the hand, clear of the head
        : row
        ? g.l.grip.clone().add(new THREE.Vector3(arm.sign * 0.12, 0, 0))
        : overhead
          ? g.l.grip.clone().add(new THREE.Vector3(arm.sign * 0.1, 0.1, 0))
          : g.l.grip
              .clone()
              .add(
                exercise === "raise" ||
                  exercise === "squat" ||
                  exercise === "rdl" ||
                  exercise === "pulldown" ||
                  exercise === "pulldownNeutral" ||
                  exercise === "pulldownSingle" ||
                  exercise === "pushdown" ||
                  exercise === "pushup" ||
                  exercise === "crunch"
                  ? new THREE.Vector3(-0.02, 0.12, 0)
                  : new THREE.Vector3(0.1, 0.08, 0),
              ), // above the hand with the arms out: outside it would leave the frame
      core: legExt
        ? worldPos(rig.l.thigh).lerp(worldPos(rig.l.calf), 0.5).add(new THREE.Vector3(0, 0.08, 0)) // on the front of the thigh
        : worldPos(rig.spine1).addScaledVector(chestFront, 0.16),
    };
    // A pin turns see-through where it sits over the body, so the body stays in view.
    const over = overBody(
      rig,
      camera as THREE.PerspectiveCamera,
      PRESS_PINS.map((id) => at[id]),
      PIN_RADIUS,
      size.height,
    );
    PRESS_PINS.forEach((id, i) => {
      const v = at[id].clone().project(camera);
      onPinMove(
        id,
        ((v.x + 1) / 2) * size.width,
        ((1 - v.y) / 2) * size.height,
        v.z < 1,
        !over[i],
      );
    });

    const now = performance.now();
    if (now - c.lastReport > 90) {
      c.lastReport = now;
      onFrame(depth, c.phase, c.side);
    }
  });

  return (
    <group>
      <primitive object={scene} />
      {lift.bench && <Bench layout={lift.bench} />}
      {lift.support && <SupportBox at={lift.support} />}
      {lift.bare ? null : lift.mat ? (
        <Mat />
      ) : lift.rope ? (
        <CableTower rope={ropeRef} pulley={lift.rope} />
      ) : lift.legMachine ? (
        <LegExtensionMachine machine={lift.legMachine} lever={leverRef} />
      ) : lift.machine ? (
        <PulldownMachine machine={lift.machine} bar={barRef} cable={cableRef} grip={lift.grip} />
      ) : (
        <>
          {!lift.one && <Dumbbell inner={left} />}
          <Dumbbell inner={right} />
        </>
      )}
    </group>
  );
}
