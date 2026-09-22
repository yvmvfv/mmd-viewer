import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { loadMmdFromFiles, pickModelFiles } from "../../loaders/mmdLoaderService";
import { isAssetFile } from "../../loaders/supportedFormats";
import { isZipFile, unzipToFiles } from "../../loaders/zipLoader";
import { focusCameraOnMesh } from "../../scene/camera";
import { DEFAULT_OUTLINE_WIDTH, setOutlineWidth } from "../../scene/modelAdjust";
import { forgetModel, getMmdModel } from "../../motion/motionService";
import type { SceneManager } from "../../scene/sceneManager";
import type { MmdMesh } from "babylon-mmd/esm/Runtime/mmdMesh";
import { activeModelStore } from "../../state/activeModel";
import { modelPresence } from "../../state/presence";
import {
  deleteSavedModel,
  getModelFiles,
  listSavedModels,
  rootNameOf,
  saveModel,
  type SavedModelMeta,
} from "../../library/modelLibrary";
import type { MenuItem } from "../menuRegistry";

interface SceneModelEntry {
  id: number;
  fileName: string;
  container: AssetContainer;
  root: MmdMesh;
  sourceFiles: File[];
  sourceModel: File;
}

interface PendingCandidates {
  files: File[];
  models: File[];
}

function formatSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

let nextId = 1;

/** 第一機能: モデル表示（複数）・選択・再読込・削除 */
export class ModelLoadItem implements MenuItem {
  readonly id = "model-load";
  readonly title = "モデル";
  readonly icon = "⧉";
  private models: SceneModelEntry[] = [];
  private activeId: number | null = null;
  private host: HTMLElement | null = null;
  private status: string = "未読み込み";
  private candidates: PendingCandidates | null = null;
  private library: SavedModelMeta[] | null = null;
  private libraryLoading = false;

  constructor(private manager: SceneManager) {}

  private get scene() {
    return this.manager.scene;
  }

  private setupShadows(root: MmdMesh): void {
    for (const m of root.metadata?.meshes ?? []) m.receiveShadows = true;
    this.manager.shadowGenerator.addShadowCaster(root, true);
  }

  private teardownShadows(root: MmdMesh): void {
    try {
      this.manager.shadowGenerator.removeShadowCaster(root, true);
    } catch {
      /* ignore */
    }
  }

  render(host: HTMLElement): void {
    this.host = host;
    host.innerHTML = "";

    const h = document.createElement("h3");
    h.textContent = "モデルファイル読み込み";
    host.appendChild(h);

    if (this.models.length === 0) {
      const guide = document.createElement("div");
      guide.className = "guide-card";
      guide.innerHTML = "<div class=\"guide-title\">まずモデルを表示しましょう</div><div class=\"guide-sub\">モデルを追加すると、モーションや調整機能が利用できるようになります。</div>";
      host.appendChild(guide);
    } else {
      host.appendChild(this.buildSceneCard());
    }

    const group = document.createElement("div");
    group.className = "add-group";
    const groupTitle = document.createElement("div");
    groupTitle.className = "add-group-title";
    groupTitle.textContent = "モデルを追加";
    group.appendChild(groupTitle);

    const fileBtn = document.createElement("button");
    fileBtn.className = "add-row";
    fileBtn.innerHTML = "<span>モデルを追加<br><small>BPMX / PMX / ZIP</small></span><span>›</span>";
    const folderBtn = document.createElement("button");
    folderBtn.className = "add-row sub";
    folderBtn.innerHTML = "<span>PMX構成フォルダアップロード</span><span>›</span>";
    group.append(fileBtn, folderBtn);

    const folderInput = document.createElement("input");
    folderInput.type = "file";
    folderInput.setAttribute("webkitdirectory", "");
    folderInput.setAttribute("directory", "");
    folderInput.hidden = true;
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".pmx,.pmd,.bpmx,.zip";
    fileInput.hidden = true;

    const statusEl = document.createElement("div");
    statusEl.className = "status";
    statusEl.textContent = this.status;

    folderBtn.onclick = () => folderInput.click();
    fileBtn.onclick = () => fileInput.click();
    // FileListはinputの再描画・リセットで無効化されるため、同期的に配列へ退避する
    folderInput.onchange = () => {
      const files = folderInput.files ? Array.from(folderInput.files) : [];
      folderInput.value = "";
      void this.handleFiles(files);
    };
    fileInput.onchange = () => {
      const files = fileInput.files ? Array.from(fileInput.files) : [];
      fileInput.value = "";
      void this.handleFiles(files);
    };

    host.append(group);

    if (this.candidates && this.candidates.models.length > 1) {
      host.appendChild(this.buildCandidateCard());
    }

    host.appendChild(this.buildLibraryCard());

    host.append(statusEl, folderInput, fileInput);
  }

