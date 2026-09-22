/** 読み込み済みアセットを端末内(IndexedDB)に保存するライブラリ（種別ごと） */

export interface SavedModelMeta {
  id: string;
  name: string;
  size: number;
  count: number;
  createdAt: number;
}

export type AssetKind = "model" | "motion" | "pose" | "audio";

interface SavedFile {
  path: string;
  name: string;
  type: string;
  blob: Blob;
}

const DB_NAME = "mmd-viewer";
const VERSION = 2;
const STORES: Record<AssetKind, [meta: string, blobs: string]> = {
  model: ["model-meta", "model-blobs"],
  motion: ["motion-meta", "motion-blobs"],
  pose: ["pose-meta", "pose-blobs"],
  audio: ["audio-meta", "audio-blobs"],
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("この端末・ブラウザは保存に未対応です"));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [meta, blobs] of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(meta)) db.createObjectStore(meta, { keyPath: "id" });
        if (!db.objectStoreNames.contains(blobs)) db.createObjectStore(blobs, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("DBを開けません"));
  });
}

async function withStore<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(store, mode);
      t.onerror = () => reject(t.error ?? new Error("DB処理に失敗"));
      const req = fn(t.objectStore(store));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("DB処理に失敗"));
    });
  } finally {
    db.close();
  }
}

export interface AssetLibrary {
  list(): Promise<SavedModelMeta[]>;
  save(name: string, files: File[]): Promise<string>;
  getFiles(id: string): Promise<File[]>;
  remove(id: string): Promise<void>;
}

export function createAssetLibrary(kind: AssetKind): AssetLibrary {
  const [metaStore, blobStore] = STORES[kind];
  return {
    async list(): Promise<SavedModelMeta[]> {
      const all = await withStore<SavedModelMeta[]>(metaStore, "readonly", (s) => s.getAll());
      return (all ?? []).sort((a, b) => b.createdAt - a.createdAt);
    },
    async save(name: string, files: File[]): Promise<string> {
      const id = name;
      const meta: SavedModelMeta = {
        id,
        name,
        size: files.reduce((a, f) => a + f.size, 0),
        count: files.length,
        createdAt: Date.now(),
      };
      const blobs: SavedFile[] = files.map((f) => ({
        path: f.webkitRelativePath || f.name,
        name: f.name,
        type: f.type || "application/octet-stream",
        blob: f,
      }));
      await withStore(metaStore, "readwrite", (s) => s.put(meta));
      await withStore(blobStore, "readwrite", (s) => s.put({ id, files: blobs }));
      return id;
    },
    async getFiles(id: string): Promise<File[]> {
      const rec = await withStore<{ id: string; files: SavedFile[] } | undefined>(blobStore, "readonly", (s) => s.get(id));
      if (!rec) throw new Error("保存データが見つかりません");
      return rec.files.map((f) => {
        const file = new File([f.blob], f.name, { type: f.type });
        Object.defineProperty(file, "webkitRelativePath", { value: f.path, configurable: true });
        return file;
      });
    },
    async remove(id: string): Promise<void> {
      await withStore(metaStore, "readwrite", (s) => s.delete(id));
      await withStore(blobStore, "readwrite", (s) => s.delete(id));
    },
  };
}

/** モデル用（既存互換） */
const models = createAssetLibrary("model");

/** 保存名の決定：ZIP/フォルダ基底名、単体はファイル名 */
export function rootNameOf(files: File[], modelFile: File): string {
  const rel = modelFile.webkitRelativePath;
  if (rel && rel.includes("/")) return rel.split("/")[0];
  const first = files[0]?.webkitRelativePath;
  if (first && first.includes("/")) return first.split("/")[0];
  return modelFile.name.replace(/\.(pmx|pmd|bpmx|zip)$/i, "");
}

export async function saveModel(name: string, files: File[]): Promise<string> {
  return models.save(name, files);
}
export async function listSavedModels(): Promise<SavedModelMeta[]> {
  return models.list();
}
export async function getModelFiles(id: string): Promise<File[]> {
  return models.getFiles(id);
}
export async function deleteSavedModel(id: string): Promise<void> {
  return models.remove(id);
}

export const motionLibrary = createAssetLibrary("motion");
export const poseLibrary = createAssetLibrary("pose");
export const audioLibrary = createAssetLibrary("audio");
