import { modelPresence } from "../state/presence";

/** メニュー項目の拡張ポイント。後から足す場合はここに登録するだけ */
export interface MenuItem {
  id: string;
  title: string;
  icon: string;
  /** trueならモデル読込時のみ表示 */
  requiresModel?: boolean;
  render(host: HTMLElement): void;
}

export class MenuRegistry {
  private items: MenuItem[] = [];
  private activeId: string | null = null;
  private host: HTMLElement | null = null;

  register(item: MenuItem): void {
    this.items.push(item);
    if (!this.activeId) this.activeId = item.id;
  }

  private visibleItems(): MenuItem[] {
    const has = modelPresence.get();
    return this.items.filter((i) => !i.requiresModel || has);
  }

  renderAll(host: HTMLElement): void {
    this.host = host;
    this.render();
  }

  /** モデル有無の変化などで表示を更新（選択状態は維持） */
  refresh(): void {
    this.render();
  }

  private render(): void {
    const host = this.host;
    if (!host) return;
    const rail = host.querySelector<HTMLElement>("#menuRail");
    const detail = host.querySelector<HTMLElement>("#menuDetail");
    if (!rail || !detail) return;
    rail.innerHTML = "";
    detail.innerHTML = "";

    const visible = this.visibleItems();
    if (!visible.some((i) => i.id === this.activeId)) {
      this.activeId = visible[0]?.id ?? null;
    }

    for (const item of visible) {
      const btn = document.createElement("button");
      btn.className = "rail-button";
      btn.dataset.menuId = item.id;
      btn.title = item.title;
      btn.setAttribute("aria-label", item.title);
      btn.textContent = item.icon;
      btn.classList.toggle("active", item.id === this.activeId);
      btn.onclick = () => {
        this.activeId = item.id;
        this.render();
      };
      rail.appendChild(btn);
    }

    const active = visible.find((i) => i.id === this.activeId) ?? visible[0];
    if (!active) return;
    const section = document.createElement("section");
    section.className = "menu-section";
    section.dataset.menuId = active.id;
    active.render(section);
    detail.appendChild(section);
  }
}
