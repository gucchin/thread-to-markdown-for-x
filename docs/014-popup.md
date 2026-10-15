# 014 ポップアップ

- Day：2
- 依存：011
- 参照：PLAN.md §9.4

## 目的

拡張機能のポップアップからワンクリックでコピーできるようにする。

## Todo

- [x] `src/popup/{popup.html, popup.ts, popup.css}`
  - [x] 「Copy thread as Markdown」ボタン
  - [x] アクティブタブに `EXTRACT_AND_COPY` を送り、結果（件数・警告・エラー）を表示する
  - [x] X 以外のタブ・`/status/` 以外のページではボタンを無効にし、理由を表示する
  - [x] コンテンツスクリプトが未注入（インストール直後でページを再読み込みしていない）なら、再読み込みを案内する
- [x] `tabs` 権限は追加しない（アクティブタブの ID で `sendMessage` する）

モード切替は 017、自動スクロールのチェックボックスは 018 で追加する。

## 完了条件

- [x] 実機でポップアップからコピーできる（2026-10-15 ユーザー確認済み：015 の B）
- [x] X 以外のタブ・`/status/` 以外のページで無効になり、理由が表示される（2026-10-15 ユーザー確認済み：015 の D）

## 作業メモ

- 構成
  - `src/popup/popupController.ts`：判断と表示（`pageState`・`isMissingReceiver`・`initPopup`）。Chrome API は `PopupApi` として外から渡すので、偽の API でテストできる
  - `src/popup/popup.ts`：`chrome.tabs.query`・`chrome.tabs.sendMessage`・`navigator.clipboard.writeText` を渡すだけ
- 判断したこと
  - `tabs` 権限が無いので、X 以外のタブでは `tab.url` が見えない（`undefined`）。これをそのまま「X 以外のタブ」として扱う
  - 要求には `source: 'popup'` を付ける
  - **ページ側でコピーに失敗した場合（`COPY_FAILED`）は、ポップアップがコピーを再試行する**。ポップアップを開いている間はページにフォーカスが無く、ページ側のコピーが失敗しうるため。ポップアップ側でも失敗したら、ポップアップ内に Markdown を出して手動でコピーしてもらう（このときページにはトーストを出さない。012）
  - 再試行で成功したときは件数が分からないので、「✅ Copied as Markdown」と表示する
  - コンテンツスクリプトが居ない場合の判定は、Chrome のエラー文（`Receiving end does not exist` / `Could not establish connection`）で行う。X の表示文言ではないので、セレクタの禁止事項には当たらない
  - 実行中はボタンを無効にし、「Copying…」と表示する
  - 見た目は X の青のボタン。ライト／ダークはブラウザの設定（`prefers-color-scheme`）に従う
- テスト：`tests/popup.test.ts`（24 件）。実際の `popup.html` を読み込み、偽の Chrome API で動かす。有効／無効の判定、送る要求、成功・警告・エラーの表示、再読み込みの案内、ポップアップでの再試行と手動コピー、実行中の無効化
- 組み上がった `dist/content.js` を jsdom で読み込む動作確認も行った（下の 015 参照）
- **実機で確認すること（015）**
  - ポップアップから実行したとき、ページ側のコピーが成功するか、ポップアップの再試行になるか（どちらでもコピーできれば良い）
  - X 以外のタブ（例：新しいタブ）で無効になり、理由が出るか
