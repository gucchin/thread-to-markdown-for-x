# 007 ポスト単位の抽出（parseTweet）

- Day：1
- 依存：004, 005, 006
- 参照：PLAN.md §6, §7.1, §7.5

## 目的

`article` 要素 1 つを `TweetData` にする。

## Todo

- [x] `src/content/extract/parseTweet.ts`：`(article, mainId) => TweetData | null`
  - [x] パーマリンクから `id`・`url`（`https://x.com/<handle>/status/<id>`）を取る
  - [x] パーマリンクを持たない `article`（広告・おすすめ等）は `null` を返す
  - [x] 投稿者：表示名と `@` なしのハンドル
  - [x] 日時：`time[datetime]` の値（無ければ `null`）
  - [x] 本文・メディアは本体側だけを使う（引用側を混ぜない）
  - [x] `truncated`：省略表示リンクがあれば `true`
  - [x] `quote`：006 の結果
  - [x] `isMain`：`id` が `mainId` と一致するか
- [x] 単体テスト：Day 1 のフィクスチャ 4 種それぞれで期待どおりの `TweetData` になること

## 完了条件

- [x] Day 1 のフィクスチャ 4 種でテストが通る（`single`・`thread`・`image3`・`quote`、加えて `single_tweet`）

## 作業メモ

- **実 DOM で分かったこと**
  - パーマリンクは「本体側の `time` を囲む `a`」から取る。`a[href*="/status/"]` は添付画像（`/photo/1`）・アナリティクス・引用一覧のリンクにも一致するので、単純に最初のものを取ると誤る
  - `time` の位置は、メインポストでは `User-Name` の外（本文の下）、リプライやスレッドの続きでは `User-Name` の中。どちらの場合も「`time` を囲むリンク」で取れる
  - メインポストの `article` は `tabindex="-1"`、それ以外は `tabindex="0"`（全 5 ファイルで一致。判定には使っていない）
  - `single_tweet.html` のメインポストは広告（プロモーション）だった。パーマリンクがあるので通常のポストとして抽出される
- オプション `resolution`（`large`/`orig`）は parseMedia と parseQuote に渡す
- テスト
  - `tests/parseTweet.test.ts`：`single_tweet` の 17 件。メイン・リプライ・引用付きリプライの各値、`blob:`・アバターが出ないこと、スナップショット、パーマリンク無し・省略表示・本文無しの境界ケース
  - `tests/parseTweet.fixtures.test.ts`：`single`・`thread`・`image3`・`quote` の各値、メディアの順序、引用の分離、全フィクスチャ共通の不変条件、スナップショット
- テストが実際に失敗を検出することは、`…` の除去と引用除外を一時的に壊して確認した（6 件が失敗）
