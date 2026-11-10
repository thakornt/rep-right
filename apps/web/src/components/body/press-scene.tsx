"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { memo, useMemo, useRef } from "react";
import * as THREE from "three";

import { bodyMaterial, CameraRig, Floor, PLAY_SECONDS, useBody, useMuscleMap, type View } from "./body-scene";
import { REGION_IDS, ROLE_COLORS, ROLE_STRENGTH } from "./muscles";
import { overBody, PIN_RADIUS } from "./pin-cover";
import { BAR_RADIUS, worldPos, worldQuat, type Rig } from "./pose";
import { alternateAt, alternateTime, bicepsBulge, HAMMER_CURL, poseCurl, readCurlRig, type CurlSide } from "./pose-curl";
import { DUMBBELL_SQUAT, poseDumbbellSquat, readDumbbellSquatRig } from "./pose-dumbbell-squat";
import { CRUNCH, poseCrunch, readCrunchRig } from "./pose-crunch";
import { LAT_PULLDOWN, posePulldown, pulleyAt, readPulldownRig, type PulldownRig } from "./pose-pulldown";
import { benchLayout, DUMBBELL, INCLINE_PRESS, posePress, readPressRig, SHOULDER_PRESS } from "./pose-press";
import { posePushdown, pushdownPulley, readPushdownRig, ROPE_PUSHDOWN, tricepsGather } from "./pose-pushdown";
import { OVERHEAD_ONE, OVERHEAD_TWO, SHOULDER_GIRDLE, poseOverheadOne, poseOverheadTwo, readOverheadRig } from "./pose-overhead";
import { posePushUp, PUSH_UP, readPushUpRig } from "./pose-pushup";
import { LATERAL_RAISE, poseRaise, readRaiseRig } from "./pose-raise";
import { PRESS_PINS, pressActivation, type PressExercise } from "./press";
import type { Phase } from "./squat";
import { DOWN_SHARE, repDepthAt, repTimeAt } from "./tempo";

// Alternating, depth is the moving arm's, `side`, and the other arm waits down.
export type PressState = { depth: number; playing: boolean; alternate: boolean; side: CurlSide };

type Props = {
  exercise: PressExercise;
  state: React.RefObject<PressState>;
  view: View;
  onPinMove: (id: string, x: number, y: number, visible: boolean, front: boolean) => void;
  onFrame: (depth: number, phase: Phase, side: CurlSide) => void;
};

const SPECS = { incline: INCLINE_PRESS, shoulder: SHOULDER_PRESS, hammer: HAMMER_CURL, raise: LATERAL_RAISE, squat: DUMBBELL_SQUAT, pulldown: LAT_PULLDOWN, pushdown: ROPE_PUSHDOWN, pushup: PUSH_UP, overheadOne: OVERHEAD_ONE, overheadTwo: OVERHEAD_TWO, crunch: CRUNCH };
const REACH: Partial<Record<PressExercise, number>> = { raise: LATERAL_RAISE.cameraReach, pulldown: LAT_PULLDOWN.cameraReach, pushdown: ROPE_PUSHDOWN.cameraReach, pushup: PUSH_UP.cameraReach, crunch: CRUNCH.cameraReach };
const ALONG = new THREE.Vector3(1, 0, 0);
const ALONG_CABLE = new THREE.Vector3(0, 1, 0);

// The rig, how it moves, and the bench if the lift has one.
type Held = { grip: THREE.Vector3; handle: THREE.Vector3; enter?: THREE.Vector3; end?: THREE.Vector3 };
type Lift = {
  rig: Rig;
  pose: (left: number, right: number) => { l: Held; r: Held; bar?: THREE.Vector3; knot?: THREE.Vector3 };
  biceps: (depth: number) => number;
  triceps?: (depth: number) => number;
  bench: ReturnType<typeof benchLayout> | null;
  machine?: PulldownRig;
  rope?: boolean;
  bare?: boolean; // nothing held: the hands are on the floor
  one?: boolean; // one dumbbell, the right hand's
  pinSide?: "l" | "r"; // the arm the elbow and dumbbell pins sit on
  mat?: boolean;
};

