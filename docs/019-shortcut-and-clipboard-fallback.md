# 019 ショートカットとクリップボードのフォールバック 3

- Day：3
- 依存：010, 011
- 参照：PLAN.md §3, §4, §9.1, §12

## 目的

キーボードショートカット（`Alt+Shift+M`）でコピーできるようにし、フォーカスが無い場合のコピー失敗に対応する。

## Todo

- [x] `src/background/sw.ts`：`chrome.commands.onCommand` で `copy-thread` を受け、アクティブタブに `EXTRACT_AND_COPY` を送る
- [x] Service Worker に状態を持たせない（停止しても壊れない）
- [x] ショートカット起点で 1 段目・2 段目のコピーが通るかを実機で検証する（2026-10-15 実機で通った）
- [x] 通らない場合のみ（1・2 段目で通ったので不要。`offscreen` 権限は追加しない）：オフスクリーンドキュメント（`reason: CLIPBOARD`）経由のコピーを実装し、`offscreen` 権限を追加する（理由を記録する）
- [x] 最終的に失敗した場合は手動コピー UI が出ることを確かめる（ショートカット起点の COPY_FAILED でトーストにテキストエリアが出る。tests/toast.test.ts）

## 完了条件

- [x] 実機でショートカットからコピーできる（2026-10-15 実機 OK）
- [x] `chrome://serviceworker-internals` で SW を停止した後もショートカットが動く（2026-10-15 実機 OK）

## 作業メモ

- 処理は `src/background/commands.ts` の `handleCommand(command, tab, api)` に分け、`sw.ts` は `chrome.commands.onCommand` に登録するだけにした（トップレベルで毎回登録するので、SW が停止→再起動しても動く。状態は持たない）
- 送り先は `onCommand` に渡されるタブ（無ければアクティブタブを問い合わせる）。URL が x.com / twitter.com のときだけ送る（他のサイトは host 権限が無いので URL が見えず、コンテンツスクリプトも無い）。`tabs` 権限は追加していない
- x.com の `/status/` 以外のページでは送る。コンテンツスクリプトがトーストで理由を出す（NOT_STATUS_PAGE）
- コンテンツスクリプトが無いタブ（拡張の導入・更新前に開いたページ）では送信が失敗するが、SW には UI が無く、ページにも出せないので何もしない（例外は握りつぶす）。README の既知の制約に書く
- コピー：ショートカットはページにフォーカスがある状態で押すので、1 段目（`navigator.clipboard.writeText`）か 2 段目（`execCommand`。`clipboardWrite` 権限あり）で通る見込み。実機で確認するまでオフスクリーンドキュメントは追加しない（PLAN §4 の方針どおり）。最終的に失敗した場合はトーストに手動コピー用のテキストエリアが出る
- テスト：tests/commands.test.ts（送り先の選択・X 以外の無視・他コマンドの無視・例外を出さない・manifest のコマンド名との一致）

### 実機確認（ユーザー作業）

1. `npm run build` → 拡張を再読み込み → x.com のタブも再読み込み
2. ポストのページで、ページ内（本文あたり）を一度クリックしてから `Alt+Shift+M` → トーストが出て、貼り付けられる
   - 何も起きない場合：`chrome://extensions/shortcuts` で「Copy thread as Markdown」に `Alt+Shift+M` が割り当てられているか（他の拡張と衝突すると未割り当てになる）
   - トーストが「Could not copy…」とテキストエリアになる場合：1・2 段目が通っていない。結果を教えてください（オフスクリーンドキュメントを追加します）
3. `chrome://serviceworker-internals` で本拡張の SW を Stop → x.com に戻って `Alt+Shift+M` → 同じく動く
4. x.com のホーム（`/home`）で `Alt+Shift+M` → 「Open a post…」のエラートースト
5. x.com 以外のタブで `Alt+Shift+M` → 何も起きない（エラーも出ない）

### 実機確認の結果

- 2026-10-15：手順 1・2・4・5 OK。ショートカット起点でもコピーが通った（1・2 段目で足りるので、オフスクリーンドキュメントは追加しない）
- 2026-10-15：手順 3 NG。`chrome://serviceworker-internals` で SW を Stop した後、x.com に戻ってショートカットを押しても動かない。再読み込みしたら動いた → 拡張のスイッチをオフ／オンしていた（拡張の無効化でコンテンツスクリプトが切り離されるため、ページの再読み込みが必要なのは想定どおり。既知の制約）
- 2026-10-15：`chrome://serviceworker-internals` の Stop で SW だけを止めてやり直し、ページを再読み込みせずにショートカットが動いた → 手順 3 OK
