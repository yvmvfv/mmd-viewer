import type { MenuItem } from "../menuRegistry";

/** 未実装項目の形だけ表示。実装時にこのクラスを本物に置き換える */
export class FutureItem implements MenuItem {
  constructor(
    readonly id: string,
    readonly title: string,
    readonly icon: string,
    readonly requiresModel: boolean = false,
  ) {}

  render(host: HTMLElement): void {
    const h = document.createElement("h3");
    h.textContent = this.title;
    const p = document.createElement("p");
    p.textContent = "準備中（表示のみ）";
    host.append(h, p);
  }
}

/** 指定順のまま返す。()付きはモデル読込時のみ表示 */
export function createFutureItems(): MenuItem[] {
  return [
    // モデル系・撮影は実装済み
    new FutureItem("floor-reflection", "床の反射", "▤"),
    new FutureItem("advanced", "高度な設定", "✦"),
    // カメラ設定はCameraItem（実装済み）が入る
    new FutureItem("follow-model", "モデル追随", "➤", true),
    new FutureItem("first-person", "一人称視点", "◉", true),
    new FutureItem("art-focus", "アートフォーカス", "◎", true),
    new FutureItem("animation-settings", "アニメーション設定", "🎬"),
  ];
}
