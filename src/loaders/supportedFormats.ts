/** 第一機能は「見ること」。対応形式はbabylon-mmdの範囲で受け付ける */
export const MODEL_EXTS = [".pmx", ".pmd", ".bpmx"] as const;
export const MOTION_EXTS = [".vmd", ".vpd", ".bvmd"] as const; // 将来用(現状は読み込みのみ予約)

/** モデル表示に必要なアセット（モデル本体＋テクスチャ系） */
export const ASSET_EXTS = [
  ".pmx", ".pmd", ".bpmx",
  ".png", ".jpg", ".jpeg", ".bmp", ".tga", ".dds",
  ".sph", ".spa",
] as const;

/** 将来のモーション/音声用に保存しておく拡張子 */
export const SAVE_EXTRA_EXTS = [".vmd", ".vpd", ".bvmd", ".mp3", ".wav"] as const;

export function hasModelExt(name: string): boolean {
  const n = name.toLowerCase();
  return (MODEL_EXTS as readonly string[]).some((e) => n.endsWith(e));
}

/** 保存・展開対象のアセットか（説明書・動画等のゴミを除外） */
export function isAssetFile(name: string, rel = ""): boolean {
  const targets = [...ASSET_EXTS, ...SAVE_EXTRA_EXTS] as readonly string[];
  const n = name.toLowerCase();
  const r = rel.toLowerCase();
  return targets.some((e) => n.endsWith(e) || (r !== "" && r.endsWith(e)));
}
