import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { Scene } from "@babylonjs/core/scene";
import { RegisterPmxLoader } from "babylon-mmd/esm/Loader/pmxLoader.pure";
import { RegisterPmdLoader } from "babylon-mmd/esm/Loader/pmdLoader.pure";
import { RegisterBpmxLoader } from "babylon-mmd/esm/Loader/Optimized/bpmxLoader.pure";
import { MmdStandardMaterialBuilder } from "babylon-mmd/esm/Loader/mmdStandardMaterialBuilder";
import type { MmdMesh } from "babylon-mmd/esm/Runtime/mmdMesh";
import { hasModelExt } from "./supportedFormats";

let registered = false;
function ensureRegistered(): void {
  if (registered) return;
  RegisterPmxLoader();
  RegisterPmdLoader();
  RegisterBpmxLoader();
  registered = true;
}

export interface LoadedModel {
  container: AssetContainer;
  root: MmdMesh;
  fileName: string;
}

function matchModel(f: File): boolean {
  return hasModelExt(f.name) || hasModelExt(f.webkitRelativePath || "");
}

/** 候補をすべて返す（ZIP内複数pmxの選択表示用） */
export function pickModelFiles(files: File[]): File[] {
  const seen = new Set<string>();
  const out: File[] = [];
  for (const f of files) {
    if (!matchModel(f)) continue;
    const key = f.webkitRelativePath || f.name;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

function rootUrlOf(modelFile: File): string {
  const rel = modelFile.webkitRelativePath || modelFile.name;
  const i = rel.lastIndexOf("/");
  return i >= 0 ? rel.slice(0, i + 1) : "";
}

/**
 * フォルダ選択(推奨) or 単体ファイルからPMX/PMD/BPMXを読み込む。
 * フォルダ選択時は referenceFiles によりテクスチャ解決・大文字小文字差異を吸収する。
 * target指定時はそのモデルを、それ以外は最初の候補を読む。
 */
export async function loadMmdFromFiles(files: File[], scene: Scene, target?: File): Promise<LoadedModel> {
  ensureRegistered();
  const modelFile = target ?? pickModelFiles(files)[0] ?? null;
  if (!modelFile) throw new Error("フォルダ内に .pmx / .pmd / .bpmx が見つかりません");

  const container = await LoadAssetContainerAsync(modelFile, scene, {
    rootUrl: rootUrlOf(modelFile),
    pluginOptions: {
      mmdmodel: {
        materialBuilder: new MmdStandardMaterialBuilder(),
        referenceFiles: files,
        loggingEnabled: false,
      },
    },
  });
  container.addAllToScene();
  // モーションで原点から大きく離れても消えないようカリング除外
  for (const m of container.meshes) m.alwaysSelectAsActiveMesh = true;
  // テクスチャをくっきり: 異方性のみ上げ（sampling変更は再アップロードを招くため触らない）
  const maxAniso = scene.getEngine().getCaps().maxAnisotropy ?? 4;
  const level = Math.min(4, maxAniso);
  for (const tex of container.textures) {
    if (tex.anisotropicFilteringLevel !== level) tex.anisotropicFilteringLevel = level;
  }
  const root = container.meshes[0] as MmdMesh;
  return { container, root, fileName: modelFile.name };
}
