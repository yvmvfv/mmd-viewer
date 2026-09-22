import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { modelWorldCenter } from "../scene/camera";
import { activeModelStore } from "../state/activeModel";
import { modelPresence } from "../state/presence";
import { viewModeStore, type ViewMode } from "../state/viewMode";

/**
 * 画面右の操作バー。
 * camera: 従来通りカメラ操作 / move: モデル移動（1本指=上下左右・ピンチ=前後）
 * extra3/4: 選択のみ（機能は後日）
 */
export function setupModeBar(scene: Scene, canvas: HTMLCanvasElement): void {
  const bar = document.getElementById("modeBar")!;
  const buttons = Array.from(bar.querySelectorAll<HTMLButtonElement>("button[data-mode]"));
  let mode: ViewMode = viewModeStore.get();

  const camera = (): ArcRotateCamera | null =>
    scene.activeCamera as unknown as ArcRotateCamera | null;

  const setMode = (m: ViewMode): void => {
    mode = m;
    viewModeStore.set(m);
    for (const b of buttons) b.classList.toggle("active", b.dataset.mode === m);
    const cam = camera();
    if (!cam) return;
    if (m === "move") {
      cam.detachControl();
    } else {
      try {
        cam.detachControl();
      } catch {
        /* 既に外れていてもOK */
      }
      cam.attachControl(true);
      // カメラモードに戻る際は注視点を操作中モデルへ追随（遠くへ動かしても寄れる）
      if (m === "camera" && activeModelStore.get()) {
        const found = modelWorldCenter(scene);
        if (found) cam.setTarget(found.center);
      }
    }
  };

  for (const b of buttons) {
    b.addEventListener("click", () => setMode(b.dataset.mode as ViewMode));
  }

  // モデル移動ジェスチャ
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchPrev = 0;
  const dist = (): number => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  canvas.addEventListener("pointerdown", (e) => {
    if (mode !== "move") return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) pinchPrev = dist();
  });
  const up = (e: PointerEvent): void => {
    pointers.delete(e.pointerId);
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("pointermove", (e) => {
    if (mode !== "move" || !pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId)!;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const root = activeModelStore.get();
    const cam = camera();
    if (!root || !cam) return;
    // 注視点ではなくカメラ→モデル距離を基準に（遠くでも手前でも同じ速さに見える）
    const modelDist = Math.max(1, Vector3.Distance(cam.position, root.position));
    const forward = cam.getTarget().subtract(cam.position).normalize();
    // 画面右＝up×forward（左手座標系での正しい右方向）
    const right = Vector3.Cross(cam.upVector, forward).normalize();
    const upv = Vector3.Cross(forward, right).normalize();

    if (pointers.size === 1) {
      // 1本指：画面に平行な上下左右
      const k = modelDist * 0.0016;
      root.position.addInPlace(right.scale(dx * k)).addInPlace(upv.scale(-dy * k));
    } else if (pointers.size === 2) {
      // ピンチ：前後
      const d = dist();
      const delta = d - pinchPrev;
      pinchPrev = d;
      root.position.addInPlace(forward.scale(-delta * modelDist * 0.004));
    }
  });

  // モデル有無で表示切替。無くなったらカメラモードに戻す
  const syncVisible = (has: boolean): void => {
    if (has) bar.removeAttribute("hidden");
    else {
      bar.setAttribute("hidden", "");
      if (mode !== "camera") setMode("camera");
    }
  };
  modelPresence.subscribe(syncVisible);
  syncVisible(modelPresence.get());
}
