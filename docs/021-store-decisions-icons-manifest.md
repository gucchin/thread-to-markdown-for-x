# 021 公開前の決定事項・アイコン・manifest

- Day：4
- 依存：020
- 参照：PLAN.md §16.1, §16.2

## 目的

ストアに出すための名前・公開範囲などを決め、アイコンと manifest を公開用に整える。

## Todo

- [x] 決めること（ユーザー判断。PLAN.md §16.1）
  - [x] ストア上の名前：`Thread to Markdown for X`（2026-10-16 決定）
  - [x] 公開範囲：公開（2026-10-16 決定）
  - [x] 掲載言語：日本語・英語（2026-10-16 決定）
  - [x] プライバシーポリシーの公開先：GitHub Pages（2026-10-16 決定。022）
  - [x] 初回のバージョン：`1.0.0`（2026-10-16 決定）
- [x] アイコン
  - [x] 自作デザインの SVG（`assets/icon.svg`。X のロゴ・鳥・「𝕏」を使わない）。案を出してユーザーに選んでもらう（3 案から A「スレッド」に決定）
  - [x] 16/32/48/128 px の PNG を書き出す（`scripts/icon.mjs`。依存なし。ビルドのたびに `dist/icons/` に生成し、PNG はリポジトリに置かない）
  - [x] ビルドに組み込む（`scripts/build.mjs`）
- [x] `manifest.json`：`name`・`version`（`package.json` も）・`icons`・`action.default_icon`・`minimum_chrome_version: "120"`
- [x] 拡張内の表示名（ポップアップ・オプションの `<title>` など）を新しい名前に合わせる
- [x] `tests/manifest.test.ts`：アイコンがビルドで生成するものと一致すること・名前・バージョン（`package.json` と一致）・`minimum_chrome_version`、権限が変わっていないこと（`storage`・`clipboardWrite`・x.com/twitter.com のみ）を確認。ラスタライザは `tests/icon.test.ts`
- [x] `npm run build` → 実機でアイコンが表示される（ツールバー・拡張機能の管理画面）

## 完了条件

- [x] PLAN.md §16.1 の項目がすべて決まり、PLAN.md に書き込んである
- [x] 実機でアイコンと新しい名前が表示される

## 作業メモ

- アイコンの 3 案（A：スレッド、B：Markdown マーク、C：吹き出し＋M↓）を 16〜128 px・明暗の背景で並べて比較し、A に決定（2026-10-16）。色は X の青と区別できる藍色
- SVG → PNG は開発依存（`@resvg/resvg-js` など）を足さず、`scripts/icon.mjs`（`node:zlib` のみ）で書き出す。図形が矩形と円だけなので、8×8 のスーパーサンプリングで十分な品質になる。対応外の要素は失敗にするので、SVG を描き換えても PNG が黙ってずれることはない
- ツールバーは高 DPI で 32 px を使うので、16/48/128 に 32 も加えた
- 名前を変えたのに合わせて、`package.json` の `name` を `thread-to-markdown-for-x` にし、配布用 zip の名前も `thread-to-markdown-for-x-<version>.zip` にした（`package.json` の `name` から作る）。`license: MIT` も記入
- Markdown の見出し `# X Thread by @…` は出力形式なので変えない
