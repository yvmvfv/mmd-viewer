import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

/** 有限の白い床。サイズ変更時は作り直す */
export function createFloor(scene: Scene, size: number, colorHex: string): Mesh {
  const ground = CreateGround("floor", { width: size, height: size, subdivisions: 1 }, scene);
  const mat = new StandardMaterial("floorMat", scene);
  mat.diffuseColor = Color3.FromHexString(colorHex);
  mat.specularColor = new Color3(0.1, 0.1, 0.1);
  ground.material = mat;
  ground.receiveShadows = true;
  return ground;
}