function readLift(root: THREE.Object3D, exercise: PressExercise): Lift {
  if (exercise === "hammer") {
    const curl = readCurlRig(root);
    return { rig: curl.rig, pose: (left: number, right: number) => poseCurl(curl, left, right), biceps: bicepsBulge, bench: null };
  }
  if (exercise === "raise") {
    const raise = readRaiseRig(root);
    return { rig: raise.rig, pose: (depth: number) => poseRaise(raise, depth), biceps: () => 0, bench: null };
  }
  if (exercise === "squat") {
    const squat = readDumbbellSquatRig(root);
    return { rig: squat.rig, pose: (depth: number) => poseDumbbellSquat(squat, depth), biceps: () => 0, bench: null };
  }
  if (exercise === "pulldown") {
    const pull = readPulldownRig(root);
    return { rig: pull.rig, pose: (depth: number) => posePulldown(pull, depth), biceps: () => 0, bench: null, machine: pull };
  }
  if (exercise === "overheadOne" || exercise === "overheadTwo") {
    const o = readOverheadRig(root);
    if (exercise === "overheadTwo") return { rig: o.rig, pose: (depth: number) => poseOverheadTwo(o, depth), biceps: () => 0, bench: null, one: true };
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
  if (exercise === "pushup") {
    const push = readPushUpRig(root);
    return { rig: push.rig, pose: (depth: number) => posePushUp(push, depth), biceps: () => 0, bench: null, bare: true };
  }
  if (exercise === "crunch") {
    const crunch = readCrunchRig(root);
    return { rig: crunch.rig, pose: (depth: number) => poseCrunch(crunch, depth), biceps: () => 0, bench: null, mat: true };
  }
  if (exercise === "pushdown") {
    const push = readPushdownRig(root);
    return { rig: push.rig, pose: (depth: number) => posePushdown(push, depth), biceps: () => 0, triceps: tricepsGather, bench: null, rope: true };
  }
  const press = readPressRig(root, SPECS[exercise]);
  return { rig: press.rig, pose: (depth: number) => posePress(press, depth), biceps: () => 0, bench: benchLayout(press) };
}

export default memo(function PressScene(props: Props) {
  const target = useMemo(() => new THREE.Vector3(...SPECS[props.exercise].cameraTarget), [props.exercise]);
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [2.1, 1.1, 2.1], fov: 32, near: 0.1, far: 50 }}
      gl={{ antialias: true }}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#0b1222"]} />
      <hemisphereLight args={["#ffffff", "#2a2a2a", 1.1]} />
      <directionalLight position={[2, 4, 3]} intensity={2.2} />
      <directionalLight position={[-3, 2, -2]} intensity={0.8} />
      <Floor />
      <Presser {...props} />
      <CameraRig view={props.view} target={target} reach={REACH[props.exercise] ?? 0} />
    </Canvas>
  );
});

