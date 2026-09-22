import type { Scene } from "@babylonjs/core/scene";
import { hasBackgroundImage, setBackgroundImage } from "../../scene/background";
import type { MenuItem } from "../menuRegistry";

function formatSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

/** 背景画像選択：画面奥に固定表示（常にカメラ平行） */
export class BgImageItem implements MenuItem {
  readonly id = "bg-image";
  readonly title = "背景画像選択";
  readonly icon = "▦";
  private fileName: string | null = null;
  private status = "未設定";
  private host: HTMLElement | null = null;

  constructor(private scene: Scene) {}

  render(host: HTMLElement): void {
    this.host = host;
    host.innerHTML = "";

    const h = document.createElement("h3");
    h.textContent = "背景画像選択";
    const p = document.createElement("p");
    p.textContent = "画面奥に固定表示されます";
    host.appendChild(h);

    const group = document.createElement("div");
    group.className = "add-group";
    const addBtn = document.createElement("button");
    addBtn.className = "add-row";
    addBtn.innerHTML = "<span>画像を選択<br><small>PNG / JPG</small></span><span>›</span>";
    const clearBtn = document.createElement("button");
    clearBtn.className = "add-row sub";
    clearBtn.innerHTML = "<span>背景を消す</span><span>›</span>";
    group.append(addBtn, clearBtn);

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.png,.jpg,.jpeg,.webp";
    // iOS安全パターン: hidden属性ではなく画面外の透明配置＋単一選択
    input.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;";

    const statusEl = document.createElement("div");
    statusEl.className = "status";
    statusEl.textContent = this.fileName
      ? `表示中: ${this.fileName}`
      : hasBackgroundImage()
        ? "表示中"
        : this.status;

    addBtn.onclick = () => input.click();
    input.onchange = () => {
      const files = input.files ? Array.from(input.files) : [];
      input.value = "";
      if (files.length === 0) return;
      try {
        setBackgroundImage(this.scene, files[0]);
        this.fileName = `${files[0].name}（${formatSize(files[0].size)}）`;
        this.status = `表示中: ${this.fileName}`;
      } catch (e) {
        this.status = `失敗: ${e instanceof Error ? e.message : String(e)}`;
      }
      this.rerender();
    };
    clearBtn.onclick = () => {
      setBackgroundImage(this.scene, null);
      this.fileName = null;
      this.status = "未設定";
      this.rerender();
    };

    host.append(p, group, statusEl, input);
  }

  private rerender(): void {
    if (this.host) this.render(this.host);
  }
}
