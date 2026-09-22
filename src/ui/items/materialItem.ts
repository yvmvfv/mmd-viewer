import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { activeModelStore } from "../../state/activeModel";
import type { MenuItem } from "../menuRegistry";

interface MaterialRow {
  key: string;
  name: string;
  meshes: AbstractMesh[];
}

/** マテリアル透明度編集：マテリアルごとの表示/非表示（基本すべて表示） */
export class MaterialItem implements MenuItem {
  readonly id = "material-opacity";
  readonly title = "マテリアル透明度編集";
  readonly icon = "◑";
  readonly requiresModel = true;
  private host: HTMLElement | null = null;

  render(host: HTMLElement): void {
    this.host = host;
    host.innerHTML = "";

    const h = document.createElement("h3");
    h.textContent = "マテリアル透明度編集";
    host.appendChild(h);

    const root = activeModelStore.get();
    if (!root) {
      const p = document.createElement("p");
      p.textContent = "操作中モデルがありません";
      host.appendChild(p);
      return;
    }

    const rows = this.collect(root.metadata?.meshes ?? ([] as AbstractMesh[]));
    if (rows.length === 0) {
      const p = document.createElement("p");
      p.textContent = "マテリアルがありません";
      host.appendChild(p);
      return;
    }

    const allBtn = document.createElement("button");
    allBtn.textContent = "全て表示";
    allBtn.onclick = () => {
      for (const r of rows) for (const m of r.meshes) m.isVisible = true;
      this.rerender();
    };
    host.appendChild(allBtn);

    const card = document.createElement("div");
    card.className = "scene-card";
    for (const r of rows) {
      const visible = r.meshes.every((m) => m.isVisible);
      const row = document.createElement("div");
      row.className = "lib-row";
      const info = document.createElement("span");
      info.className = "lib-info";
      info.title = r.name;
      const nm = document.createElement("span");
      nm.className = "lib-name";
      nm.textContent = r.name;
      info.appendChild(nm);

      const toggleBtn = document.createElement("button");
      toggleBtn.className = `switch${visible ? " on" : ""}`;
      toggleBtn.textContent = visible ? "ON" : "OFF";
      toggleBtn.onclick = () => {
        const next = !r.meshes.every((m) => m.isVisible);
        for (const m of r.meshes) m.isVisible = next;
        this.rerender();
      };
      row.append(info, toggleBtn);
      card.appendChild(row);
    }
    host.appendChild(card);
  }

  private collect(meshes: readonly AbstractMesh[]): MaterialRow[] {
    const map = new Map<string, MaterialRow>();
    for (const m of meshes) {
      const mat = m.material;
      const key = mat ? `mat:${mat.name}` : `mesh:${m.name}`;
      const name = mat?.name || m.name || "名称未設定";
      let row = map.get(key);
      if (!row) {
        row = { key, name, meshes: [] };
        map.set(key, row);
      }
      row.meshes.push(m);
    }
    return [...map.values()];
  }

  private rerender(): void {
    if (this.host) this.render(this.host);
  }
}
