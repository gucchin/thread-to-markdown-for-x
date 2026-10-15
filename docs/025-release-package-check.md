# 025 提出用パッケージの最終確認

- Day：4
- 依存：021, 022, 023
- 参照：PLAN.md §11.4, §16.7

## 目的

ストアにアップロードする zip が、余計なものを含まず、そのまま動くことを確かめる。

## Todo

- [ ] `npm run package` の zip の中身が `manifest.json`・JS・HTML・CSS・アイコンだけであることを確認（ソース・テスト・フィクスチャ・ソースマップ・ストア用画像を含まない）。スクリプトで一覧と比較できるようにする
- [ ] `manifest.json` の `name`・`version`・`description`・権限が、掲載文（023）・申告（023）と一致している
- [ ] `npm test`・`npm run lint`・`npm run typecheck`・`npm run check:no-network` が通る
- [ ] zip を展開して読み込んだ版で実機確認（ユーザー作業）
  - [ ] 3 経路のコピー・設定の保存・自動スクロール
  - [ ] `chrome://extensions` にエラーが出ない
- [ ] GitHub の公開リポジトリのタグ（例：`v1.0.0`）と提出する zip が同じソースから作られている

## 完了条件

- [ ] 提出する zip が確定し、実機確認がすべて OK
