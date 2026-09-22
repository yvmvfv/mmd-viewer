import { activeModelStore } from "../state/activeModel";
import { modelPresence } from "../state/presence";
import { viewModeStore } from "../state/viewMode";

type Axis = "x" | "y" | "z";

const STEP = 5;

/** 移動モード時の下部バー：X/Y/Z軸ごとの角度調整＋0度リセット */
export function setupTransformBar(): void {
  const bar = document.getElementById("transformBar")!;
  const segBtns = Array.from(bar.querySelectorAll<HTMLButtonElement>(".axis-seg button"));
  const slider = document.getElementById("rotSlider") as HTMLInputElement;
  const minus = document.getElementById("rotMinus") as HTMLButtonElement;
  const plus = document.getElementById("rotPlus") as HTMLButtonElement;
  const reset = document.getElementById("rotReset") as HTMLButtonElement;
  const value = document.getElementById("rotValue") as HTMLElement;
  let axis: Axis = "x";

  const deg = (r: number): number => {
    let d = (r * 180) / Math.PI;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return Math.round(d);
  };

  const refresh = (): void => {
    const root = activeModelStore.get();
    const d = root ? deg(root.rotation[axis]) : 0;
    slider.value = String(d);
    value.textContent = `${d}°`;
  };

  const applyAxis = (d: number): void => {
    const root = activeModelStore.get();
    if (!root) return;
    root.rotation[axis] = (Math.max(-180, Math.min(180, d)) * Math.PI) / 180;
    refresh();
  };

  for (const b of segBtns) {
    b.addEventListener("click", () => {
      axis = (b.dataset.axis ?? "x") as Axis;
      for (const o of segBtns) o.classList.toggle("active", o === b);
      refresh();
    });
  }
  slider.addEventListener("input", () => applyAxis(Number(slider.value)));
  minus.addEventListener("click", () => {
    const root = activeModelStore.get();
    if (root) applyAxis(deg(root.rotation[axis]) - STEP);
  });
  plus.addEventListener("click", () => {
    const root = activeModelStore.get();
    if (root) applyAxis(deg(root.rotation[axis]) + STEP);
  });
  reset.addEventListener("click", () => {
    const root = activeModelStore.get();
    if (!root) return;
    root.rotation.set(0, 0, 0);
    refresh();
  });

  const syncVisible = (): void => {
    if (viewModeStore.get() === "extra3" && modelPresence.get()) bar.removeAttribute("hidden");
    else bar.setAttribute("hidden", "");
  };
  viewModeStore.subscribe(syncVisible);
  modelPresence.subscribe(syncVisible);
  activeModelStore.subscribe(refresh);
  syncVisible();
  refresh();
}
