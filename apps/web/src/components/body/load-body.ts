// Loads public/models/body.glb outside the browser, for tests.

import fs from "node:fs";
import path from "node:path";

import type * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { addArmTwist, followArmTwist } from "./arm-twist";
import { addLatStretch, followLatStretch } from "./lat-helper";
import { shortenPalms, slimThighs } from "./body-proportions";
import { setShoulderWeights } from "./shoulder-weights";
import { followDeltaMush, prepareDeltaMush } from "./delta-mush";

export function loadBody(): Promise<THREE.Object3D> {
  const buf = fs.readFileSync(path.join(__dirname, "../../../public/models/body.glb"));
  const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(data, "", (g) => {
    shortenPalms(g.scene);
    slimThighs(g.scene);
    setShoulderWeights(g.scene);
    addArmTwist(g.scene);
    addLatStretch(g.scene);
    prepareDeltaMush(g.scene);
    followArmTwist(g.scene);
    followLatStretch(g.scene);
    followDeltaMush(g.scene);
    resolve(g.scene);
  }, reject));
}
