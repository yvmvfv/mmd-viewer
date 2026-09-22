import { Layer } from "@babylonjs/core/Layers/layer";
import type { Scene } from "@babylonjs/core/scene";

let current: { layer: Layer; url: string } | null = null;

/**
 * 画面奥に画像を張り付け（全画面レイヤー＝常にカメラ平行・常時表示）。
 * nullで解除（背景色に戻る）。
 */
export function setBackgroundImage(scene: Scene, file: File | null): void {
  if (current) {
    try {
      current.layer.texture?.dispose();
    } catch {
      /* ignore */
    }
    current.layer.dispose();
    URL.revokeObjectURL(current.url);
    current = null;
  }
  if (!file) return;
  const url = URL.createObjectURL(file);
  const layer = new Layer("background", url, scene, true);
  current = { layer, url };
}

export function hasBackgroundImage(): boolean {
  return current !== null;
}
