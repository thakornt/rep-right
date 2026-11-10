// Loads public/models/body.glb outside the browser, for tests.

import fs from "node:fs";
import path from "node:path";

import type * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { addArmTwist, followArmTwist } from "./arm-twist";
import { shortenPalms } from "./body-proportions";
import { followDeltaMush, prepareDeltaMush } from "./delta-mush";

export function loadBody(): Promise<THREE.Object3D> {
  const buf = fs.readFileSync(path.join(__dirname, "../../../public/models/body.glb"));
  const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(data, "", (g) => {
    shortenPalms(g.scene);
    addArmTwist(g.scene);
    prepareDeltaMush(g.scene);
    followArmTwist(g.scene);
    followDeltaMush(g.scene);
    resolve(g.scene);
  }, reject));
}
