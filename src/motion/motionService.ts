import type { Scene } from "@babylonjs/core/scene";
import { VmdLoader } from "babylon-mmd/esm/Loader/vmdLoader";
import { VpdLoader } from "babylon-mmd/esm/Loader/vpdLoader";
import { StreamAudioPlayer } from "babylon-mmd/esm/Runtime/Audio/streamAudioPlayer";
import type { MmdAnimation } from "babylon-mmd/esm/Loader/Animation/mmdAnimation";
import { RegisterMmdRuntimeModelAnimation } from "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation.pure";
// MmdAnimationへIMmdBindableModelAnimationを付与する型拡張（実体は空）
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation.types";
import type { MmdMesh } from "babylon-mmd/esm/Runtime/mmdMesh";
import type { MmdModel } from "babylon-mmd/esm/Runtime/mmdModel";
import { MmdRuntime } from "babylon-mmd/esm/Runtime/mmdRuntime";
import type { IMmdPhysics } from "babylon-mmd/esm/Runtime/Physics/IMmdPhysics";

let registered = false;
let runtime: MmdRuntime | null = null;
let vmdLoader: VmdLoader | null = null;
let vpdLoader: VpdLoader | null = null;
let modelMap = new WeakMap<MmdMesh, MmdModel>();
const knownRoots = new Set<MmdMesh>();
const boundAnims = new WeakMap<MmdMesh, MmdAnimation | null>();
let lastSpeed = 1;

/** 物理なしMMDランタイム（モーション再生のみ） */
export function ensureMotionRuntime(scene: Scene): MmdRuntime {
  if (!registered) {
    RegisterMmdRuntimeModelAnimation();
    registered = true;
  }
  if (!runtime) {
    runtime = new MmdRuntime(scene);
    runtime.register(scene);
    runtime.timeScale = lastSpeed;
    void runtime.playAnimation();
    attachForwarding(runtime);
  }
  return runtime;
}

/**
 * 物理ON/OFF切替のためのランタイム再構築。
 * モデル・バインド・速度・音声・再生状態を引き継ぐ。
 */
export async function rebuildRuntime(scene: Scene, physics: IMmdPhysics | null): Promise<void> {
  if (!registered) {
    RegisterMmdRuntimeModelAnimation();
    registered = true;
  }
  const wasPlaying = runtime ? runtime.isAnimationPlaying : true;
  const curTime = runtime ? runtime.currentFrameTime : 0;
  if (runtime) {
    try {
      runtime.unregister(scene);
    } catch {
      /* ignore */
    }
    runtime.dispose(scene);
    runtime = null;
  }
  modelMap = new WeakMap<MmdMesh, MmdModel>();
  runtime = physics ? new MmdRuntime(scene, physics) : new MmdRuntime(scene);
  runtime.register(scene);
  runtime.timeScale = lastSpeed;
  attachForwarding(runtime);
  if (audioPlayer) {
    try {
      await runtime.setAudioPlayer(audioPlayer);
    } catch {
      /* ignore */
    }
  }
  for (const root of knownRoots) {
    if (root.isDisposed()) {
      knownRoots.delete(root);
      continue;
    }
    try {
      const m = runtime.createMmdModel(root);
      modelMap.set(root, m);
      const anim = boundAnims.get(root);
      if (anim) m.setRuntimeAnimation(m.createRuntimeAnimation(anim));
    } catch {
      /* ignore */
    }
  }
  if (wasPlaying) void runtime.playAnimation();
  else runtime.pauseAnimation();
  try {
    await runtime.seekAnimation(curTime, true);
  } catch {
    /* ignore */
  }
}

export function getMmdModel(scene: Scene, root: MmdMesh): MmdModel {
  ensureMotionRuntime(scene);
  let m = modelMap.get(root);
  if (!m) {
    m = runtime!.createMmdModel(root);
    modelMap.set(root, m);
    knownRoots.add(root);
  }
  return m;
}

/** Fileを直接読む（VmdLoaderはFile対応） */
export async function loadVmdFile(scene: Scene, file: File): Promise<MmdAnimation> {
  if (!vmdLoader) vmdLoader = new VmdLoader(scene);
  return vmdLoader.loadAsync(file.name, file);
}

/** VPDポーズ読込 */
export async function loadVpdFile(scene: Scene, file: File): Promise<MmdAnimation> {
  if (!vpdLoader) vpdLoader = new VpdLoader(scene);
  return vpdLoader.loadAsync(file.name, file);
}

