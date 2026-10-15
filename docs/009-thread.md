# 009 スレッド範囲の判定（thread.ts）

- Day：2
- 依存：007
- 参照：PLAN.md §7.5

## 目的

画面内にレンダリング済みのポストから、同一著者の連続ポストをスレッドとして集める。

## Todo

- [x] `src/content/extract/thread.ts`
  - [x] URL から `mainId` と著者ハンドルを取る。`/status/` 以外のページはエラーを返す
  - [x] 画面内の全 `article` を DOM 順に解析し、`id` で重複を除く
  - [x] 上方向：メインより前にある同一著者の連続ポスト（メインがスレッド途中のとき）
  - [x] 下方向：メイン直後から同一著者のポストが続く限り集め、他者のポストが出たら終了
  - [x] `truncated` のポストを `warnings` に追加する（文言は PLAN.md §8.1 の `Tweet N was truncated ("Show more") and may be incomplete.`。N は出力上の番号。引用ポストの `truncated` も警告する。`markdown.ts` は `warnings` をそのまま出力するだけ）
  - [x] 0 件・メインが見つからない場合は、明確なエラーを返す（例外を UI まで素通りさせない）
  - [x] `ThreadResult`（`sourceUrl`・`rootAuthor`・`tweets`・`warnings`・`extractedAt`）を返す
- [x] 単体テスト：同一著者スレッド、他者ポストでの打ち切り、重複除去、メイン不在、`/status/` 以外の URL
- [x] `tests/markdown.fixtures.test.ts` の対象ポストの選び方（テスト側で手で選んでいる）を `thread.ts` に置き換える

## 完了条件

- [x] 同一著者スレッドのフィクスチャで全件が表示順に取れる（`thread.html` 4 件、`image3.html` 3 件）
- [x] エラーケースで例外ではなくエラー結果が返る

## 作業メモ

- API：`extractThread(root, pageUrl, { resolution?, now? })` → `{ ok: true, result }` か `{ ok: false, code, message }`
- 判断したこと
  - 著者は URL のハンドルではなく、メインポストの投稿者で決める。URL のハンドルは大文字小文字が違ったり、改名前の古いものだったりしうるため。比較は大文字小文字を区別しない
  - `sourceUrl` はページ URL ではなく、メインポストの正規の URL（`https://x.com/<handle>/status/<id>`）。`/photo/1` や `?s=20` などの追跡用クエリを出力に残さないため
  - ページ URL は x.com / twitter.com のホストに限る（`parsePageUrl`）
  - エラーの判定順：`/status/` 以外のページ → 0 件（`NO_TWEETS`）→ メイン不在（`MAIN_NOT_FOUND`）
  - 「他者のリプライの後に、著者がまた出てくる」場合は、その著者のポストを含めない（PLAN.md のとおり、他者が出た時点で終了）
- 応答用に `countTruncated(result)` を用意した（本体か引用が省略表示のポストの数。トーストの「(1 truncated)」に使う）
- `parseTweet.ts` からパーマリンクの取得を `findPermalink(article)` として切り出した（013 のページ内ボタンでメインポストを探すのに使う）
- テスト：`tests/thread.test.ts`（22 件）。フィクスチャ 5 種での件数、`/photo/1?s=20` 付き URL、合成 DOM での上方向・打ち切り・大文字小文字・重複・パーマリンク無しの混入・twitter.com・警告の番号付け・各エラー
- 上方向の収集・他者での打ち切り・重複除去をそれぞれ一時的に壊すと、テストが失敗することを確認済み
- **未検証**：上方向の収集は合成 DOM でしか確かめていない。実際にスレッド途中を開いた状態のフィクスチャは 015 で取得する
- （017 で追記）「もっと見つける」（おすすめ）に同じ著者のポストが出ると、スレッドの続きとして収集してしまう不具合があった。セル内の `h2` で区切り、メインと同じセクションだけを対象にするよう修正（docs/017 の作業メモ）
