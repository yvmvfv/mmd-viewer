import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

export interface LightRig {
  light: DirectionalLight;
  shadows: ShadowGenerator;
}

export function createLights(scene: Scene): LightRig {
  // 斜め上（前・右・上）からのキー光：顔が潰れないよう正面寄り
  const light = new DirectionalLight("sun", new Vector3(-0.35, -1.1, -0.55), scene);
  light.intensity = 1.1;
  light.autoCalcShadowZBounds = true;
  const shadows = new ShadowGenerator(1024, light, true);
  shadows.transparencyShadow = true;
  shadows.usePercentageCloserFiltering = true;
  shadows.forceBackFacesOnly = true;
  shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  // 顔のモアレ・自家影対策
  shadows.bias = 0.0005;
  shadows.normalBias = 0.04;
  shadows.depthScale = 50000;
  return { light, shadows };
}
