# 002 型定義とセレクタ

- Day：1
- 依存：001
- 参照：PLAN.md §6, §7.1

## 目的

抽出結果のデータ型を固定し、X の DOM に依存するセレクタを 1 ファイルに集める。

## Todo

- [x] `src/shared/types.ts`：`Author`・`Media`・`TweetData`・`ThreadResult` を PLAN.md §6 のとおりに定義
- [x] `src/shared/messages.ts`：`EXTRACT_AND_COPY` メッセージと、その応答（成功：件数・警告／失敗：理由）の型
- [x] `src/content/extract/selectors.ts`：PLAN.md §7.1 の表のセレクタを定義し、それぞれ用途をコメントで書く
  - [x] ポスト `article[data-testid="tweet"]`
  - [x] 本文 `div[data-testid="tweetText"]`
  - [x] 投稿者 `div[data-testid="User-Name"]`
  - [x] 日時・パーマリンク `time[datetime]` と親の `a[href*="/status/"]`
  - [x] 画像 `div[data-testid="tweetPhoto"] img`
  - [x] 動画 `div[data-testid="videoPlayer"]`、`video[poster]`
  - [x] 省略表示 `[data-testid="tweet-text-show-more-link"]`
  - [x] タイムラインのセル `div[data-testid="cellInnerDiv"]`
  - [x] 引用コンテナ `div[role="link"]`
  - [x] アクションバー `div[role="group"]`

## 完了条件

- [x] 型チェック（`tsc --noEmit`）が通る
- [x] 難読化クラス・`aria-label`・表示文言を使ったセレクタが無い
- [x] X の DOM に依存するセレクタが `selectors.ts` 以外に無い

## 作業メモ

- **仕様変更**：引用ポストの型を `QuotedTweet`（`url: string | null`）として分けた。PLAN.md §6 の `Omit<TweetData, 'quote'>` では `url` が必須になり、§7.2「引用 URL は取れなければ null」と矛盾するため。PLAN.md §6 も更新済み
- `selectors.ts` には表のセレクタに加え、X 依存の知識として次も置いた：監視対象の `main`、ポスト URL のパス `STATUS_PATH_PATTERN`、対象ホスト `X_HOSTS`、画像 URL の接頭辞 `MEDIA_URL_PREFIX`
- 応答の失敗理由は `ExtractErrorCode`（`NOT_STATUS_PAGE`・`MAIN_NOT_FOUND`・`NO_TWEETS`・`COPY_FAILED`・`UNKNOWN`）で返す。ポップアップとトーストはこのコードから表示文言を決める
- 受信側のための型ガード `isExtractAndCopyRequest` を追加した
- テスト：`tests/selectors.test.ts`（全セレクタが有効な CSS で、禁止パターンを含まない／`STATUS_PATH_PATTERN` の一致・不一致／`X_HOSTS` と manifest の一致）、`tests/messages.test.ts`
