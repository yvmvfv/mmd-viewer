export function registerSw(): void {
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => undefined);
    });
  }
}
