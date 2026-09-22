# mmd-viewer

Babylon.js + babylon-mmd のスマホ向けPWAビューア雛形。
第一機能は「MMDを見ること」に限定。

## 前提
- Node 20+
- 黒背景 / 白い有限床(既定20m) / 右上ハンバーガー / 右90%半透明ドロワー

## 開発
```sh
npm install
npm run dev
```

## 対応形式
- モデル: `.pmx` / `.pmd` / `.bpmx`（babylon-mmd対応範囲）
- モーション: `.vmd` / `.vpd` 系は将来用に予約（現状UIなし）

読み込みはフォルダ選択を推奨（テクスチャ解決・大小文字差異吸収のため）。

## フォルダ構成
```
src/
  main.ts              起動点
  app/App.ts           組み立て専用
  scene/               背景・床・カメラ・ライトのみ
    sceneManager.ts
    camera.ts
    lights.ts
    floor.ts
  loaders/             MMD読み込み専用
    mmdLoaderService.ts
    supportedFormats.ts
  state/               設定・状態
    settings.ts
    store.ts
  ui/                  ドロワーと拡張可能な項目登録
    drawer.ts
    menuRegistry.ts
    items/
      modelLoadItem.ts
      appearanceItem.ts
      cameraItem.ts
      infoItem.ts
  styles/
  pwa/
public/
  manifest.webmanifest
  sw.js
  icons/
```
項目追加は `src/ui/items/` に作って `App.ts` で `registry.register()` するだけ。