function Dumbbell({ inner }: { inner: React.RefObject<THREE.Group | null> }) {
  return (
    <group ref={inner}>
      <mesh rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[DUMBBELL.handleRadius, DUMBBELL.handleRadius, DUMBBELL.handleLength, 16]} />
        <meshStandardMaterial color="#9aa6ab" metalness={0.8} roughness={0.3} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position-x={side * DUMBBELL.headAt} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[DUMBBELL.headRadius, DUMBBELL.headRadius, DUMBBELL.headWidth, 6]} />
          <meshStandardMaterial color="#3f4a4e" metalness={0.4} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function Bench({ layout }: { layout: ReturnType<typeof benchLayout> }) {
  const padMat = <meshStandardMaterial color="#20292c" roughness={0.75} />;
  const frameMat = <meshStandardMaterial color="#3a4548" metalness={0.5} roughness={0.5} />;
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

// The pulldown machine, fitted to the body: the seat, the pads over the thighs, and the
// cable from the pulley to the bar. Real machines have one column in front of the lifter,
// which would hide the body here, so two uprights stand wide of the bar and behind the
// seat, where none of the set views look through them. The bar and cable move.
function PulldownMachine({ machine, bar, cable }: { machine: PulldownRig; bar: React.RefObject<THREE.Group | null>; cable: React.RefObject<THREE.Mesh | null> }) {
  const padMat = <meshStandardMaterial color="#20292c" roughness={0.75} />;
  const frameMat = <meshStandardMaterial color="#3a4548" metalness={0.5} roughness={0.5} />;
  const { padAhead, padRadius, pulleyHeight, pulleyAhead, barLength, stance } = LAT_PULLDOWN;
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
        <mesh key={side} position={[side * (stance + 0.02), machine.padY, padAhead]} rotation-z={Math.PI / 2}>
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
        <mesh key={side} position={[side * WIDE, pulleyHeight / 2 + 0.05, COLUMN]}>
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
      <mesh position={[0, pulleyHeight + 0.06, (pulleyAhead + COLUMN) / 2]}>
        <boxGeometry args={[0.08, 0.08, pulleyAhead - COLUMN + 0.08]} />
        <FrameMat />
      </mesh>
      <mesh position={[0, pulleyHeight - 0.01, pulleyAhead]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.035, 0.035, 0.03, 20]} />
        {frameMat}
      </mesh>
      <mesh ref={cable}>
        <cylinderGeometry args={[0.004, 0.004, 1, 8]} />
        <meshStandardMaterial color="#c8ced1" metalness={0.6} roughness={0.4} />
      </mesh>
      <group ref={bar}>
        <mesh rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, barLength, 16]} />
          <meshStandardMaterial color="#9aa6ab" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

