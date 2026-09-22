/** モデル読込の有無。()付き項目の表示切替に使う */
type Listener = (has: boolean) => void;

class ModelPresence {
  private has = false;
  private listeners = new Set<Listener>();

  get(): boolean {
    return this.has;
  }
  set(v: boolean): void {
    if (v === this.has) return;
    this.has = v;
    for (const fn of this.listeners) fn(v);
  }
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const modelPresence = new ModelPresence();
