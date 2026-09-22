import { BlobReader, BlobWriter, ZipReader, configure } from "@zip.js/zip.js";
import { isAssetFile } from "./supportedFormats";

/** モデル解決に必要な拡張子のみ展開（txt・音声・画像資料等の解凍を省略） */
function isNeeded(name: string): boolean {
  return isAssetFile(name);
}

/**
 * ZIP内のパスを webkitRelativePath として持つ File 群に展開する。
 * zip.js＋ネイティブDecompressionStreamで解凍するため、
 * PWA単体（JS高速化が効かない環境）でもSafari並みに速い。
 */
export async function unzipToFiles(zipFile: File): Promise<File[]> {
  configure({ useWebWorkers: false });
  const reader = new ZipReader(new BlobReader(zipFile));
  try {
    const base = zipFile.name.replace(/\.zip$/i, "");
    const entries = (await reader.getEntries()).filter(
      (e): e is import("@zip.js/zip.js").FileEntry =>
        !e.directory && !e.filename.startsWith("__MACOSX/") && isNeeded(e.filename),
    );
    if (entries.length === 0) throw new Error("ZIP内にモデル／テクスチャが見つかりません");

    const out: File[] = [];
    for (const entry of entries) {
      const blob = await entry.getData(new BlobWriter());
      if (!blob) continue;
      const rel = entry.filename.replace(/^\//, "");
      const file = new File([blob], rel.split("/").pop() ?? rel, {
        type: blob.type || "application/octet-stream",
      });
      Object.defineProperty(file, "webkitRelativePath", {
        value: `${base}/${rel}`,
        configurable: true,
      });
      out.push(file);
    }
    if (out.length === 0) throw new Error("ZIP内にモデル／テクスチャが見つかりません");
    return out;
  } finally {
    await reader.close();
  }
}

export function isZipFile(name: string): boolean {
  return name.toLowerCase().endsWith(".zip");
}
