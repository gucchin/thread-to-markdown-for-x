# 011 コンテンツスクリプトのエントリとメッセージ

- Day：2
- 依存：008, 009, 010
- 参照：PLAN.md §3, §9.1

## 目的

抽出 → 整形 → コピー → 通知を 1 本につなぎ、ポップアップやボタンから呼べるようにする。

## Todo

- [x] 「抽出してコピー」を行う関数を 1 つにまとめる（ボタン・ポップアップ・ショートカットで共有）
- [x] `src/content/index.ts`：`chrome.runtime.onMessage` で `EXTRACT_AND_COPY` を受け、結果（件数・警告／エラー）を応答する
- [x] 例外はここで捕まえてエラー結果に変える（UI まで素通りさせない）
- [x] 設定は 016 ができるまで既定値を使う
- [x] 抽出データはメモリ上だけで扱い、どこにも保存しない

## 完了条件

- [x] x.com の `/status/` ページでメッセージを送るとコピーされ、応答が返る（2026-10-15 ユーザー確認済み：015 の A・B）
- [x] エラー時もエラー結果が応答として返る（単体テストで確認）

## 作業メモ

- 構成
  - `src/content/extractAndCopy.ts`：`extractAndCopy(env)`。抽出 → Markdown → コピーの流れ。例外は投げず、失敗はすべて応答（`ok: false`）にする。想定外の例外は `UNKNOWN`
  - `src/content/controller.ts`：`createController(task, onResult)` は、実行中にもう一度呼ばれたら同じ結果を共有する（ボタンとポップアップの同時押しで 2 回コピーしない）。`createMessageListener` は `EXTRACT_AND_COPY` 以外を無視し、非同期で応答するためにチャネルを開いたままにする
  - `src/content/index.ts`：上の部品をつなぐだけ
- 応答の形（`src/shared/messages.ts`）
  - 成功：`{ ok: true, count, truncated, warnings }`。`truncated` はトーストの「(1 truncated)」用
  - 失敗：`{ ok: false, code, message, markdown? }`。`COPY_FAILED` のときだけ `markdown` を付ける。ポップアップから実行するとページにフォーカスが無く、ページ側のコピーが失敗しうるため、ポップアップ側で再試行できるようにした（014）。トーストの手動コピー欄にも使う（012）
- Markdown の時刻はブラウザのローカルタイムゾーン、画像の解像度は `large`（016 で設定から読む）
- テスト：`tests/extractAndCopy.test.ts`（9 件）。フィクスチャでの成功、省略表示の件数、抽出エラー時にコピーしないこと、コピー失敗時に Markdown を返すこと、例外を `UNKNOWN` にすること、同時実行の共有、メッセージの受け付け／無視
