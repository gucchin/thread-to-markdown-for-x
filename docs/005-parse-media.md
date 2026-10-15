# 005 メディアの抽出と URL 正規化（parseMedia）

- Day：1
- 依存：002, 003
- 参照：PLAN.md §7.4

## 目的

ポストに添付された画像・動画・GIF を `Media[]` にする。

## Todo

- [x] `src/content/extract/parseMedia.ts`
  - [x] 画像：`pbs.twimg.com/media/<ID>?format=jpg&name=small` の `name` を `large`（既定）／`orig`（引数で指定）に置き換える
  - [x] 動画・GIF：`video[poster]` の poster URL と種別を記録する。**`blob:` URL は出力しない**
  - [x] 代替テキストがあれば `alt` に入れる
  - [x] プロフィール画像・カードのサムネイル・絵文字は除外する
- [x] 単体テスト：解像度の置き換え（`large`/`orig`）、画像 4 枚の件数と順序、`blob:` を出力しないこと、除外対象が混ざらないこと

## 完了条件

- [x] 画像 4 枚のフィクスチャで 4 件が正しい URL で取れる（代替で確認：画像 4 枚の実フィクスチャは無い。`image3.html` の 3 枚、`thread.html` の 4 件カルーセル（動画 3＋画像 1）、合成 HTML の画像 4 枚で確認した）
- [x] 出力に `blob:` が含まれない

## 作業メモ

- 画像は `pbs.twimg.com/media/` で始まるものだけを採用する。これでアバター（`profile_images`）・カードのサムネイル（`card_img`）・絵文字（`abs.twimg.com`）が除外される
- `exclude` で指定した要素（引用カード）の中のメディアは飛ばす。引用の画像が本体に混ざらないようにするため
- poster が無い・`blob:` の動画は、ポスト URL（`fallbackUrl`）を記録する
- **実 DOM で分かったこと**
  - 複数のメディアは、横スクロールのカルーセル（`ScrollSnap-List`）で表示される
  - 動画も `tweetPhoto` の中にあり、poster と同じ画像（`amplify_video_thumb/...`）の `<img>` を持つ。`pbs.twimg.com/media/` で始まらないので画像としては数えず、動画 1 件として記録される
  - 画像のリンクは `/status/<id>/photo/<n>`。`n` はカルーセル内の位置で、動画を含めて数える。動画には画像のリンクが無い
  - `<video>` の `src` は実際に `blob:`。`poster` 属性には `pbs.twimg.com` の URL が入っている
- **未解決（015 で確認）**
  - ~~GIF と動画の見分け方が不明なので、今はすべて `video` として記録している~~ → 解決（015）：gif.html で確認。GIF は `<video src="https://video.twimg.com/tweet_video/….mp4" poster="https://pbs.twimg.com/tweet_video_thumb/….jpg">`。poster の接頭辞（`GIF_POSTER_PREFIX`）で `gif` と判定する
  - X は代替テキストが無い画像にも、UI 言語の既定値（日本語 UI では「画像」）を `alt` に入れる。表示文言との比較は禁止なので見分けられず、今はそのまま記録している。§8.1 の出力形式では `alt` を使わないので、当面は影響しない
- テスト：`tests/parseMedia.test.ts`（13 件）
