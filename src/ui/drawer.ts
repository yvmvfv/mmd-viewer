import { drawerState } from "../state/drawerState";

/** 右90%ドロワーの開閉 */
export function setupDrawer(): void {
  const btn = document.getElementById("menuButton")!;
  const drawer = document.getElementById("drawer")!;
  const scrim = document.getElementById("scrim")!;
  const close = document.getElementById("closeButton")!;

  const setOpen = (open: boolean) => {
    drawer.classList.toggle("open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    btn.setAttribute("aria-expanded", String(open));
    // ドロワーは半透明のため、奥のハンバーガーが透けないよう隠す
    btn.style.visibility = open ? "hidden" : "visible";
    drawerState.set(open);
    if (open) scrim.removeAttribute("hidden");
    else scrim.setAttribute("hidden", "");
  };
  btn.addEventListener("click", () => setOpen(!drawer.classList.contains("open")));
  close.addEventListener("click", () => setOpen(false));
  scrim.addEventListener("click", () => setOpen(false));
  // 起動時は3Dモデル画面（メニューは閉じた状態）
  setOpen(false);
}
