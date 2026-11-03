"use client";

import { OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import grips from "./grips.json";
import { REGION_COUNT, REGION_IDS, ROLE_COLORS } from "./muscles";
import {
  balancedLean,
  hipFromAnkle,
  legAngles,
  squatActivation,
  SQUAT_PINS,
  type Phase,
  type SquatFaults,
} from "./squat";

const MODEL = "/models/body.glb";

export type View = "side" | "front" | "back" | "angle";

// Shared with the controls outside the canvas; read every frame so dragging
// the slider or playing does not re-render React.
export type SquatState = {
  depth: number;
  playing: boolean;
  faults: SquatFaults;
};

type Props = {
  state: React.RefObject<SquatState>;
  view: View;
  // Pin buttons live in the DOM over the canvas; the scene reports where each
  // one should be, in CSS pixels from the canvas's top-left corner.
  onPinMove: (id: string, x: number, y: number, visible: boolean, front: boolean) => void;
  onFrame: (depth: number, phase: Phase) => void;
};

// Memoised: the controls re-render ~10 times a second while playing.
export default memo(function BodyScene(props: Props) {
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
      <Squatter {...props} />
      <CameraRig view={props.view} />
    </Canvas>
  );
});

function Floor() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.001}>
        <circleGeometry args={[1.4, 64]} />
        <meshStandardMaterial color="#111b1f" roughness={1} />
      </mesh>
      <gridHelper args={[2.8, 14, "#1f2f34", "#182529"]} position-y={0} />
    </group>
  );
}

const CAMERA: Record<View, [number, number, number]> = {
  side: [3, 0.9, 0],
  front: [0, 0.9, 3],
  back: [0, 0.9, -3],
  angle: [2.1, 1.1, 2.1],
};
const TARGET = new THREE.Vector3(0, 0.75, 0);

function CameraRig({ view }: { view: View }) {
  const camera = useThree((s) => s.camera);
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const goal = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    goal.current = new THREE.Vector3(...CAMERA[view]);
  }, [view]);

  useFrame(() => {
    if (!goal.current) return;
    camera.position.lerp(goal.current, 0.14);
    controls.current?.target.lerp(TARGET, 0.14);
    controls.current?.update();
    if (camera.position.distanceTo(goal.current) < 0.01) goal.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      target={TARGET}
      enablePan={false}
      minDistance={0.9}
      maxDistance={6}
      maxPolarAngle={Math.PI * 0.62}
      onStart={() => (goal.current = null)}
    />
  );
}

// ---------- body material ----------