  private buildSceneCard(): HTMLElement {
    const card = document.createElement("div");
    card.className = "scene-card";
    const title = document.createElement("div");
    title.className = "scene-title";
    title.textContent = "シーンのモデル";
    card.appendChild(title);

    for (const m of this.models) {
      const row = document.createElement("div");
      row.className = "scene-row";

      const name = document.createElement("span");
      name.className = "scene-name";
      name.textContent = `⦿ ${m.fileName}`;
      name.title = m.fileName;

      const stateBtn = document.createElement("button");
      stateBtn.className = "scene-state" + (m.id === this.activeId ? " active" : "");
      stateBtn.textContent = m.id === this.activeId ? "操作中" : "選択";
      stateBtn.onclick = () => {
        this.activeId = m.id;
        this.rerender();
      };

      const reloadBtn = document.createElement("button");
      reloadBtn.className = "scene-icon-btn";
      reloadBtn.textContent = "⟳";
      reloadBtn.title = "再読込";
      reloadBtn.onclick = () => void this.reload(m.id);

      const delBtn = document.createElement("button");
      delBtn.className = "scene-icon-btn danger";
      delBtn.textContent = "×";
      delBtn.title = "削除";
      delBtn.onclick = () => this.remove(m.id);

      row.append(name, stateBtn, reloadBtn, delBtn);
      card.appendChild(row);
    }
    return card;
  }

  /** ZIP等に複数モデルがある場合の選択肢（名前＋サイズ） */
  private buildCandidateCard(): HTMLElement {
    const card = document.createElement("div");
    card.className = "scene-card";
    const title = document.createElement("div");
    title.className = "scene-title";
    title.textContent = "読み込むモデルを選択";
    card.appendChild(title);

    const files = this.candidates!.files;
    for (const m of this.candidates!.models) {
      const btn = document.createElement("button");
      btn.className = "candidate-row";
      const label = m.webkitRelativePath || m.name;
      btn.innerHTML = `<span class="candidate-name"></span><span class="candidate-size">${formatSize(m.size)}</span>`;
      (btn.querySelector(".candidate-name") as HTMLElement).textContent = label;
      btn.title = label;
      btn.onclick = () => void this.loadModel(files, m);
      card.appendChild(btn);
    }
    return card;
  }

  /** 端末内保存済みモデル（名前＋サイズ＋再追加/削除） */
  private buildLibraryCard(): HTMLElement {
    const card = document.createElement("div");
    card.className = "scene-card";
    const title = document.createElement("div");
    title.className = "scene-title";
    title.textContent = "保存済みモデル";
    card.appendChild(title);

    if (this.library === null) {
      const p = document.createElement("div");
      p.className = "status";
      p.textContent = "保存モデル確認中…";
      card.appendChild(p);
      void this.refreshLibrary();
      return card;
    }
    if (this.library.length === 0) {
      const p = document.createElement("div");
      p.className = "status";
      p.textContent = "読み込んだモデルは自動で端末内に保存されます";
      card.appendChild(p);
      return card;
    }
    for (const m of this.library) {
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

      const addBtn = document.createElement("button");
      addBtn.className = "lib-add";
      addBtn.textContent = "シーンへ追加";
      addBtn.onclick = () => void this.libraryAdd(m.id);

      const delBtn = document.createElement("button");
      delBtn.className = "scene-icon-btn danger";
      delBtn.textContent = "×";
      delBtn.title = "保存から削除";
      delBtn.onclick = () => void this.libraryDelete(m.id);

      row.append(info, addBtn, delBtn);
      card.appendChild(row);
    }
    return card;
  }

  private async refreshLibrary(): Promise<void> {
    if (this.libraryLoading) return;
    this.libraryLoading = true;
    try {
      const list = await listSavedModels();
      const key = list.map((m) => `${m.id}:${m.size}`).join("|");
      const cur = (this.library ?? []).map((m) => `${m.id}:${m.size}`).join("|");
      if (key !== cur) {
        this.library = list;
        this.rerender();
      } else if (this.library === null) {
        this.library = list;
        this.rerender();
      }
    } catch {
      // 保存未対応端末では一覧を出さない
      if (this.library === null) {
        this.library = [];
        this.rerender();
      }
    } finally {
      this.libraryLoading = false;
    }
  }

  private async libraryAdd(id: string): Promise<void> {
    try {
      this.status = "保存データ展開中…";
      this.rerender();
      const files = await getModelFiles(id);
      await this.importFiles(files);
    } catch (e) {
      this.status = `失敗: ${e instanceof Error ? e.message : String(e)}`;
    }
    this.rerender();
  }

