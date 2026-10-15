# 010 クリップボード（clipboard.ts）

- Day：2
- 依存：001
- 参照：PLAN.md §9.1

## 目的

Markdown をクリップボードへコピーする。失敗したら次の手段を試す。

## Todo

- [x] `src/content/clipboard.ts`
  - [x] 1 段目：`navigator.clipboard.writeText()`
  - [x] 2 段目：一時 `textarea` + `document.execCommand('copy')`。使った要素は必ず取り除く
  - [x] 結果（成功／失敗と、どの段で成功したか）を返す。最終的に失敗した場合は、呼び出し側（012 のトースト）が手動コピー UI を出す
- [x] 単体テスト：1 段目成功、1 段目失敗 → 2 段目成功、両方失敗

3 段目（オフスクリーンドキュメント）の要否は 019 で検証する。

## 完了条件

- [x] 3 パターンのテストが通る

## 作業メモ

- API：`copyText(text, env?)` → `{ ok: true, method: 'clipboard-api' | 'exec-command' }` か `{ ok: false, error }`。例外は投げない。`env`（`clipboard`・`document`）はテスト用の差し替え口
- 2 段目では textarea にフォーカスして全選択し、終わったら必ず要素を消し、元のフォーカスを戻す（例外時も）
- 失敗時の `error` には両方の段の理由を入れる（実機での原因調査用）
- テスト：`tests/clipboard.test.ts`（6 件）。jsdom には `navigator.clipboard` も `execCommand` も無いので、差し替えて検証している。2 段目でコピーされた中身、要素の削除、フォーカスの復元も確認する
- **実機で確認すること（015）**：ポップアップから実行した場合、ページにフォーカスが無いので 1 段目は失敗するはず。2 段目が `clipboardWrite` 権限で通るかを確かめる。通らない場合のためにポップアップ側でもコピーを再試行する（014）
