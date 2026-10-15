# 006 引用ポストの切り分け（parseQuote）

- Day：1
- 依存：002, 003, 004, 005
- 参照：PLAN.md §7.2

## 目的

同じ `article` 内に入れ子で現れる引用ポストを、本体と分けて取り出す。

## Todo

- [x] `src/content/extract/parseQuote.ts`
  - [x] 引用コンテナの判定：`div[role="link"]` で、内部に `User-Name` を持つもの
  - [x] `article` 内の `User-Name`・`tweetText`・`time` を全部取り、引用コンテナの内側かどうかで本体側／引用側に振り分ける
  - [x] 本体側だけを取り出すヘルパー（007 の parseTweet で使う）
  - [x] 引用の URL は引用コンテナ内の `a[href*="/status/"]` から取る。取れなければ `null`
  - [x] 引用は 1 段まで（`quote` の中に `quote` を持たない）
- [x] 単体テスト：引用付きフィクスチャで本体と引用の本文・投稿者が混ざらないこと、引用 URL が無い場合

## 完了条件

- [x] 引用付きフィクスチャで本体と引用が正しく分かれる（`single_tweet.html` の最後のリプライで確認）

## 作業メモ

- **実 DOM で分かったこと**
  - 引用カード自体はパーマリンクを持たない（`time` はリンクで囲まれていない）
  - 投稿者名もリンクではないので、ハンドルは `@handle` のテキストから読む（`parseAuthor.ts`）
  - カード内の添付画像のリンク（`/<handle>/status/<id>/photo/1`）からなら、引用元の ID・URL が分かる。引用元の投稿者のリンクに限って採用する
- **仕様変更**：画像の無い引用では ID も取れないため、`QuotedTweet` の `id` を `string | null` にし、`isMain` を外した（PLAN.md §6 も更新済み）
- 本体側だけを取り出すヘルパーは `queryOwn(scope, selector, quoteContainer)`
- 共通部品として次を追加した：`permalink.ts`（`/status/` の href を解析し、`https://x.com/...` を組み立てる）、`parseAuthor.ts`（`User-Name` → `Author`）
- テスト：`tests/parseQuote.test.ts`・`tests/parseAuthor.test.ts`・`tests/permalink.test.ts`
