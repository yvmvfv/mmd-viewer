import { DEFAULT_OUTLINE_WIDTH, setFaceShadowEnabled, setOutlineWidth } from "../../scene/modelAdjust";
import { activeModelStore } from "../../state/activeModel";
import type { MenuItem } from "../menuRegistry";

const rad2deg = (r: number): number => Math.round((r * 180) / Math.PI * 100) / 100;

/** 操作モデル選択：位置・回転の数値編集＋アウトライン＋顔影 */
export class ActiveModelItem implements MenuItem {
  readonly id = "active-model";
  readonly title = "操作モデル選択";
  readonly icon = "⦿";
  readonly requiresModel = true;
  private host: HTMLElement | null = null;
  private outlineWidth = DEFAULT_OUTLINE_WIDTH;
  private faceShadow = true;
  private canvasHooked = false;

  render(host: HTMLElement): void {
    this.host = host;
    host.innerHTML = "";

    const h = document.createElement("h3");
    h.textContent = "操作モデル選択";
    host.appendChild(h);

    const root = activeModelStore.get();
    if (!root) {
      const p = document.createElement("p");
      p.textContent = "操作中モデルがありません";
      host.appendChild(p);
      return;
    }

    // ドラッグ等での変更を数値へ反映（入力中フォーカスは奪わない）
    if (!this.canvasHooked) {
      this.canvasHooked = true;
      document.getElementById("renderCanvas")?.addEventListener("pointerup", () => this.rerender());
    }

    const name = document.createElement("p");
    name.textContent = "位置・回転（操作中モデル）";
    host.appendChild(name);

    host.appendChild(this.numRow("モデル位置移動 X", root.position.x, (v) => (root.position.x = v)));
    host.appendChild(this.numRow("モデル位置移動 Y", root.position.y, (v) => (root.position.y = v)));
    host.appendChild(this.numRow("モデル位置移動 Z", root.position.z, (v) => (root.position.z = v)));
    host.appendChild(
      this.numRow("モデル回転 X°", rad2deg(root.rotation.x), (v) => (root.rotation.x = (v * Math.PI) / 180), 1),
    );
    host.appendChild(
      this.numRow("モデル回転 Y°", rad2deg(root.rotation.y), (v) => (root.rotation.y = (v * Math.PI) / 180), 1),
    );
    host.appendChild(
      this.numRow("モデル回転 Z°", rad2deg(root.rotation.z), (v) => (root.rotation.z = (v * Math.PI) / 180), 1),
    );

    const outlineLabel = document.createElement("p");
    outlineLabel.textContent = `アウトライン幅 ${this.outlineWidth.toFixed(3)}`;
    const outline = document.createElement("input");
    outline.type = "range";
    outline.min = "0";
    outline.max = "0.05";
    outline.step = "0.001";
    outline.value = String(this.outlineWidth);
    outline.oninput = () => {
      this.outlineWidth = Number(outline.value);
      const r = activeModelStore.get();
      if (r) setOutlineWidth(r, this.outlineWidth);
      outlineLabel.textContent = `アウトライン幅 ${this.outlineWidth.toFixed(3)}`;
    };

    const faceLabel = document.createElement("label");
    faceLabel.className = "check-row";
    const faceCheck = document.createElement("input");
    faceCheck.type = "checkbox";
    faceCheck.checked = !this.faceShadow;
    faceCheck.onchange = () => {
      this.faceShadow = !faceCheck.checked;
      const r = activeModelStore.get();
      if (r) setFaceShadowEnabled(r, this.faceShadow);
    };
    faceLabel.append(faceCheck, document.createTextNode("顔の影表現無効"));

    host.append(outlineLabel, outline, faceLabel);
  }

  private numRow(label: string, value: number, set: (v: number) => void, step = 0.1): HTMLElement {
    const wrap = document.createElement("label");
    wrap.className = "num-row";
    const span = document.createElement("span");
    span.textContent = label;
    const input = document.createElement("input");
    input.type = "number";
    input.step = String(step);
    input.value = String(value);
    input.onchange = () => {
      const v = Number(input.value);
      if (Number.isFinite(v)) set(v);
    };
    wrap.append(span, input);
    return wrap;
  }

  private rerender(): void {
    if (this.host && document.activeElement?.tagName !== "INPUT") this.render(this.host);
  }
}
