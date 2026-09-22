import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { MmdWasmInstanceTypeSPR } from "babylon-mmd/esm/Runtime/Optimized/InstanceType/singlePhysicsRelease";
import { GetMmdWasmInstance } from "babylon-mmd/esm/Runtime/Optimized/mmdWasmInstance";
import { MmdBulletPhysics } from "babylon-mmd/esm/Runtime/Optimized/Physics/mmdBulletPhysics";
import { MultiPhysicsRuntime } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/Impl/multiPhysicsRuntime";
import { MotionType } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/motionType";
import { PhysicsStaticPlaneShape } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/physicsShape";
import { RigidBody } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/rigidBody";
import { RigidBodyConstructionInfo } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/rigidBodyConstructionInfo";
import { rebuildRuntime } from "../motion/motionService";

export interface PhysicsSettings {
  enabled: boolean;
  /** 重力Y（MMD標準は-98） */
  gravityY: number;
  /** 計算精度＝最大サブステップ（高いほど滑らか・高負荷） */
  maxSubSteps: number;
}

export const DEFAULT_PHYSICS: PhysicsSettings = {
  enabled: false,
  gravityY: -98,
  maxSubSteps: 10,
};

export const GRAVITY_MIN = -200;
export const GRAVITY_MAX = 0;
export const ACCURACY_MIN = 1;
export const ACCURACY_MAX = 30;

let current: PhysicsSettings = loadStored();

function loadStored(): PhysicsSettings {
  try {
    const raw = localStorage.getItem("mmd-viewer-physics");
    if (raw) return { ...DEFAULT_PHYSICS, ...(JSON.parse(raw) as Partial<PhysicsSettings>) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PHYSICS };
}

function store(): void {
  try {
    localStorage.setItem("mmd-viewer-physics", JSON.stringify(current));
  } catch {
    /* ignore */
  }
}
let physicsRuntime: MultiPhysicsRuntime | null = null;
let physicsRegistered = false;

export function getPhysicsSettings(): PhysicsSettings {
  return { ...current };
}

async function ensurePhysicsRuntime(
  scene: Scene,
  onStep?: (msg: string) => void,
): Promise<MultiPhysicsRuntime> {
  if (!physicsRuntime) {
    onStep?.("WASM読込中…");
    const wasm = await withTimeout(
      GetMmdWasmInstance(new MmdWasmInstanceTypeSPR()),
      90000,
      "WASMの読み込みがタイムアウトしました",
    );
    onStep?.("物理世界構築中…");
    physicsRuntime = new MultiPhysicsRuntime(wasm);
    // 地面コライダー（y=0の無限平面＝床と一致）
    const info = new RigidBodyConstructionInfo(physicsRuntime.wasmInstance);
    info.motionType = MotionType.Static;
    info.shape = new PhysicsStaticPlaneShape(physicsRuntime, new Vector3(0, 1, 0), 0);
    const ground = new RigidBody(physicsRuntime, info);
    physicsRuntime.addRigidBodyToGlobal(ground);
  }
  if (!physicsRegistered) {
    physicsRuntime.register(scene);
    physicsRegistered = true;
  }
  return physicsRuntime;
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** 設定を適用（ON/OFF切替時はランタイム再構築＋モデル再バインド） */
export async function applyPhysicsSettings(
  scene: Scene,
  s: PhysicsSettings,
  onStep?: (msg: string) => void,
): Promise<void> {
  const prev = current;
  current = { ...s };
  store();
  if (s.enabled) {
    const pr = await ensurePhysicsRuntime(scene, onStep);
    pr.setGravity(new Vector3(0, s.gravityY, 0));
    pr.maxSubSteps = s.maxSubSteps;
    onStep?.("ランタイム切替中…");
    await rebuildRuntime(scene, new MmdBulletPhysics(pr));
  } else if (prev.enabled) {
    if (physicsRuntime && physicsRegistered) {
      physicsRuntime.unregister();
      physicsRegistered = false;
    }
    onStep?.("ランタイム切替中…");
    await rebuildRuntime(scene, null);
  }
}

export async function resetPhysicsSettings(scene: Scene): Promise<void> {
  await applyPhysicsSettings(scene, { ...DEFAULT_PHYSICS });
}