function bodyMaterial() {
  const tints = Array.from({ length: REGION_COUNT }, () => new THREE.Vector3());
  const amounts = new Array<number>(REGION_COUNT).fill(0);
  const mat = new THREE.MeshStandardMaterial({ color: "#b9b2ab", roughness: 0.62 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTint = { value: tints };
    shader.uniforms.uAmt = { value: amounts };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute float _muscle;
        attribute float _cloth;
        uniform vec3 uTint[${REGION_COUNT}];
        uniform float uAmt[${REGION_COUNT}];
        varying vec3 vTintAmt;
        varying float vAmt;
        varying float vCloth;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        int mi = int(_muscle + 0.5);
        vAmt = uAmt[mi];
        vTintAmt = uTint[mi] * vAmt;
        vCloth = _cloth;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vTintAmt;
        varying float vAmt;
        varying float vCloth;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec3 base = vCloth > 1.5 ? vec3(0.05, 0.06, 0.07) : vCloth > 0.5 ? vec3(0.07, 0.1, 0.12) : diffuseColor.rgb;
        // vTintAmt is premultiplied so region borders fade instead of darkening.
        vec3 tint = vTintAmt / max(vAmt, 0.001);
        diffuseColor.rgb = mix(base, tint, clamp(vAmt, 0.0, 1.0) * 0.92);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vTintAmt * 0.22;`,
      );
  };
  return {
    mat,
    clear: () => amounts.fill(0),
    setRegion: (i: number, color: THREE.Color, amount: number) => {
      tints[i].set(color.r, color.g, color.b);
      amounts[i] = amount;
    },
  };
}

// ---------- posing ----------

const X = new THREE.Vector3(1, 0, 0);
const qx = (rad: number) => new THREE.Quaternion().setFromAxisAngle(X, rad);
const deg = (d: number) => (d * Math.PI) / 180;

const worldPos = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
const worldQuat = (o: THREE.Object3D) => o.getWorldQuaternion(new THREE.Quaternion());

function rotateWorld(bone: THREE.Object3D, q: THREE.Quaternion) {
  const parentQ = worldQuat(bone.parent!).invert();
  bone.quaternion.copy(parentQ.multiply(q.clone().multiply(worldQuat(bone))));
  bone.updateMatrixWorld(true);
}

function setWorldQuat(bone: THREE.Object3D, q: THREE.Quaternion) {
  bone.quaternion.copy(worldQuat(bone.parent!).invert().multiply(q));
  bone.updateMatrixWorld(true);
}

function setWorldPos(bone: THREE.Object3D, p: THREE.Vector3) {
  bone.position.copy(bone.parent!.worldToLocal(p.clone()));
  bone.updateMatrixWorld(true);
}

// Turn `bone` so its child points at `target`.
function aim(bone: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3) {
  const b = worldPos(bone);
  const from = worldPos(child).sub(b).normalize();
  const to = target.clone().sub(b).normalize();
  rotateWorld(bone, new THREE.Quaternion().setFromUnitVectors(from, to));
}

// Two-bone IK: upper -> lower -> end reaches target, bending toward hint.
function twoBoneIK(
  upper: THREE.Object3D,
  lower: THREE.Object3D,
  end: THREE.Object3D,
  lenA: number,
  lenB: number,
  target: THREE.Vector3,
  hint: THREE.Vector3,
) {
  const a = worldPos(upper);
  const toTarget = target.clone().sub(a);
  const d = THREE.MathUtils.clamp(toTarget.length(), Math.abs(lenA - lenB) + 1e-3, lenA + lenB - 1e-4);
  const n = toTarget.normalize();
  const cosA = (lenA * lenA + d * d - lenB * lenB) / (2 * lenA * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const h = hint.clone().sub(n.clone().multiplyScalar(hint.dot(n))).normalize();
  const mid = a.clone().add(n.clone().multiplyScalar(lenA * cosA)).add(h.multiplyScalar(lenA * sinA));
  aim(upper, lower, mid);
  aim(lower, end, a.add(n.multiplyScalar(d)));
}

type Rig = ReturnType<typeof readRig>;

function readRig(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const bone = (name: string) => {
    const b = root.getObjectByName(name);
    if (!b) throw new Error(`body.glb has no bone ${name}`);
    return b;
  };
  const all: THREE.Object3D[] = [];
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) all.push(o);
  });
  const rest = new Map(all.map((b) => [b, { q: b.quaternion.clone(), p: b.position.clone() }]));
  const side = (s: "l" | "r") => {
    const thigh = bone(`thigh_${s}`);
    const calf = bone(`calf_${s}`);
    const foot = bone(`foot_${s}`);
    const ball = bone(`ball_${s}`);
    const upperarm = bone(`upperarm_${s}`);
    const lowerarm = bone(`lowerarm_${s}`);
    const hand = bone(`hand_${s}`);
    return {
      sign: s === "l" ? 1 : -1,
      thigh,
      calf,
      foot,
      upperarm,
      lowerarm,
      hand,
      thighLen: worldPos(thigh).distanceTo(worldPos(calf)),
      shinLen: worldPos(calf).distanceTo(worldPos(foot)),
      upperLen: worldPos(upperarm).distanceTo(worldPos(lowerarm)),
      foreLen: worldPos(lowerarm).distanceTo(worldPos(hand)),
      index1: bone(`index_01_${s}`),
      middle1: bone(`middle_01_${s}`),
      pinky1: bone(`pinky_01_${s}`),
      middle3: bone(`middle_03_${s}`),
      handRest: worldQuat(hand),
      // Proximal to distal, so each parent is posed before its child.
      fingers: ["thumb", "index", "middle", "ring", "pinky"].flatMap((f) =>
        [1, 2, 3].map((i) => {
          const b = bone(`${f}_0${i}_${s}`);
          return { key: `${f}_0${i}`, bone: b, rest: worldQuat(b) };
        }),
      ),
      ankle: worldPos(foot),
      ball: worldPos(ball),
      footQ: worldQuat(foot),
    };
  };
  const l = side("l");
  const r = side("r");
  const pelvis = bone("pelvis");
  const spine3 = bone("spine_03");
  const hipMid = worldPos(l.thigh).add(worldPos(r.thigh)).multiplyScalar(0.5);
  // The bar rests on the upper back, just below the base of the neck.
  const neck = worldPos(bone("neck_01"));
  const barRest = new THREE.Vector3(0, neck.y - 0.07, neck.z - 0.09);
  const ankleMid = l.ankle.clone().add(r.ankle).multiplyScalar(0.5);
  const ballMid = l.ball.clone().add(r.ball).multiplyScalar(0.5);
  return {
    rest,
    l,
    r,
    pelvis,
    spine1: bone("spine_01"),
    spine2: bone("spine_02"),
    spine3,
    neck: bone("neck_01"),
    pelvisOffset: worldPos(pelvis).sub(hipMid),
    barFromHip: { y: barRest.y - hipMid.y, z: barRest.z - hipMid.z },
    barLocal: spine3.worldToLocal(barRest.clone()),
    midfootZ: ankleMid.z + (ballMid.z - ankleMid.z) * 0.45,
  };
}

function pose(rig: Rig, depth: number, faults: SquatFaults) {
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);

  const a = legAngles(depth, faults);
  const heel = deg(a.heelLift);
  // Heels lift by turning each foot about the ball of the foot.
  const ankleTarget = (s: Rig["l"]) => s.ankle.clone().sub(s.ball).applyQuaternion(qx(heel)).add(s.ball);
  const ankles = { l: ankleTarget(rig.l), r: ankleTarget(rig.r) };
  const ankleMid = ankles.l.clone().add(ankles.r).multiplyScalar(0.5);

  const hip = hipFromAnkle(a.shin, a.thigh, rig.l.shinLen, rig.l.thighLen);
  const hipCenter = new THREE.Vector3(0, ankleMid.y + hip.y, ankleMid.z + hip.z);
  const lean = balancedLean(hipCenter.z, rig.midfootZ, rig.barFromHip) + deg(a.extraLean);
  const tuck = deg(a.pelvisTuck);

  setWorldPos(rig.pelvis, hipCenter.clone().add(rig.pelvisOffset));
  rotateWorld(rig.pelvis, qx(lean - tuck));
  // Butt wink: pelvis tucks, the lower spine rounds, the chest keeps its angle.
  rotateWorld(rig.spine1, qx(tuck * 0.6));
  rotateWorld(rig.spine2, qx(tuck * 0.4));
  // Neutral neck, eyes a little down and ahead.
  rotateWorld(rig.neck, qx(-lean * 0.6));

  for (const s of [rig.l, rig.r]) {
    const target = s.sign === 1 ? ankles.l : ankles.r;
    // Knees track out over the toes, or cave in with the valgus fault.
    const hint = new THREE.Vector3(s.sign * (0.3 - 0.5 * a.kneeIn), 0, 1);
    twoBoneIK(s.thigh, s.calf, s.foot, s.thighLen, s.shinLen, target, hint);
    setWorldQuat(s.foot, qx(heel).multiply(s.footQ));
  }

  const bar = rig.spine3.localToWorld(rig.barLocal.clone());
  for (const s of [rig.l, rig.r]) {
    const target = bar.clone().add(new THREE.Vector3(s.sign * 0.33, 0, 0));
    const wrist = target.clone().add(new THREE.Vector3(0, -0.07, -0.03));
    const elbowsDownBack = new THREE.Vector3(s.sign * 0.4, -1, -0.7);
    // Close the fist, then move the wrist so the fist sits on the bar.
    for (let i = 0; i < 2; i++) {
      twoBoneIK(s.upperarm, s.lowerarm, s.hand, s.upperLen, s.foreLen, wrist, elbowsDownBack);
      grip(s, GRIPS.palmForward);
      wrist.add(target.clone().sub(fistCenter(s)));
    }
  }

  const mid = (a: THREE.Object3D, b: THREE.Object3D) => worldPos(a).add(worldPos(b)).multiplyScalar(0.5);
  return {
    hip: mid(rig.l.thigh, rig.r.thigh),
    shoulder: mid(rig.l.upperarm, rig.r.upperarm),
    bar,
  };
}

type GripPose = Record<"l" | "r", Record<string, number[]>>;

// Finger poses taken from Mixamo clips by tools/body/extract_grips.py.
// palmForward: back squat; overhand: hands on a bar with straight wrists.
const GRIPS = grips as Record<"palmForward" | "overhand", GripPose>;

// Palm faces forward, knuckles run along the bar (thumb toward the middle),
// then the fingers close into the stored grip.
function grip(s: Rig["l"], pose: GripPose) {
  const wrist = worldPos(s.hand);
  aim(s.hand, s.middle1, wrist.clone().add(new THREE.Vector3(0, 1, 0.2)));
  const dir = worldPos(s.middle1).sub(wrist).normalize();
  const perp = (v: THREE.Vector3) => v.sub(dir.clone().multiplyScalar(v.dot(dir))).normalize();
  const knuckles = perp(worldPos(s.pinky1).sub(worldPos(s.index1)));
  const want = perp(new THREE.Vector3(s.sign, 0, 0));
  const twist = Math.atan2(knuckles.clone().cross(want).dot(dir), knuckles.dot(want));
  rotateWorld(s.hand, new THREE.Quaternion().setFromAxisAngle(dir, twist));

  // finger = handDelta * G * fingerRest (see extract_grips.py)
  const handDelta = worldQuat(s.hand).multiply(s.handRest.clone().invert());
  const g = pose[s.sign === 1 ? "l" : "r"];
  for (const f of s.fingers) {
    const [x, y, z, w] = g[f.key];
    setWorldQuat(f.bone, handDelta.clone().multiply(new THREE.Quaternion(x, y, z, w)).multiply(f.rest));
  }
}

// Middle of the closed fist, where the bar should sit.
const fistCenter = (s: Rig["l"]) => worldPos(s.middle1).add(worldPos(s.middle3)).multiplyScalar(0.5);

// ---------- the lifter ----------

const PLAY_SECONDS = 3.6;

function Squatter({ state, onPinMove, onFrame }: Props) {
  const { scene } = useGLTF(MODEL);
  const body = useMemo(() => bodyMaterial(), []);
  const rig = useMemo(() => {
    scene.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
        const m = o as THREE.SkinnedMesh;
        m.material = body.mat;
        m.frustumCulled = false;
      }
    });
    return readRig(scene);
  }, [scene, body]);

  const bar = useRef<THREE.Group>(null);
  const plumb = useRef<THREE.Mesh>(null);
  const plumbMat = useRef<THREE.MeshBasicMaterial>(null);
  const clock = useRef({ t: 0, depth: 0, wasPlaying: false, lastReport: 0, phase: "down" as Phase });
  const colors = useMemo(
    () => ({
      prime: new THREE.Color(ROLE_COLORS.prime),
      synergist: new THREE.Color(ROLE_COLORS.synergist),
      stabilizer: new THREE.Color(ROLE_COLORS.stabilizer),
      warn: new THREE.Color(ROLE_COLORS.warn),
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

    const joints = pose(rig, depth, s.faults);

    body.clear();
    const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 180);
    for (const act of squatActivation(depth, c.phase, s.faults)) {
      body.setRegion(
        REGION_IDS[act.region],
        act.warn ? colors.warn : colors[act.role],
        act.warn ? pulse : 0.2 + 0.8 * act.amount,
      );
    }

    if (bar.current) bar.current.position.copy(joints.bar);
    if (plumb.current && plumbMat.current) {
      const h = joints.bar.y;
      plumb.current.position.set(joints.bar.x, h / 2, joints.bar.z);
      plumb.current.scale.set(1, h, 1);
      // Green while the bar stays over the middle of the foot.
      plumbMat.current.color.set(Math.abs(joints.bar.z - rig.midfootZ) <= 0.03 ? "#34d399" : "#fbbf24");
    }

    const fwd = (o: THREE.Object3D, z: number) => new THREE.Vector3(0, 0, z).applyQuaternion(worldQuat(o));
    // Which way each pin's spot on the body faces; pins on the far side dim.
    const facing: Record<string, THREE.Vector3> = {
      feet: new THREE.Vector3(0, 0.5, 1),
      knee: new THREE.Vector3(0, 0, 1),
      core: fwd(rig.spine2, 1),
      back: fwd(rig.spine1, -1),
      bar: fwd(rig.spine3, -1).add(new THREE.Vector3(0, 1, 0)),
    };
    const at = {
      feet: new THREE.Vector3(rig.l.ankle.x + 0.02, 0.03, rig.midfootZ + 0.06),
      knee: worldPos(rig.l.calf).add(new THREE.Vector3(0.03, 0.02, 0.07)),
      core: joints.hip.clone().lerp(joints.shoulder, 0.45).add(new THREE.Vector3(0, 0, 0.16).applyQuaternion(worldQuat(rig.spine2))),
      back: worldPos(rig.spine1).add(new THREE.Vector3(0, 0, -0.14).applyQuaternion(worldQuat(rig.spine1))),
      bar: joints.bar.clone().add(new THREE.Vector3(0, 0.07, -0.05)),
    } as Record<string, THREE.Vector3>;
    for (const p of SQUAT_PINS) {
      const toCamera = camera.position.clone().sub(at[p.id]);
      const front = facing[p.id].dot(toCamera) > 0;
      const v = at[p.id].project(camera);
      onPinMove(p.id, ((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height, v.z < 1, front);
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
      <group ref={bar}>
        <mesh rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.014, 0.014, 2.0, 16]} />
          <meshStandardMaterial color="#9aa6ab" metalness={0.8} roughness={0.3} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position-x={side * 0.78} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.2, 0.2, 0.05, 40]} />
            {/* See-through so the side view still shows the body. */}
            <meshStandardMaterial color="#5d7378" roughness={0.7} transparent opacity={0.28} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <mesh ref={plumb}>
        <cylinderGeometry args={[0.004, 0.004, 1, 6]} />
        <meshBasicMaterial ref={plumbMat} transparent opacity={0.85} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, rig.midfootZ]}>
        <ringGeometry args={[0.025, 0.035, 32]} />
        <meshBasicMaterial color="#34d399" />
      </mesh>
    </group>
  );
}

useGLTF.preload(MODEL);
