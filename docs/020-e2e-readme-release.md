# 020 手動 E2E・README・配布パッケージ

- Day：3
- 依存：016〜019
- 参照：PLAN.md §11.4, §12, §13

## 目的

リリース前の手動確認を行い、ドキュメントと配布用 zip を用意する。

## Todo

- [x] 手動 E2E チェックリスト（PLAN.md §11.4）
  - [x] `chrome://extensions` でパッケージ化されていない拡張として読み込み、エラーが出ない（2026-10-15 実機 OK）
  - [x] ページ内ボタン・ポップアップ・ショートカットの 3 経路でコピーできる（015 の A・B、019 の手順 2 で確認）
  - [x] 貼り付け先：Claude・ChatGPT・Obsidian・Notion で崩れない（2026-10-15 実機 OK）
  - [x] SPA 遷移（ポスト → 別ポスト → ホーム）でボタンが重複・残留しない（015 の C で確認）
  - [x] SW 停止後もショートカットが動く（019 の手順 3 で確認）
  - [x] 長時間スクロールしてもメモリ・CPU が増え続けない（observer のリーク確認。018 の実機確認で OK）
- [x] `README.md`
  - [x] インストール手順
  - [x] 使い方（3 経路）
  - [x] 既知の制約（画面内のポストのみ・自動スクロールの上限・省略表示）
  - [x] 既知の制約（015 で未確認のもの）：画像の ALT は X の既定値（日本語 UI では「画像」）と区別できないため Markdown に出力していない
  - [x] X の DOM 変更時のセレクタ修正方法（`selectors.ts` とフィクスチャ更新）
- [x] `npm test`・`npm run lint`・`npm run check:no-network` が通ることを最終確認する
- [x] `dist/` を zip にまとめる

## 完了条件（Day 3 の完了条件を兼ねる）

- [x] 手動 E2E チェックリストの全項目をクリア（2026-10-15）
- [x] `dist/` の zip が配布できる状態（`npm run package` で作成）

## 作業メモ

- README.md：インストール（zip／ソース）・使い方（3 経路）・設定・出力例・既知の制約・セレクタの修正方法・開発コマンド
- 配布用 zip：`npm run package`（ビルド → `scripts/package.mjs` が `dist/` を `x-thread-md-<version>.zip` に。依存を増やさないよう `node:zlib` だけで書いた。タイムスタンプ固定で、同じ `dist/` からは同じ zip になる）。Windows の展開機能で展開し、全 9 ファイルが `dist/` と一致することを確認した。`*.zip` は .gitignore 済み
- 最終確認（2026-10-15）：`npm test`（408 件）・`npm run lint`・`npm run typecheck`・`npm run format:check` 相当・`npm run check:no-network` すべて通過

## Day 3 の実機確認（まとめ・ユーザー作業）

準備：`npm run build`（または zip を展開）→ `chrome://extensions` で再読み込み → x.com のタブも再読み込み

1. 016 設定：docs/016 の「実機確認」1〜4
2. 017 出力オプション：docs/017 の「実機確認」1〜6
3. 018 自動スクロール：docs/018 の「実機確認」1〜7
4. 019 ショートカット：docs/019 の「実機確認」1〜5
5. 上の手動 E2E チェックリスト（PLAN.md §11.4）
   - 貼り付け先の確認では、既定の設定と、frontmatter オン＋メタ情報「通常行」の両方を試す（Obsidian では frontmatter がプロパティとして表示される）
   - 結果を NG／OK で教えてください。NG のときは、そのページの DOM（README の「セレクタの修正方法」1〜2 の手順）があると原因を特定しやすいです
