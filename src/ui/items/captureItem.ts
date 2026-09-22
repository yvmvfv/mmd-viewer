import { CreateScreenshotAsync } from "@babylonjs/core/Misc/screenshotTools";
import {
  getCurrentSeconds,
  getDurationSeconds,
  seekSeconds,
  setMotionPlaying,
} from "../../motion/motionService";
import type { SceneManager } from "../../scene/sceneManager";
import type { MenuItem } from "../menuRegistry";

type PhotoRes = "1" | "2" | "4";
type VideoRes = "720p" | "1080p";

function download(url: string, name: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (url.startsWith("blob:")) window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** シーン撮影：写真1x/2x/4x・動画720p/1080p */
export class CaptureItem implements MenuItem {
  readonly id = "scene-capture";
  readonly title = "シーン撮影";
  readonly icon = "📷";
  private host: HTMLElement | null = null;
  private status = "待機中";
  private recording = false;
  private recorder: MediaRecorder | null = null;
  private rafId = 0;
  private chunks: Blob[] = [];
  private progressTimer = 0;
  private recStart = 0;

  constructor(private manager: SceneManager) {}

  render(host: HTMLElement): void {
    this.host = host;
    host.innerHTML = "";

    const h = document.createElement("h3");
    h.textContent = "シーン撮影";
    host.appendChild(h);

    const resLabel = document.createElement("p");
    resLabel.textContent = "画像解像度倍率";
    const res = document.createElement("select");
    for (const [v, t] of [["1", "標準(1x)"], ["2", "2x"], ["4", "4x"]] as [PhotoRes, string][]) {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = t;
      res.appendChild(o);
    }
    const photoBtn = document.createElement("button");
    photoBtn.textContent = "画像を作成";
    photoBtn.onclick = () => void this.shoot(res.value as PhotoRes, photoBtn);

    const vLabel = document.createElement("p");
    vLabel.textContent = "動画撮影（PC推奨）";
    const vResLabel = document.createElement("p");
    vResLabel.textContent = "解像度選択";
    const vRes = document.createElement("select");
    for (const v of ["720p", "1080p"] as VideoRes[]) {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      vRes.appendChild(o);
    }
    const recBtn = document.createElement("button");
    recBtn.textContent = this.recording ? "録画停止" : "録画開始";
    recBtn.onclick = () => void this.toggleRec(vRes.value as VideoRes, recBtn);

    const prog = document.createElement("div");
    prog.id = "recProg";
    if (!this.recording) prog.setAttribute("hidden", "");
    const progFill = document.createElement("div");
    progFill.id = "recProgFill";
    const progLabel = document.createElement("div");
    progLabel.id = "recProgLabel";
    progLabel.textContent = "待機中";
    prog.append(progFill, progLabel);

    const statusEl = document.createElement("div");
    statusEl.className = "status";
    statusEl.textContent = this.status;

    host.append(resLabel, res, photoBtn, vLabel, vResLabel, vRes, recBtn, prog, statusEl);
  }

  private async shoot(mult: PhotoRes, btn: HTMLButtonElement): Promise<void> {
    btn.disabled = true;
    try {
      this.status = "画像作成中…";
      this.rerender();
      const engine = this.manager.engine;
      const camera = this.manager.scene.activeCamera!;
      const url = await CreateScreenshotAsync(engine, camera, { precision: Number(mult) });
      download(url, `mmd-viewer-${Date.now()}.png`);
      this.status = "画像を作成しました";
    } catch (e) {
      this.status = `失敗: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      btn.disabled = false;
    }
    this.rerender();
  }

  private async toggleRec(res: VideoRes, btn: HTMLButtonElement): Promise<void> {
    if (this.recording) {
      this.stopRec();
      this.rerender();
      return;
    }
    btn.disabled = true;
    try {
      if (typeof MediaRecorder === "undefined") throw new Error("この端末は録画に未対応です");
      const src = this.manager.engine.getRenderingCanvas();
      if (!src) throw new Error("キャンバスが見つかりません");
      const [w, h] = res === "1080p" ? [1920, 1080] : [1280, 720];
      const cap = document.createElement("canvas");
      cap.width = w;
      cap.height = h;
      const ctx = cap.getContext("2d");
      if (!ctx) throw new Error("描画コンテキストを取得できません");
      const draw = (): void => {
        const scale = Math.max(w / src.width, h / src.height);
        const dw = src.width * scale;
        const dh = src.height * scale;
        ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
        this.rafId = requestAnimationFrame(draw);
      };
      draw();
      const stream = cap.captureStream(60);
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "video/mp4";
      this.chunks = [];
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };
      rec.onstop = () => {
        cancelAnimationFrame(this.rafId);
        stream.getTracks().forEach((t) => t.stop());
        const ext = mime.includes("mp4") ? "mp4" : "webm";
        const blob = new Blob(this.chunks, { type: mime });
        download(URL.createObjectURL(blob), `mmd-viewer-${Date.now()}.${ext}`);
        this.recording = false;
        this.recorder = null;
        this.hideBadge();
        this.status = "録画を保存しました";
        this.rerender();
      };
      this.recorder = rec;
      rec.start(500);
      this.recording = true;
      this.status = `録画中（${res}）…`;
      // 録画開始時は先頭から再生
      try {
        seekSeconds(this.manager.scene, 0);
        setMotionPlaying(this.manager.scene, true);
      } catch {
        /* ignore */
      }
      this.recStart = Date.now();
      this.updateProgress();
      this.progressTimer = window.setInterval(() => this.updateProgress(), 250);
    } catch (e) {
      this.status = `失敗: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      btn.disabled = false;
    }
    this.rerender();
  }

  private stopRec(): void {
    try {
      this.recorder?.stop();
    } catch {
      this.recording = false;
      cancelAnimationFrame(this.rafId);
      this.hideBadge();
      this.status = "停止しました";
    }
  }

  /** 録画進捗（モーション長に対する％、無ければ経過秒） */
  private updateProgress(): void {
    if (!this.recording) return;
    const dur = getDurationSeconds(this.manager.scene);
    let label: string;
    let pct: number | null = null;
    if (dur > 0) {
      pct = Math.min(100, Math.floor((getCurrentSeconds(this.manager.scene) / dur) * 100));
      label = `●REC ${pct}%`;
    } else {
      const s = Math.floor((Date.now() - this.recStart) / 1000);
      label = `●REC ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }
    const badge = document.getElementById("recBadge");
    const txt = document.getElementById("recText");
    if (badge && txt) {
      badge.removeAttribute("hidden");
      txt.textContent = label;
    }
    const prog = document.getElementById("recProg");
    const fill = document.getElementById("recProgFill");
    const plabel = document.getElementById("recProgLabel");
    if (prog && fill && plabel) {
      prog.removeAttribute("hidden");
      fill.style.width = pct === null ? "100%" : `${pct}%`;
      plabel.textContent = label;
    }
    if (pct !== null && pct >= 100) this.stopRec();
  }

  private hideBadge(): void {
    if (this.progressTimer) {
      window.clearInterval(this.progressTimer);
      this.progressTimer = 0;
    }
    document.getElementById("recBadge")?.setAttribute("hidden", "");
  }

  private rerender(): void {
    if (this.host) this.render(this.host);
  }
}
