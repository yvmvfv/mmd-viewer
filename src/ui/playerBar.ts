import type { Scene } from "@babylonjs/core/scene";
import {
  getCurrentSeconds,
  getDurationSeconds,
  getSpeed,
  isMotionApplied,
  isMotionPlaying,
  seekSeconds,
  setMotionPlaying,
  setSpeed,
  subscribeApplied,
  subscribePlaying,
} from "../motion/motionService";
import { drawerState } from "../state/drawerState";

const SPEEDS = [1, 1.5, 2, 0.5];

function fmt(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** メニュー非表示時に下へ出る再生バー（シーク＋速度） */
export function setupPlayerBar(scene: Scene): void {
  const bar = document.getElementById("playerBar")!;
  const seek = document.getElementById("pbSeek") as HTMLInputElement;
  const cur = document.getElementById("pbCur")!;
  const dur = document.getElementById("pbDur")!;
  const play = document.getElementById("pbPlay") as HTMLButtonElement;
  const speed = document.getElementById("pbSpeed") as HTMLButtonElement;
  let scrubbing = false;
  let resumeAfterScrub = false;

  const syncVisible = (): void => {
    if (isMotionApplied() && !drawerState.get()) bar.removeAttribute("hidden");
    else bar.setAttribute("hidden", "");
  };

  const sync = (): void => {
    const total = getDurationSeconds(scene);
    let now = getCurrentSeconds(scene);
    // 終端超過分は先頭へループ（秒数と再生の不一致を解消）
    if (total > 0 && now >= total) {
      seekSeconds(scene, 0);
      now = 0;
    }
    now = Math.min(now, total);
    if (!scrubbing) seek.value = now.toFixed(2);
    seek.max = String(Math.max(total, 1));
    seek.step = "0.01";
    if (!scrubbing) seek.value = String(now);
    seek.max = String(Math.max(total, 1));
    cur.textContent = fmt(now);
    dur.textContent = fmt(total);
    play.textContent = isMotionPlaying(scene) ? "⏸" : "▶";
    const sp = getSpeed(scene);
    speed.textContent = `${Number.isInteger(sp) ? sp.toFixed(0) : sp.toFixed(2)}×`;
  };

  seek.addEventListener("pointerdown", () => {
    scrubbing = true;
    // 触っている間は一時停止、離したら元の状態へ
    resumeAfterScrub = isMotionPlaying(scene);
    if (resumeAfterScrub) setMotionPlaying(scene, false);
  });
  window.addEventListener("pointerup", () => {
    if (scrubbing && resumeAfterScrub) setMotionPlaying(scene, true);
    scrubbing = false;
    resumeAfterScrub = false;
  });
  seek.addEventListener("input", () => {
    seekSeconds(scene, Number(seek.value));
    cur.textContent = fmt(Number(seek.value));
  });
  play.addEventListener("click", () => {
    setMotionPlaying(scene, !isMotionPlaying(scene));
    sync();
  });
  speed.addEventListener("click", () => {
    const i = SPEEDS.indexOf(getSpeed(scene));
    setSpeed(scene, SPEEDS[(i + 1) % SPEEDS.length]);
    sync();
  });

  drawerState.subscribe(syncVisible);
  subscribeApplied(syncVisible);
  subscribePlaying(sync);
  window.setInterval(() => {
    if (!bar.hasAttribute("hidden")) sync();
  }, 250);
  syncVisible();
  sync();
}
