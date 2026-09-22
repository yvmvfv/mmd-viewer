import type { Scene } from "@babylonjs/core/scene";
import {
  ACCURACY_MAX,
  ACCURACY_MIN,
  applyPhysicsSettings,
  getPhysicsSettings,
  GRAVITY_MAX,
  GRAVITY_MIN,
  resetPhysicsSettings,
} from "../../motion/physics";
import type { MenuItem } from "../menuRegistry";

/** 物理演算設定：髪・衣装の揺れ（WASM/Bullet・単一スレッド） */
export class PhysicsItem implements MenuItem {
  readonly id = "physics";
  readonly title = "物理演算設定";
  readonly icon = "⚖";
  readonly requiresModel = true;
  private host: HTMLElement | null = null;
  private status = "無効";
  private busy = false;

  constructor(private scene: Scene) {}

  render(host: HTMLElement): void {
    this.host = host;
    host.innerHTML = "";
    const s = getPhysicsSettings();

    const h = document.createElement("h3");
    h.textContent = "物理演算設定";
    host.appendChild(h);

    const desc = document.createElement("p");
    desc.textContent = "数値が高いほどすり抜けや荒ぶりが改善されますが負荷が上がります";
    host.appendChild(desc);

    const enableLabel = document.createElement("label");
    enableLabel.className = "check-row";
    const enableCheck = document.createElement("input");
    enableCheck.type = "checkbox";
    enableCheck.checked = s.enabled;
    enableCheck.disabled = this.busy;
    enableCheck.onchange = () => void this.apply({ ...getPhysicsSettings(), enabled: enableCheck.checked });
    enableLabel.append(enableCheck, document.createTextNode("物理エンジンの有効化"));

    const gLabel = document.createElement("p");
    gLabel.textContent = `重力の強さ ${s.gravityY}`;
    const gravity = document.createElement("input");
    gravity.type = "range";
    gravity.min = String(GRAVITY_MIN);
    gravity.max = String(GRAVITY_MAX);
    gravity.step = "1";
    gravity.value = String(s.gravityY);
    gravity.disabled = this.busy;
    gravity.oninput = () => {
      const v = Number(gravity.value);
      gLabel.textContent = `重力の強さ ${v}`;
      void this.apply({ ...getPhysicsSettings(), gravityY: v });
    };

    const aLabel = document.createElement("p");
    aLabel.textContent = `計算精度（負荷高） ${s.maxSubSteps}`;
    const accuracy = document.createElement("input");
    accuracy.type = "range";
    accuracy.min = String(ACCURACY_MIN);
    accuracy.max = String(ACCURACY_MAX);
    accuracy.step = "1";
    accuracy.value = String(s.maxSubSteps);
    accuracy.disabled = this.busy;
    accuracy.oninput = () => {
      const v = Number(accuracy.value);
      aLabel.textContent = `計算精度（負荷高） ${v}`;
      void this.apply({ ...getPhysicsSettings(), maxSubSteps: v });
    };

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "デフォルト設定に戻す";
    resetBtn.disabled = this.busy;
    resetBtn.onclick = () => void this.reset();

    const statusEl = document.createElement("div");
    statusEl.className = "status";
    statusEl.textContent = this.status;

    host.append(enableLabel, gLabel, gravity, aLabel, accuracy, resetBtn, statusEl);
  }

  private async apply(s: { enabled: boolean; gravityY: number; maxSubSteps: number }): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      this.status = s.enabled ? "物理エンジン準備中…" : "適用中…";
      this.rerender();
      await applyPhysicsSettings(this.scene, s, (msg) => {
        this.status = msg;
        this.rerender();
      });
      const cur = getPhysicsSettings();
      this.status = cur.enabled ? `有効（重力${cur.gravityY}・精度${cur.maxSubSteps}）` : "無効";
    } catch (e) {
      console.error(e);
      this.status = `失敗: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      this.busy = false;
    }
    this.rerender();
  }

  private async reset(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      this.status = "適用中…";
      this.rerender();
      await resetPhysicsSettings(this.scene);
      this.status = "無効";
    } catch (e) {
      this.status = `失敗: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      this.busy = false;
    }
    this.rerender();
  }

  private rerender(): void {
    if (this.host) this.render(this.host);
  }
}