/** ポーズ適用：バインドして0フレームで静止 */
export function applyPose(scene: Scene, root: MmdMesh, anim: MmdAnimation): void {
  const model = getMmdModel(scene, root);
  model.setRuntimeAnimation(model.createRuntimeAnimation(anim));
  boundAnims.set(root, anim);
  ensureMotionRuntime(scene).seekAnimation(0, true);
}

export function applyMotion(scene: Scene, root: MmdMesh, anim: MmdAnimation): void {
  const model = getMmdModel(scene, root);
  model.setRuntimeAnimation(model.createRuntimeAnimation(anim));
  boundAnims.set(root, anim);
  ensureMotionRuntime(scene).playAnimation();
}

export function stopMotion(root: MmdMesh): void {
  const model = modelMap.get(root);
  if (model) model.setRuntimeAnimation(null);
  boundAnims.set(root, null);
}

export function setMotionPlaying(scene: Scene, playing: boolean): void {
  const r = ensureMotionRuntime(scene);
  if (playing) void r.playAnimation();
  else r.pauseAnimation();
}

export function isMotionPlaying(scene: Scene): boolean {
  return ensureMotionRuntime(scene).isAnimationPlaying;
}

/** シークバー用：秒単位（seekは30fps換算でフレーム指定） */
export function getDurationSeconds(scene: Scene): number {
  return Math.max(0, ensureMotionRuntime(scene).animationDuration);
}
export function getCurrentSeconds(scene: Scene): number {
  return Math.max(0, ensureMotionRuntime(scene).currentTime);
}
export function seekSeconds(scene: Scene, seconds: number): void {
  void ensureMotionRuntime(scene).seekAnimation(seconds * 30, true);
}
export function getSpeed(scene: Scene): number {
  return ensureMotionRuntime(scene).timeScale;
}
export function setSpeed(scene: Scene, v: number): void {
  lastSpeed = v;
  ensureMotionRuntime(scene).timeScale = v;
}

/** 音声：ランタイム同期再生（シークバー連動、不足分はそのまま終了） */
let audioPlayer: StreamAudioPlayer | null = null;
let audioUrl: string | null = null;

export async function setAudioFile(scene: Scene, file: File | null): Promise<void> {
  const r = ensureMotionRuntime(scene);
  if (audioUrl) {
    URL.revokeObjectURL(audioUrl);
    audioUrl = null;
  }
  if (!file) {
    await r.setAudioPlayer(null);
    return;
  }
  if (!audioPlayer) audioPlayer = new StreamAudioPlayer(scene);
  audioUrl = URL.createObjectURL(file);
  audioPlayer.source = audioUrl;
  await r.setAudioPlayer(audioPlayer);
}
/** シーンから消したモデルの追跡をやめる */
export function forgetModel(root: MmdMesh): void {
  knownRoots.delete(root);
  boundAnims.delete(root);
}

/** ランタイムからの切り離し＋破棄（描画ループの参照切れ防止） */
export function disposeModel(root: MmdMesh): void {
  const model = modelMap.get(root);
  if (model && runtime) {
    try {
      model.setRuntimeAnimation(null);
    } catch {
      /* ignore */
    }
    try {
      runtime.destroyMmdModel(model);
    } catch (e) {
      console.error(e);
      try {
        model._dispose();
      } catch {
        /* ignore */
      }
    }
  }
  forgetModel(root);
}

type PlayListener = (playing: boolean) => void;
const playListeners = new Set<PlayListener>();
type AppliedListener = (applied: boolean) => void;
const appliedListeners = new Set<AppliedListener>();
let applied = false;

function attachForwarding(rt: MmdRuntime): void {
  rt.onPlayAnimationObservable.add(() => playListeners.forEach((f) => f(true)));
  rt.onPauseAnimationObservable.add(() => playListeners.forEach((f) => f(false)));
}

export function subscribePlaying(fn: PlayListener): () => void {
  if (runtime) attachForwarding(runtime);
  playListeners.add(fn);
  return () => playListeners.delete(fn);
}
export function subscribeApplied(fn: AppliedListener): () => void {
  appliedListeners.add(fn);
  return () => appliedListeners.delete(fn);
}
export function isMotionApplied(): boolean {
  return applied;
}
export function setMotionApplied(v: boolean): void {
  applied = v;
  appliedListeners.forEach((f) => f(v));
}
