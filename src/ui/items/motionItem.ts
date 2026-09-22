import type { Scene } from "@babylonjs/core/scene";
import type { MmdAnimation } from "babylon-mmd/esm/Loader/Animation/mmdAnimation";
import {
  applyMotion,
  isMotionPlaying,
  loadVmdFile,
  setMotionApplied,
  setMotionPlaying,
  stopMotion,
  subscribePlaying,
} from "../../motion/motionService";
import { activeModelStore } from "../../state/activeModel";
import { motionLibrary, type SavedModelMeta } from "../../library/modelLibrary";
import type { MenuItem } from "../menuRegistry";

function formatSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

let nextId = 1;

interface MotionEntry {
  id: number;
  name: string;
  size: number;
  anim: MmdAnimation;
}

/** モーション選択：VMD読込・適用・再生/停止 */
export class MotionItem implements MenuItem {
  readonly id = "motion-select";
  readonly title = "モーション選択";
  readonly icon = "▶";
  readonly requiresModel = true;
  private motions: MotionEntry[] = [];
  private appliedId: number | null = null;
  private status = "未適用";
  private host: HTMLElement | null = null;
  private playingSub: (() => void) | null = null;
  private saved: SavedModelMeta[] | null = null;
  private savedLoading = false;

  constructor(private scene: Scene) {}

  render(host: HTMLElement): void {
    this.host = host;
    host.innerHTML = "";
    if (!this.playingSub) this.playingSub = subscribePlaying(() => this.rerender());

    const h = document.createElement("h3");
    h.textContent = "モーション選択";
    host.appendChild(h);

    const group = document.createElement("div");
    group.className = "add-group";
    const addBtn = document.createElement("button");
    addBtn.className = "add-row";
    addBtn.innerHTML = "<span>VMDを追加<br><small>VMD</small></span><span>›</span>";
    group.appendChild(addBtn);

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".vmd";
    // iOS安全パターン: hidden属性ではなく画面外の透明配置＋単一選択
    input.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;";

    const playRow = document.createElement("div");
    playRow.className = "add-group";
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "add-row sub";
    toggleBtn.innerHTML = `<span>${isMotionPlaying(this.scene) ? "一時停止" : "再生"}</span><span>›</span>`;
    const stopBtn = document.createElement("button");
    stopBtn.className = "add-row sub";
    stopBtn.innerHTML = "<span>モーション停止</span><span>›</span>";
    playRow.append(toggleBtn, stopBtn);

    const statusEl = document.createElement("div");
    statusEl.className = "status";
    statusEl.textContent = this.status;

    addBtn.onclick = () => input.click();
    input.onchange = () => {
      const files = input.files ? Array.from(input.files) : [];
      input.value = "";
      void this.handleFiles(files);
    };
    toggleBtn.onclick = () => {
      setMotionPlaying(this.scene, !isMotionPlaying(this.scene));
      this.rerender();
    };
    stopBtn.onclick = () => {
      const root = activeModelStore.get();
      if (root) stopMotion(root);
      this.appliedId = null;
      setMotionApplied(false);
      this.status = "停止中";
      this.rerender();
    };

    host.append(group, playRow);

    if (this.motions.length > 0) {
      const card = document.createElement("div");
      card.className = "scene-card";
      for (const m of this.motions) {
        const row = document.createElement("div");
        row.className = "lib-row";
        const info = document.createElement("span");
        info.className = "lib-info";
        info.title = m.name;
        const nm = document.createElement("span");
        nm.className = "lib-name";
        nm.textContent = `${m.name}${m.id === this.appliedId ? "（適用中）" : ""}`;
        const sz = document.createElement("span");
        sz.className = "lib-size";
        sz.textContent = formatSize(m.size);
        info.append(nm, sz);

        const applyBtn = document.createElement("button");
        applyBtn.className = "lib-add";
        applyBtn.textContent = "適用";
        applyBtn.onclick = () => this.apply(m.id);

        const delBtn = document.createElement("button");
        delBtn.className = "scene-icon-btn danger";
        delBtn.textContent = "×";
        delBtn.title = "削除";
        delBtn.onclick = () => {
          this.motions = this.motions.filter((x) => x.id !== m.id);
          if (this.appliedId === m.id) this.appliedId = null;
          this.rerender();
        };
        row.append(info, applyBtn, delBtn);
        card.appendChild(row);
      }
      host.appendChild(card);
    }

    host.appendChild(this.buildSavedCard());

    host.append(statusEl, input);
  }

