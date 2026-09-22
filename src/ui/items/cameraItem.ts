import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { DEFAULT_RADIUS, DEFAULT_TARGET_Y, modelWorldCenter } from "../../scene/camera";
import { activeModelStore } from "../../state/activeModel";
import type { MenuItem } from "../menuRegistry";

export class CameraItem implements MenuItem {
  readonly id = "camera-settings";
  readonly title = "カメラ設定";
  readonly icon = "⌖";
  constructor(private scene: Scene) {}
  render(host: HTMLElement): void {
    const h = document.createElement("h3");
    h.textContent = "カメラ設定";
    const p = document.createElement("p");
    p.textContent = "1指: 回転 / 2指: ズーム・移動";
    const btn = document.createElement("button");
    btn.textContent = "カメラをリセット";
    btn.onclick = () => {
      const cam = this.scene.activeCamera as unknown as {
        alpha: number;
        beta: number;
        radius: number;
        setTarget?: (v: Vector3) => void;
      } | null;
      if (cam) {
        cam.alpha = -Math.PI / 2;
        cam.beta = Math.PI / 3;
        cam.radius = DEFAULT_RADIUS;
        // 操作中モデルがいればそこへ、なければ規定位置へ
        const found = activeModelStore.get() ? modelWorldCenter(this.scene) : null;
        cam.setTarget?.(found ? found.center : new Vector3(0, DEFAULT_TARGET_Y, 0));
      }
    };
    const p2 = document.createElement("p");
    p2.textContent = `規定: 注視Y=${DEFAULT_TARGET_Y} / 距離=${DEFAULT_RADIUS}（ピンチでさらに寄れます）`;
    host.append(h, p, btn, p2);
  }
}
