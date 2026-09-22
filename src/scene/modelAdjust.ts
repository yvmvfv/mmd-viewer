import type { MmdMesh } from "babylon-mmd/esm/Runtime/mmdMesh";

export const DEFAULT_OUTLINE_WIDTH = 0.01;

function targetMeshes(root: MmdMesh): { materialName: string; setOutline: (w: number) => void; setReceive: (v: boolean) => void }[] {
  const meshes = root.metadata?.meshes ?? [];
  return meshes.map((m) => ({
    materialName: (m.material?.name ?? "") as string,
    setOutline: (w: number) => {
      m.renderOutline = w > 0;
      m.outlineWidth = w;
      m.outlineColor.copyFromFloats(0, 0, 0);
    },
    setReceive: (v: boolean) => {
      m.receiveShadows = v;
    },
  }));
}

/** アウトライン幅（0で無効） */
export function setOutlineWidth(root: MmdMesh, width: number): void {
  for (const m of targetMeshes(root)) m.setOutline(width);
}

/** 顔の影表現ON/OFF（顔系マテリアルの影受け） */
const FACE_RE = /顔|face|フェイス|ほお|頬|頭|head/i;
export function setFaceShadowEnabled(root: MmdMesh, enabled: boolean): void {
  for (const m of targetMeshes(root)) {
    if (FACE_RE.test(m.materialName)) m.setReceive(enabled);
  }
}