  /** 端末内保存済みモーション */
  private buildSavedCard(): HTMLElement {
    const card = document.createElement("div");
    card.className = "scene-card";
    const title = document.createElement("div");
    title.className = "scene-title";
    title.textContent = "保存済みモーション";
    card.appendChild(title);

    if (this.saved === null) {
      const p = document.createElement("div");
      p.className = "status";
      p.textContent = "保存データ確認中…";
      card.appendChild(p);
      void this.refreshSaved();
      return card;
    }
    if (this.saved.length === 0) {
      const p = document.createElement("div");
      p.className = "status";
      p.textContent = "読み込んだモーションは自動で端末内に保存されます";
      card.appendChild(p);
      return card;
    }
    for (const m of this.saved) {
      const row = document.createElement("div");
      row.className = "lib-row";
      const info = document.createElement("span");
      info.className = "lib-info";
      info.title = m.name;
      const nm = document.createElement("span");
      nm.className = "lib-name";
      nm.textContent = m.name;
      const sz = document.createElement("span");
      sz.className = "lib-size";
      sz.textContent = formatSize(m.size);
      info.append(nm, sz);

      const applyBtn = document.createElement("button");
      applyBtn.className = "lib-add";
      applyBtn.textContent = "適用";
      applyBtn.onclick = () => void this.applySaved(m.id);

      const delBtn = document.createElement("button");
      delBtn.className = "scene-icon-btn danger";
      delBtn.textContent = "×";
      delBtn.title = "保存から削除";
      delBtn.onclick = () => void this.deleteSaved(m.id);
      row.append(info, applyBtn, delBtn);
      card.appendChild(row);
    }
    return card;
  }

  private async refreshSaved(): Promise<void> {
    if (this.savedLoading) return;
    this.savedLoading = true;
    try {
      const list = await motionLibrary.list();
      const key = list.map((m) => `${m.id}:${m.size}`).join("|");
      const cur = (this.saved ?? []).map((m) => `${m.id}:${m.size}`).join("|");
      if (this.saved === null || key !== cur) {
        this.saved = list;
        this.rerender();
      }
    } catch {
      if (this.saved === null) {
        this.saved = [];
        this.rerender();
      }
    } finally {
      this.savedLoading = false;
    }
  }

  private async applySaved(id: string): Promise<void> {
    const root = activeModelStore.get();
    if (!root) {
      this.status = "操作中モデルがありません";
      this.rerender();
      return;
    }
    try {
      this.status = "保存データ展開中…";
      this.rerender();
      const files = await motionLibrary.getFiles(id);
      if (files.length === 0) throw new Error("保存データが空です");
      const anim = await loadVmdFile(this.scene, files[0]);
      const entry: MotionEntry = { id: nextId++, name: files[0].name, size: files[0].size, anim };
      this.motions.push(entry);
      this.apply(entry.id);
    } catch (e) {
      this.status = `失敗: ${e instanceof Error ? e.message : String(e)}`;
      this.rerender();
    }
  }

  private async deleteSaved(id: string): Promise<void> {
    try {
      await motionLibrary.remove(id);
      this.saved = (this.saved ?? []).filter((m) => m.id !== id);
    } catch (e) {
      this.status = `削除失敗: ${e instanceof Error ? e.message : String(e)}`;
    }
    this.rerender();
  }

  private async handleFiles(files: File[]): Promise<void> {
    if (files.length === 0) return;
    try {
      this.status = "VMD読み込み中…";
      this.rerender();
      for (const f of files) {
        const anim = await loadVmdFile(this.scene, f);
        this.motions.push({ id: nextId++, name: f.name, size: f.size, anim });
        try {
          await motionLibrary.save(f.name, [f]);
        } catch {
          /* 保存失敗時は表示のみ継続 */
        }
      }
      this.status = `${this.motions.length}件のモーション`;
      void this.refreshSaved();
    } catch (e) {
      this.status = `失敗: ${e instanceof Error ? e.message : String(e)}`;
    }
    this.rerender();
  }

  private apply(id: number): void {
    const entry = this.motions.find((m) => m.id === id);
    const root = activeModelStore.get();
    if (!entry || !root) {
      this.status = "操作中モデルがありません";
      this.rerender();
      return;
    }
    try {
      applyMotion(this.scene, root, entry.anim);
      this.appliedId = id;
      setMotionApplied(true);
      this.status = `適用中: ${entry.name}`;
    } catch (e) {
      this.status = `失敗: ${e instanceof Error ? e.message : String(e)}`;
    }
    this.rerender();
  }

  private rerender(): void {
    if (this.host) this.render(this.host);
  }
}