// Machine frames stand round the body, so they let it show through from every view.
function FrameMat() {
  return <meshStandardMaterial color="#3a4548" metalness={0.5} roughness={0.5} transparent opacity={0.22} depthWrite={false} />;
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
function span(mesh: THREE.Object3D | null | undefined, from: THREE.Vector3, to: THREE.Vector3) {
  if (!mesh) return;
  const run = to.clone().sub(from);
  mesh.position.copy(from).addScaledVector(run, 0.5);
  mesh.scale.set(1, run.length(), 1);
  mesh.quaternion.setFromUnitVectors(ALONG_CABLE, run.normalize());
}

// A cable tower with its rope. A real one's column stands in front of the lifter, which would
// hide the body, so two uprights stand wide of it with the pulley on a beam between them, as on
// a functional trainer. The cable, knot and two strands move.
function CableTower({ rope }: { rope: React.RefObject<THREE.Group | null> }) {
  const frameMat = <FrameMat />; // see-through: the uprights and beams stand in front of the body from some views
  const ropeMat = <meshStandardMaterial color="#14191b" roughness={0.9} />;
  const { pulleyHeight, pulleyAhead, ropeRadius, stopperRadius } = ROPE_PUSHDOWN;
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
          <meshStandardMaterial color="#c8ced1" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh name="clip">
          <sphereGeometry args={[0.022, 12, 10]} />
          <meshStandardMaterial color="#9aa6ab" metalness={0.8} roughness={0.3} />
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
  const clock = useRef({ t: 0, depth: 0, wasPlaying: false, wasAlternate: false, lastReport: 0, phase: "down" as Phase, side: "l" as CurlSide });
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
        c.t = s.alternate ? alternateTime(c.depth, c.side, PLAY_SECONDS) : repTimeAt(c.depth, PLAY_SECONDS, DOWN_SHARE[exercise]);
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
    const traps = exercise === "overheadOne" || exercise === "overheadTwo" ? SHOULDER_GIRDLE.trapsBulge : 0;
    body.setTraps(exercise === "overheadOne" ? 0 : traps, traps);
    left.current?.position.copy(g.l.grip);
    left.current?.quaternion.setFromUnitVectors(ALONG, g.l.handle);
    right.current?.position.copy(g.r.grip);
    right.current?.quaternion.setFromUnitVectors(ALONG, g.r.handle);
    if (g.bar) {
      barRef.current?.position.copy(g.bar);
      // The cable runs from the pulley to the bar, at whatever slant that takes.
      const run = pulleyAt().sub(g.bar);
      cableRef.current?.position.copy(g.bar).addScaledVector(run, 0.5);
      cableRef.current?.scale.set(1, run.length(), 1);
      cableRef.current?.quaternion.setFromUnitVectors(ALONG_CABLE, run.normalize());
    }
    if (g.knot) {
      const part = (name: string) => ropeRef.current?.getObjectByName(name);
      span(part("cable"), g.knot, pushdownPulley());
      part("clip")?.position.copy(g.knot);
      [g.l, g.r].forEach((hand, i) => {
        span(part(`strand${i}`), g.knot!, hand.enter!);
        span(part(`through${i}`), hand.enter!, hand.end!);
        part(`stopper${i}`)?.position.copy(hand.end!);
      });
    }

    body.clear();
    for (const act of pressActivation(exercise, depth, c.phase)) {
      body.setRegion(REGION_IDS[act.region], colors[act.role], (0.2 + 0.8 * act.amount) * ROLE_STRENGTH[act.role]);
    }

    const { rig } = lift;
    const chestFront = new THREE.Vector3(0, 0, 1).applyQuaternion(
      worldQuat(rig.spine3).multiply(rig.spine3Rest.clone().invert()),
    );
    const arm = rig[lift.pinSide ?? "l"];
    const overhead = exercise === "overheadOne" || exercise === "overheadTwo";
    const at: Record<(typeof PRESS_PINS)[number], THREE.Vector3> = {
      feet: worldPos(rig.l.ball).setY(0.03),
      back: worldPos(rig.spine3).addScaledVector(chestFront, -0.14),
      elbow: overhead
        ? worldPos(arm.lowerarm).add(new THREE.Vector3(arm.sign * 0.06, 0.03, 0.03)) // out beside the raised elbow
        : worldPos(rig.l.lowerarm).add(new THREE.Vector3(0.04, -0.03, exercise === "hammer" ? -0.09 : 0)), // behind the elbow in a curl, clear of its crease
      dumbbell: overhead ? g.l.grip.clone().add(new THREE.Vector3(arm.sign * 0.1, 0.1, 0)) : g.l.grip.clone().add(exercise === "raise" || exercise === "squat" || exercise === "pulldown" || exercise === "pushdown" || exercise === "pushup" || exercise === "crunch" ? new THREE.Vector3(-0.02, 0.12, 0) : new THREE.Vector3(0.1, 0.08, 0)), // above the hand with the arms out: outside it would leave the frame
      core: worldPos(rig.spine1).addScaledVector(chestFront, 0.16),
    };
    // A pin turns see-through where it sits over the body, so the body stays in view.
    const over = overBody(rig, camera as THREE.PerspectiveCamera, PRESS_PINS.map((id) => at[id]), PIN_RADIUS, size.height);
    PRESS_PINS.forEach((id, i) => {
      const v = at[id].clone().project(camera);
      onPinMove(id, ((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height, v.z < 1, !over[i]);
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
      {lift.bare ? null : lift.mat ? (
        <Mat />
      ) : lift.rope ? (
        <CableTower rope={ropeRef} />
      ) : lift.machine ? (
        <PulldownMachine machine={lift.machine} bar={barRef} cable={cableRef} />
      ) : (
        <>
          {!lift.one && <Dumbbell inner={left} />}
          <Dumbbell inner={right} />
        </>
      )}
    </group>
  );
}
