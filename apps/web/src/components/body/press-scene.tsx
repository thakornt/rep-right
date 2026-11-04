"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { memo, useMemo, useRef } from "react";
import * as THREE from "three";

import { bodyMaterial, CameraRig, Floor, PLAY_SECONDS, useBody, useMuscleMap, type View } from "./body-scene";
import { REGION_IDS, ROLE_COLORS, ROLE_STRENGTH } from "./muscles";
import { worldPos, worldQuat } from "./pose";
import { benchLayout, DUMBBELL, INCLINE_PRESS, posePress, readPressRig, SHOULDER_PRESS } from "./pose-press";
import { PRESS_PINS, pressActivation, type PressExercise } from "./press";
import type { Phase } from "./squat";

export type PressState = { depth: number; playing: boolean };

type Props = {
  exercise: PressExercise;
  state: React.RefObject<PressState>;
  view: View;
  onPinMove: (id: string, x: number, y: number, visible: boolean, front: boolean) => void;
  onFrame: (depth: number, phase: Phase) => void;
};

const SPECS = { incline: INCLINE_PRESS, shoulder: SHOULDER_PRESS };
const ALONG = new THREE.Vector3(1, 0, 0);

export default memo(function PressScene(props: Props) {
  const target = useMemo(() => new THREE.Vector3(...SPECS[props.exercise].cameraTarget), [props.exercise]);
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [2.1, 1.1, 2.1], fov: 32, near: 0.1, far: 50 }}
      gl={{ antialias: true }}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#0c1518"]} />
      <hemisphereLight args={["#ffffff", "#2a2a2a", 1.1]} />
      <directionalLight position={[2, 4, 3]} intensity={2.2} />
      <directionalLight position={[-3, 2, -2]} intensity={0.8} />
      <Floor />
      <Presser {...props} />
      <CameraRig view={props.view} target={target} />
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

function Presser({ exercise, state, onPinMove, onFrame }: Props) {
  const scene = useBody();
  const muscleMap = useMuscleMap();
  const body = useMemo(() => bodyMaterial(muscleMap), [muscleMap]);
  const press = useMemo(() => {
    scene.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
        const m = o as THREE.SkinnedMesh;
        m.material = body.mat;
        m.frustumCulled = false;
      }
    });
    return readPressRig(scene, SPECS[exercise]);
  }, [scene, body, exercise]);
  const layout = useMemo(() => benchLayout(press), [press]);

  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const clock = useRef({ t: 0, depth: 0, wasPlaying: false, lastReport: 0, phase: "down" as Phase });
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
    if (s.playing) {
      // Resume the loop from wherever the slider left it.
      if (!c.wasPlaying) c.t = (Math.acos(1 - 2 * c.depth) / (Math.PI * 2)) * PLAY_SECONDS;
      c.t += dt;
      depth = (1 - Math.cos((c.t / PLAY_SECONDS) * Math.PI * 2)) / 2;
    }
    c.wasPlaying = s.playing;
    if (depth > c.depth + 1e-4) c.phase = "down";
    else if (depth < c.depth - 1e-4) c.phase = "up";
    c.depth = depth;

    const g = posePress(press, depth);
    left.current?.position.copy(g.l.grip);
    left.current?.quaternion.setFromUnitVectors(ALONG, g.l.handle);
    right.current?.position.copy(g.r.grip);
    right.current?.quaternion.setFromUnitVectors(ALONG, g.r.handle);

    body.clear();
    for (const act of pressActivation(exercise, depth, c.phase)) {
      body.setRegion(REGION_IDS[act.region], colors[act.role], (0.2 + 0.8 * act.amount) * ROLE_STRENGTH[act.role]);
    }

    const { rig } = press;
    const chestFront = new THREE.Vector3(0, 0, 1).applyQuaternion(
      worldQuat(rig.spine3).multiply(rig.spine3Rest.clone().invert()),
    );
    const at: Record<(typeof PRESS_PINS)[number], THREE.Vector3> = {
      feet: worldPos(rig.l.ball).setY(0.03),
      back: worldPos(rig.spine3).addScaledVector(chestFront, -0.14),
      elbow: worldPos(rig.l.lowerarm).add(new THREE.Vector3(0.04, -0.03, 0)),
      dumbbell: g.l.grip.clone().add(new THREE.Vector3(0.1, 0.08, 0)),
      core: worldPos(rig.spine1).addScaledVector(chestFront, 0.16),
    };
    const facing: Record<(typeof PRESS_PINS)[number], THREE.Vector3> = {
      feet: new THREE.Vector3(0, 0.5, 1),
      back: chestFront.clone().negate(),
      elbow: new THREE.Vector3(1, 0, 0),
      dumbbell: new THREE.Vector3(0, 1, 1),
      core: chestFront,
    };
    for (const id of PRESS_PINS) {
      const toCamera = camera.position.clone().sub(at[id]);
      const front = facing[id].dot(toCamera) > 0;
      const v = at[id].clone().project(camera);
      onPinMove(id, ((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height, v.z < 1, front);
    }

    const now = performance.now();
    if (now - c.lastReport > 90) {
      c.lastReport = now;
      onFrame(depth, c.phase);
    }
  });

  return (
    <group>
      <primitive object={scene} />
      <Bench layout={layout} />
      <Dumbbell inner={left} />
      <Dumbbell inner={right} />
    </group>
  );
}
