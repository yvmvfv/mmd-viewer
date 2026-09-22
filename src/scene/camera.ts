import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

/** スマホ前提: 1指回転 / 2指ズーム・パン */
/** 規定値＝モデル読込時の自動フレーミングと同一（高さ20想定：注視11・距離22） */
export const DEFAULT_TARGET_Y = 11;
export const DEFAULT_RADIUS = 22;

export function createCamera(scene: Scene): ArcRotateCamera {
  const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 3, DEFAULT_RADIUS, new Vector3(0, DEFAULT_TARGET_Y, 0), scene);
  camera.lowerRadiusLimit = 0.5;
  camera.upperRadiusLimit = 80;
  camera.minZ = 0.05;
  camera.wheelDeltaPercentage = 0.02;
  // 2本指ズーム・パン（中間値）
  camera.pinchDeltaPercentage = 0.02;
  // 2本指パンを速く（数値が小さいほどよく動く）
  camera.panningSensibility = 80;
  // 少しの2本指移動でもパン扱いに（可動域を広く感じるよう）
  camera.pinchToPanMaxDistance = 50;
  camera.attachControl(true);
  return camera;
}

/** モデル全体（床除く）の中心。ズーム中心の追随用 */
export function modelWorldCenter(scene: Scene): { center: Vector3; height: number } | null {
  try {
    const meshes = scene.meshes.filter((m) => m.name !== "floor");
    if (meshes.length === 0) return null;
    let minY = Infinity;
    let maxY = -Infinity;
    let cx = 0;
    let cz = 0;
    let n = 0;
    for (const m of meshes) {
      m.computeWorldMatrix(true);
      const bb = m.getBoundingInfo().boundingBox;
      minY = Math.min(minY, bb.minimumWorld.y);
      maxY = Math.max(maxY, bb.maximumWorld.y);
      cx += bb.centerWorld.x;
      cz += bb.centerWorld.z;
      n++;
    }
    if (!isFinite(minY) || !isFinite(maxY) || n === 0) return null;
    const height = Math.max(1, maxY - minY);
    return { center: new Vector3(cx / n, minY + height * 0.55, cz / n), height };
  } catch {
    return null;
  }
}

/** モデル読込後に寄せる: バウンディングから距離と注視点を合わせる */
export function focusCameraOnMesh(scene: Scene, _root: unknown): void {
  const camera = scene.activeCamera as ArcRotateCamera | null;
  if (!camera) return;
  const found = modelWorldCenter(scene);
  if (!found) return;
  camera.setTarget(found.center);
  camera.radius = Math.min(30, Math.max(3.5, found.height * 1.1));
}
