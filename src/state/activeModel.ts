import type { MmdMesh } from "babylon-mmd/esm/Runtime/mmdMesh";

type Listener = (m: MmdMesh | null) => void;

/** 操作対象モデル（シーンのモデルで「操作中」のもの） */
class ActiveModelStore {
  private current: MmdMesh | null = null;
  private listeners = new Set<Listener>();

  get(): MmdMesh | null {
    return this.current;
  }
  set(m: MmdMesh | null): void {
    this.current = m;
    for (const fn of this.listeners) fn(m);
  }
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const activeModelStore = new ActiveModelStore();
