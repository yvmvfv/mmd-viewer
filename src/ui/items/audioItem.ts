import type { Scene } from "@babylonjs/core/scene";
import { setAudioFile } from "../../motion/motionService";
import { audioLibrary, type SavedModelMeta } from "../../library/modelLibrary";
import type { MenuItem } from "../menuRegistry";

function formatSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

let nextId = 1;

interface AudioEntry {
  id: number;
  name: string;
  size: number;
  file: File;
}

/** 音声選択：シークバー連動の同期再生（不足分はそのまま終了） */
export class AudioItem implements MenuItem {
  readonly id = "audio-select";
  readonly title = "音声選択";
  readonly icon = "♪";
  readonly requiresModel = true;
  private audios: AudioEntry[] = [];
  private appliedId: number | null = null;
  private status = "未適用";
  private host: HTMLElement | null = null;
  private saved: SavedModelMeta[] | null = null;
  private savedLoading = false;

  constructor(private scene: Scene) {}

  render(host: HTMLElement): void {
    this.host = host;
    host.innerHTML = "";

    const h = document.createElement("h3");
    h.textContent = "音声選択";
    host.appendChild(h);

    const group = document.createElement("div");
    group.className = "add-group";
    const addBtn = document.createElement("button");
    addBtn.className = "add-row";
    addBtn.innerHTML = "<span>音声を追加<br><small>MP3 / WAV</small></span><span>›</span>";
    group.appendChild(addBtn);

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*,.mp3,.wav";
    // iOS安全パターン: hidden属性ではなく画面外の透明配置＋単一選択
    input.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;";

    const stopRow = document.createElement("div");
    stopRow.className = "add-group";
    const stopBtn = document.createElement("button");
    stopBtn.className = "add-row sub";
    stopBtn.innerHTML = "<span>音声停止</span><span>›</span>";
    stopRow.appendChild(stopBtn);

    const statusEl = document.createElement("div");
    statusEl.className = "status";
    statusEl.textContent = this.status;

    addBtn.onclick = () => input.click();
    input.onchange = () => {
      const files = input.files ? Array.from(input.files) : [];
      input.value = "";
      if (files.length > 0) {
        this.audios.push({ id: nextId++, name: files[0].name, size: files[0].size, file: files[0] });
        this.status = `${this.audios.length}件の音声`;
        void (async () => {
          try {
            await audioLibrary.save(files[0].name, [files[0]]);
            await this.refreshSaved();
          } catch {
            /* 保存失敗時は表示のみ継続 */
          }
        })();
        this.rerender();
      }
    };
    stopBtn.onclick = () => {
      void (async () => {
        try {
          await setAudioFile(this.scene, null);
          this.appliedId = null;
          this.status = "停止中";
        } catch (e) {
          this.status = `失敗: ${e instanceof Error ? e.message : String(e)}`;
        }
        this.rerender();
      })();
    };

    host.append(group, stopRow);

    if (this.audios.length > 0) {
      const card = document.createElement("div");
      card.className = "scene-card";
      for (const a of this.audios) {
        const row = document.createElement("div");
        row.className = "lib-row";
        const info = document.createElement("span");
        info.className = "lib-info";
        info.title = a.name;
        const nm = document.createElement("span");
        nm.className = "lib-name";
        nm.textContent = `${a.name}${a.id === this.appliedId ? "（適用中）" : ""}`;
        const sz = document.createElement("span");
        sz.className = "lib-size";
        sz.textContent = formatSize(a.size);
        info.append(nm, sz);

        const applyBtn = document.createElement("button");
        applyBtn.className = "lib-add";
        applyBtn.textContent = "適用";
        applyBtn.onclick = () => void this.apply(a.id);

        const delBtn = document.createElement("button");
        delBtn.className = "scene-icon-btn danger";
        delBtn.textContent = "×";
        delBtn.title = "削除";
        delBtn.onclick = () => {
          this.audios = this.audios.filter((x) => x.id !== a.id);
          if (this.appliedId === a.id) {
            this.appliedId = null;
            void setAudioFile(this.scene, null);
          }
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

  /** 端末内保存済み音声 */
  private buildSavedCard(): HTMLElement {
    const card = document.createElement("div");
    card.className = "scene-card";
    const title = document.createElement("div");
    title.className = "scene-title";
    title.textContent = "保存済み音声";
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
      p.textContent = "追加した音声は自動で端末内に保存されます";
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
      const list = await audioLibrary.list();
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
    try {
      this.status = "保存データ展開中…";
      this.rerender();
      const files = await audioLibrary.getFiles(id);
      if (files.length === 0) throw new Error("保存データが空です");
      await setAudioFile(this.scene, files[0]);
      const entry: AudioEntry = { id: nextId++, name: files[0].name, size: files[0].size, file: files[0] };
      this.audios.push(entry);
      this.appliedId = entry.id;
      this.status = `適用中: ${entry.name}`;
    } catch (e) {
      this.status = `失敗: ${e instanceof Error ? e.message : String(e)}`;
    }
    this.rerender();
  }

  private async deleteSaved(id: string): Promise<void> {
    try {
      await audioLibrary.remove(id);
      this.saved = (this.saved ?? []).filter((m) => m.id !== id);
    } catch (e) {
      this.status = `削除失敗: ${e instanceof Error ? e.message : String(e)}`;
    }
    this.rerender();
  }

  private async apply(id: number): Promise<void> {
    const entry = this.audios.find((a) => a.id === id);
    if (!entry) return;
    try {
      this.status = "音声読み込み中…";
      this.rerender();
      await setAudioFile(this.scene, entry.file);
      this.appliedId = id;
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
