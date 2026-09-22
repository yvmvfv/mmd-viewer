import { defaultSettings, type AppSettings } from "./settings";

type Listener = (s: AppSettings) => void;

/** 将来の項目追加に備えた最小ストア */
export class SettingsStore {
  private state: AppSettings = structuredClone(defaultSettings);
  private listeners = new Set<Listener>();

  get(): AppSettings {
    return this.state;
  }
  patch(p: Partial<AppSettings>): void {
    this.state = { ...this.state, ...p };
    this.emit();
  }
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(): void {
    for (const fn of this.listeners) fn(this.state);
  }
}
