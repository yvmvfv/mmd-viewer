import { Engine } from "@babylonjs/core/Engines/engine";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { createCamera } from "./camera";
import { createFloor } from "./floor";
import { createLights, type LightRig } from "./lights";
import type { SettingsStore } from "../state/store";

export class SceneManager {
  readonly engine: Engine;
  readonly scene: Scene;
  private rig: LightRig;
  private floor: Mesh | null = null;
  private store: SettingsStore;
  private unsub: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement, store: SettingsStore) {
    this.store = store;
    this.engine = new Engine(canvas, true, { stencil: true, antialias: true, adaptToDeviceRatio: true, powerPreference: "high-performance" });
    // PWA軽量化：端末DPR上限2（3は重い）。粗さと速度のバランス点
    this.engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new Scene(this.engine);
    createCamera(this.scene);
    this.rig = createLights(this.scene);
    this.applySettings();
    this.unsub = this.store.subscribe(() => this.applySettings());
    const onResize = (): void => {
      this.engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
      this.engine.resize();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
  }

  private applySettings(): void {
    const s = this.store.get();
    const bg = s.transparentBg ? new Color4(0, 0, 0, 0) : Color4.FromHexString(`${s.background}ff`);
    this.scene.clearColor = bg;
    this.rig.light.shadowEnabled = s.shadows;
    this.rig.light.intensity = s.lightIntensity;
    // 光源位置（0°＝正面基準の方位・高度から方向ベクトルへ）
    const az = (s.lightAzimuth * Math.PI) / 180;
    const el = (s.lightElevation * Math.PI) / 180;
    this.rig.light.direction = new Vector3(
      -Math.sin(az) * Math.cos(el),
      -Math.sin(el),
      -Math.cos(az) * Math.cos(el),
    );
    this.rig.shadows.darkness = s.shadowDarkness;
    // 床の遠端を背景に溶かして「下の黒帯」を見せない
    this.scene.fogMode = Scene.FOGMODE_LINEAR;
    this.scene.fogColor = Color3.FromHexString(s.background);
    this.scene.fogStart = s.floor.size * 1.2;
    this.scene.fogEnd = s.floor.size * 3.5;
    if (this.floor) {
      this.scene.removeMesh(this.floor, true);
      this.floor.dispose(false, true);
      this.floor = null;
    }
    this.floor = createFloor(this.scene, s.floor.size, s.floor.color);
    this.floor.setEnabled(s.floor.visible);
  }

  run(): void {
    this.engine.runRenderLoop(() => this.scene.render());
    // バックグラウンドでは描画停止（PWAの電池・発熱対策）
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.engine.stopRenderLoop();
      else this.engine.runRenderLoop(() => this.scene.render());
    });
  }

  dispose(): void {
    this.unsub?.();
    this.scene.dispose();
    this.engine.dispose();
  }

  get shadowGenerator(): ShadowGenerator {
    return this.rig.shadows;
  }
}

import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
