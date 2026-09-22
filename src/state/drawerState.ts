type Listener = (open: boolean) => void;

/** スタジオメニューの開閉状態（再生バー表示切替用） */
class DrawerState {
  private open = false;
  private listeners = new Set<Listener>();

  get(): boolean {
    return this.open;
  }
  set(v: boolean): void {
    if (v === this.open) return;
    this.open = v;
    for (const fn of this.listeners) fn(v);
  }
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const drawerState = new DrawerState();
