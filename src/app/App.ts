import "../styles/base.css";
import "../styles/drawer.css";
import "../styles/modebar.css";
import "../styles/playerbar.css";
import "../styles/transformbar.css";
import { SettingsStore } from "../state/store";
import { modelPresence } from "../state/presence";
import { SceneManager } from "../scene/sceneManager";
import { setupDrawer } from "../ui/drawer";
import { setupModeBar } from "../ui/modeBar";
import { setupPlayerBar } from "../ui/playerBar";
import { setupTransformBar } from "../ui/transformBar";
import { MenuRegistry } from "../ui/menuRegistry";
import { applyPhysicsSettings, getPhysicsSettings } from "../motion/physics";
import { ModelLoadItem } from "../ui/items/modelLoadItem";
import { MotionItem } from "../ui/items/motionItem";
import { PoseItem } from "../ui/items/poseItem";
import { AudioItem } from "../ui/items/audioItem";
import { BgImageItem } from "../ui/items/bgImageItem";
import { ActiveModelItem } from "../ui/items/activeModelItem";
import { MorphItem } from "../ui/items/morphItem";
import { MaterialItem } from "../ui/items/materialItem";
import { CaptureItem } from "../ui/items/captureItem";
import { PhysicsItem } from "../ui/items/physicsItem";
import { AppearanceItem } from "../ui/items/appearanceItem";
import { CameraItem } from "../ui/items/cameraItem";
import { createFutureItems } from "../ui/items/futureItems";
import { registerSw } from "../pwa/registerSw";

export class App {
  static async start(): Promise<void> {
    const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    const store = new SettingsStore();
    const manager = new SceneManager(canvas, store);

    setupDrawer();
    setupModeBar(manager.scene, canvas);
    setupPlayerBar(manager.scene);
    // 物理ON保存時は起動時から有効化（WASM読込はバックグラウンド）
    void applyPhysicsSettings(manager.scene, getPhysicsSettings()).catch((e: unknown) =>
      console.error(e),
    );
    setupTransformBar();
    const registry = new MenuRegistry();
    // 指定順に登録（未実装は形だけ・()付きはモデル時のみ表示）
    const future = new Map(createFutureItems().map((i) => [i.id, i]));
    const get = (id: string) => future.get(id)!;
    registry.register(new ModelLoadItem(manager));
    registry.register(new MotionItem(manager.scene));
    registry.register(new PoseItem(manager.scene));
    registry.register(new AudioItem(manager.scene));
    registry.register(new BgImageItem(manager.scene));
    registry.register(new ActiveModelItem());
    registry.register(new MorphItem(manager.scene));
    registry.register(new MaterialItem());
    registry.register(new AppearanceItem(store)); // スタジオ設定
    registry.register(get("floor-reflection"));
    registry.register(new PhysicsItem(manager.scene));
    registry.register(get("advanced"));
    registry.register(new CameraItem(manager.scene)); // カメラ設定
    registry.register(get("follow-model"));
    registry.register(get("first-person"));
    registry.register(get("art-focus"));
    registry.register(new CaptureItem(manager));
    registry.register(get("animation-settings"));
    registry.renderAll(document.getElementById("menuItems")!);
    modelPresence.subscribe(() => registry.refresh());

    registerSw();
    manager.run();
  }
}
