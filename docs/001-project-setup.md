# 001 プロジェクト雛形

- Day：1
- 依存：なし
- 参照：PLAN.md §2, §4, §5, §10

## 目的

ビルド・テスト・Lint が動き、空の拡張機能を Chrome に読み込める状態にする。

## Todo

- [x] `package.json` を作る（`devDependencies` のみ：typescript、esbuild、vitest、jsdom、eslint、prettier、@types/chrome。`dependencies` は空のまま）
- [x] `tsconfig.json`（`strict: true`）
- [x] `scripts/build.mjs`：esbuild で `content/index.ts`・`background/sw.ts`・`popup/popup.ts` をバンドルし、`manifest.json`・HTML・CSS を `dist/` へコピー
- [x] `src/manifest.json` を PLAN.md §4 のとおりに作る（権限は `storage`・`clipboardWrite` と x.com/twitter.com の host_permissions のみ）
- [x] 空のエントリを置く：`src/content/index.ts`、`src/background/sw.ts`、`src/popup/{popup.html, popup.ts, popup.css}`
- [x] ESLint・Prettier の設定
- [x] Vitest の設定（環境は jsdom）とサンプルテスト 1 本
- [x] npm スクリプト：`build`・`test`・`lint`・`format`・`check:no-network`
- [x] `check:no-network`：`src/` に `fetch(` と `XMLHttpRequest` が 0 件であることを確かめるスクリプト
- [x] `.gitignore`（`node_modules/`・`dist/`）
- [x] CLAUDE.md の「コマンド」節を実際の内容に合わせて更新

## 完了条件

- [x] `npm run build` で `dist/` が生成される
- [x] `chrome://extensions` で `dist/` を読み込んでエラーが出ない（2026-10-15 ユーザー確認済み）
- [x] `npm test`・`npm run lint`・`npm run check:no-network` が通る
- [x] `package.json` の `dependencies` が空

## 作業メモ

- 追加した npm スクリプト：`test:watch`・`typecheck`・`format:check`
- サンプルテストは `tests/manifest.test.ts`。manifest の権限が最小構成から変わったら失敗するようにした
- ESLint で `src/` の `eval`・`new Function`・`innerHTML`/`outerHTML` 代入・`insertAdjacentHTML` をエラーにした（PLAN.md §4・§10）
- `check:no-network` と ESLint の禁止ルールは、違反を含む一時ファイルで実際に検出されることを確認済み
- Prettier は `*.md` を対象外にした（チケットのチェックボックスを手で編集するため）
- esbuild の postinstall は npm の allowScripts で未承認のまま。プラットフォーム別バイナリで動作するため承認は不要
- TypeScript 6 は `types` の既定値が空なので、`tsconfig.json` で `"types": ["chrome"]` を明示している
