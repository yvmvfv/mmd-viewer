import { App } from "./app/App";

function showFatal(e: unknown): void {
  const div = document.createElement("div");
  div.style.cssText =
    "position:fixed;left:8px;right:8px;bottom:8px;z-index:99;" +
    "background:rgba(180,30,30,.92);color:#fff;font-size:12px;" +
    "padding:10px 12px;border-radius:10px;white-space:pre-wrap;word-break:break-all";
  div.textContent = `起動失敗: ${e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e)}`;
  document.body.appendChild(div);
}

window.addEventListener("error", (ev) => showFatal(ev.error ?? ev.message));
window.addEventListener("unhandledrejection", (ev) => showFatal(ev.reason));

try {
  await App.start();
} catch (e) {
  showFatal(e);
} finally {
  document.documentElement.classList.add("ready");
}