  private async libraryDelete(id: string): Promise<void> {
    try {
      await deleteSavedModel(id);
      this.library = (this.library ?? []).filter((m) => m.id !== id);
    } catch (e) {
      this.status = `削除失敗: ${e instanceof Error ? e.message : String(e)}`;
    }
    this.rerender();
  }

  private async handleFiles(list: File[]): Promise<void> {
    if (list.length === 0) return;
    try {
      this.status = "読み込み中…";
      this.rerender();
      let files = list;
      if (files.length === 1 && isZipFile(files[0].name)) {
        this.status = "ZIP展開中…";
        this.rerender();
        files = await unzipToFiles(files[0]);
      }
      await this.importFiles(files);
    } catch (e) {
      this.status = `失敗: ${e instanceof Error ? e.message : String(e)}`;
    }
    this.rerender();
  }

  /** 候補抽出→単一は即読込・複数は選択表示（保存/シーンの両入口で共用） */
  private async importFiles(files: File[]): Promise<void> {
    const found = pickModelFiles(files);
    if (found.length === 0) throw new Error("フォルダ内に .pmx / .pmd / .bpmx が見つかりません");
    if (found.length > 1) {
      // 複数候補は一覧から選ばせる
      this.candidates = { files, models: found };
      this.status = `${found.length}件のモデルを検出：選択してください`;
      this.rerender();
      return;
    }
    await this.loadModel(files, found[0]);
  }

  private async loadModel(files: File[], modelFile: File): Promise<void> {
    try {
      this.status = "読み込み中…";
      this.rerender();
      const loaded = await loadMmdFromFiles(files, this.scene, modelFile);
      this.setupShadows(loaded.root);
      setOutlineWidth(loaded.root, DEFAULT_OUTLINE_WIDTH);
      try {
        // 読込時点でランタイム登録（待機中も物理が効く）
        getMmdModel(this.scene, loaded.root);
      } catch {
        /* ignore */
      }
      const entry: SceneModelEntry = {
        id: nextId++,
        fileName: loaded.fileName,
        container: loaded.container,
        root: loaded.root,
        sourceFiles: files,
        sourceModel: modelFile,
      };
      this.models.push(entry);
      this.activeId = entry.id;
      this.candidates = null; // 読込後は候補を消す
      focusCameraOnMesh(this.scene, loaded.root);
      this.status = `表示中: ${loaded.fileName}（全${this.models.length}件）`;
      try {
        // 保存は表示に必要なアセットのみ（説明書・動画等のゴミを除外して軽量化）
        const assets = files.filter((f) => isAssetFile(f.name, f.webkitRelativePath || ""));
        await saveModel(rootNameOf(files, modelFile), assets.length > 0 ? assets : files);
        void this.refreshLibrary();
      } catch {
        // 保存失敗時は表示のみ継続
      }
    } catch (e) {
      this.status = `失敗: ${e instanceof Error ? e.message : String(e)}`;
    }
    this.rerender();
  }

  private async reload(id: number): Promise<void> {
    const idx = this.models.findIndex((m) => m.id === id);
    if (idx < 0) return;
    const old = this.models[idx];
    try {
      this.status = `再読込中: ${old.fileName}`;
      this.rerender();
      this.teardownShadows(old.root);
      old.container.removeAllFromScene();
      old.container.dispose();
      const loaded = await loadMmdFromFiles(old.sourceFiles, this.scene, old.sourceModel);
      this.setupShadows(loaded.root);
      setOutlineWidth(loaded.root, DEFAULT_OUTLINE_WIDTH);
      this.models[idx] = { ...old, container: loaded.container, root: loaded.root };
      this.status = `表示中: ${loaded.fileName}`;
    } catch (e) {
      this.status = `失敗: ${e instanceof Error ? e.message : String(e)}`;
    }
    this.rerender();
  }

  private remove(id: number): void {
    const idx = this.models.findIndex((m) => m.id === id);
    if (idx < 0) return;
    const [old] = this.models.splice(idx, 1);
    this.teardownShadows(old.root);
    forgetModel(old.root);
    old.container.removeAllFromScene();
    old.container.dispose();
    if (this.activeId === id) this.activeId = this.models.length > 0 ? this.models[this.models.length - 1].id : null;
    this.status = this.models.length === 0 ? "未読み込み" : `全${this.models.length}件`;
    this.rerender();
  }

  private rerender(): void {
    modelPresence.set(this.models.length > 0);
    activeModelStore.set(this.models.find((m) => m.id === this.activeId)?.root ?? null);
    if (this.host) this.render(this.host);
  }
}
