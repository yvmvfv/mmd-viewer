export type ViewMode = "camera" | "move" | "extra3" | "extra4";

type Listener = (m: ViewMode) => void;

class ViewModeStore {
  private mode: ViewMode = "camera";
  private listeners = new Set<Listener>();

  get(): ViewMode {
    return this.mode;
  }
  set(m: ViewMode): void {
    if (m === this.mode) return;
    this.mode = m;
    for (const fn of this.listeners) fn(m);
  }
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const viewModeStore = new ViewModeStore();
