"use client";

import { OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

import { REGION_COUNT, REGION_IDS, ROLE_COLORS, ROLE_STRENGTH } from "./muscles";
import { BAR_RADIUS, pose, readRig, SQUAT_CLIP, worldPos, worldQuat, X } from "./pose";
import { squatActivation, SQUAT_PINS, type Phase, type SquatFaults } from "./squat";

export const MODEL = "/models/body.glb";
const MUSCLE_MAP = "/models/muscles.png";
const RELIEF_MAP = "/models/relief.png";

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

export function Floor() {
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
  side: [3.3, 0.95, 0],
  front: [0, 0.95, 3.3],
  back: [0, 0.95, -3.3],
  angle: [2.3, 1.15, 2.3],
};
// High enough that the head stays in frame when standing.
const TARGET = new THREE.Vector3(0, 0.82, 0);

export function CameraRig({ view, target = TARGET }: { view: View; target?: THREE.Vector3 }) {
  const camera = useThree((s) => s.camera);
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const goal = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    goal.current = new THREE.Vector3(...CAMERA[view]);
  }, [view]);

  useFrame(() => {
    if (!goal.current) return;
    camera.position.lerp(goal.current, 0.14);
    controls.current?.target.lerp(target, 0.14);
    controls.current?.update();
    if (camera.position.distanceTo(goal.current) < 0.01) goal.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      target={target}
      enablePan={false}
      minDistance={0.9}
      maxDistance={6}
      maxPolarAngle={Math.PI * 0.62}
      onStart={() => (goal.current = null)}
    />
  );
}

// ---------- body material ----------

// Skin keeps showing through the colour, so its shape and grooves still read.
export function bodyMaterial({ map, relief }: { map: THREE.Texture; relief: THREE.Texture }) {
  const tints = Array.from({ length: REGION_COUNT }, () => new THREE.Vector3());
  const amounts = new Array<number>(REGION_COUNT).fill(0);
  const mat = new THREE.MeshStandardMaterial({
    color: "#b9b2ab",
    roughness: 0.62,
    normalMap: relief,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTint = { value: tints };
    shader.uniforms.uAmt = { value: amounts };
    shader.uniforms.uMuscleMap = { value: map };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec2 vMapUv;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vMapUv = uv;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform sampler2D uMuscleMap;
        uniform vec3 uTint[${REGION_COUNT}];
        uniform float uAmt[${REGION_COUNT}];
        varying vec2 vMapUv;
        vec3 mapTint;
        float mapAmt;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        // Region ids can't be filtered, so blend the four nearest pixels' colours.
        vec2 size = vec2(textureSize(uMuscleMap, 0));
        vec2 st = vMapUv * size - 0.5;
        vec2 cell = floor(st);
        vec2 mixAt = st - cell;
        mapTint = vec3(0.0);
        mapAmt = 0.0;
        vec3 base = vec3(0.0);
        for (int j = 0; j < 2; j++) {
          for (int i = 0; i < 2; i++) {
            vec2 corner = vec2(float(i), float(j));
            vec2 w = mix(1.0 - mixAt, mixAt, corner);
            int v = int(texture2D(uMuscleMap, (cell + corner + 0.5) / size).r * 255.0 + 0.5);
            int r = v % 32;
            int cloth = v / 32;
            mapTint += w.x * w.y * uTint[r] * uAmt[r];
            mapAmt += w.x * w.y * uAmt[r];
            base += w.x * w.y * (cloth == 2 ? vec3(0.05, 0.06, 0.07) : cloth == 1 ? vec3(0.07, 0.1, 0.12) : diffuseColor.rgb);
          }
        }
        // mapTint is premultiplied so region borders fade instead of darkening.
        vec3 tint = mapTint / max(mapAmt, 0.001);
        diffuseColor.rgb = mix(base, tint, clamp(mapAmt, 0.0, 1.0) * 0.84);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += mapTint * 0.16;`,
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

// The muscle map holds region ids, not colours: no filtering, no colour conversion.
export function useMuscleMap() {
  const [loadedMap, loadedRelief] = useLoader(THREE.TextureLoader, [MUSCLE_MAP, RELIEF_MAP]);
  return useMemo(() => {
    const map = loadedMap.clone();
    map.flipY = false;
    map.colorSpace = THREE.NoColorSpace;
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.NearestFilter;
    map.generateMipmaps = false;
    map.needsUpdate = true;
    const relief = loadedRelief.clone();
    relief.flipY = false;
    relief.colorSpace = THREE.NoColorSpace;
    relief.needsUpdate = true;
    return { map, relief };
  }, [loadedMap, loadedRelief]);
}

// ---------- the lifter ----------

export const PLAY_SECONDS = 3.6;

// A posable copy of the body for this viewer. The loaded model is shared and
// cached, so posing it directly would leave the next viewer reading a posed
// body as its rest pose.
export function useBody() {
  const { scene } = useGLTF(MODEL);
  return useMemo(() => cloneSkinned(scene), [scene]);
}

function Squatter({ state, onPinMove, onFrame }: Props) {
  const scene = useBody();
  const muscleMap = useMuscleMap();
  const body = useMemo(() => bodyMaterial(muscleMap), [muscleMap]);
  const rig = useMemo(() => {
    scene.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
        const m = o as THREE.SkinnedMesh;
        m.material = body.mat;
        m.frustumCulled = false;
      }
    });
    return readRig(scene, SQUAT_CLIP);
  }, [scene, body]);

  const bar = useRef<THREE.Group>(null);
  const plumb = useRef<THREE.Mesh>(null);
  const plumbMat = useRef<THREE.MeshBasicMaterial>(null);
  const midfootRing = useRef<THREE.Mesh>(null);
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
        act.warn ? pulse : (0.2 + 0.8 * act.amount) * ROLE_STRENGTH[act.role],
      );
    }

    if (bar.current) {
      bar.current.position.copy(joints.bar);
      bar.current.quaternion.setFromUnitVectors(X, joints.barDir);
    }
    if (plumb.current && plumbMat.current) {
      const h = joints.bar.y;
      plumb.current.position.set(joints.bar.x, h / 2, joints.bar.z);
      plumb.current.scale.set(1, h, 1);
      // Green while the bar stays over the middle of the foot (within ~5 cm).
      plumbMat.current.color.set(Math.abs(joints.bar.z - joints.midfoot.z) <= 0.05 ? "#34d399" : "#fbbf24");
    }

    midfootRing.current?.position.copy(joints.midfoot).setY(0.002);

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
      feet: worldPos(rig.l.ball).setY(0.03),
      knee: worldPos(rig.l.calf).add(new THREE.Vector3(0.03, 0.02, 0.07)),
      core: worldPos(rig.spine2).add(fwd(rig.spine2, 0.15)),
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
          <cylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, 2.0, 16]} />
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
      <mesh ref={midfootRing} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.025, 0.035, 32]} />
        <meshBasicMaterial color="#34d399" />
      </mesh>
    </group>
  );
}

useGLTF.preload(MODEL);
