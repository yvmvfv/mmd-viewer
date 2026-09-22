import type { Scene } from "@babylonjs/core/scene";
import { getMmdModel } from "../../motion/motionService";
import { activeModelStore } from "../../state/activeModel";
import type { MenuItem } from "../menuRegistry";

/** もーふ編集：操作中モデルのモーフをスライダー調整（モデル順） */
export class MorphItem implements MenuItem {
  readonly id = "morph-edit";
  readonly title = "もーふ編集";
  readonly icon = "☺";
  readonly requiresModel = true;
  private host: HTMLElement | null = null;

  constructor(private scene: Scene) {}

  render(host: HTMLElement): void {
    this.host = host;
    host.innerHTML = "";

    const h = document.createElement("h3");
    h.textContent = "もーふ編集";
    host.appendChild(h);

    const root = activeModelStore.get();
    if (!root) {
      const p = document.createElement("p");
      p.textContent = "操作中モデルがありません";
      host.appendChild(p);
      return;
    }

    let model;
    try {
      model = getMmdModel(this.scene, root);
    } catch (e) {
      const p = document.createElement("p");
      p.textContent = `取得失敗: ${e instanceof Error ? e.message : String(e)}`;
      host.appendChild(p);
      return;
    }

    const list = model.morph.morphs.map((m, index) => ({ index, name: m.name }));
    if (list.length === 0) {
      const p = document.createElement("p");
      p.textContent = "モーフがありません";
      host.appendChild(p);
      return;
    }

    const note = document.createElement("p");
    note.textContent = "モーション再生中は上書きされます";
    host.appendChild(note);

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "全て0に戻す";
    resetBtn.onclick = () => {
      const r = activeModelStore.get();
      if (!r) return;
      try {
        getMmdModel(this.scene, r).morph.resetMorphWeights();
      } catch {
        /* ignore */
      }
      this.rerender();
    };
    host.appendChild(resetBtn);

    for (const { index, name } of list) {
      const item = document.createElement("div");
      item.className = "morph-item";
      const head = document.createElement("div");
      head.className = "morph-head";
      const nm = document.createElement("span");
      nm.textContent = name;
      const val = document.createElement("span");
      val.className = "morph-value";
      let current = 0;
      try {
        current = model.morph.getMorphWeightFromIndex(index) ?? 0;
      } catch {
        current = 0;
      }
      val.textContent = current.toFixed(2);
      head.append(nm, val);

      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "0";
      slider.max = "1";
      slider.step = "0.01";
      slider.value = String(Math.min(1, Math.max(0, current)));
      slider.setAttribute("aria-label", name);
      slider.oninput = () => {
        const v = Number(slider.value);
        try {
          model.morph.setMorphWeightFromIndex(index, v);
        } catch {
          /* ignore */
        }
        val.textContent = v.toFixed(2);
      };
      item.append(head, slider);
      host.appendChild(item);
    }
  }

  private rerender(): void {
    if (this.host) this.render(this.host);
  }
}
