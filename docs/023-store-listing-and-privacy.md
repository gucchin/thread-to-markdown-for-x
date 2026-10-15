# 023 ストア掲載文・プライバシー申告・プライバシーポリシー

- Day：4
- 依存：021, 022
- 参照：PLAN.md §10, §16.3, §16.4, §16.5

## 目的

ストアに入力する文章一式を、実装と食い違わない形で用意する。

## Todo

- [x] `docs/store/listing.ja.md`・`docs/store/listing.en.md`
  - [x] 短い説明（132 文字以内。`manifest.json` の `description` と同じにする）
  - [x] 詳しい説明：機能・使い方（3 経路）・設定・既知の制約・無料であること・ソースコードの公開先（GitHub）
  - [x] 実装にない機能を書いていないか、README と突き合わせる
  - [x] カテゴリ：仕事効率化（Productivity）
- [x] `docs/store/privacy-practices.md`（「プライバシーへの取り組み」タブの入力内容）
  - [x] 単一用途
  - [x] 権限ごとの理由（`storage`・`clipboardWrite`・x.com/twitter.com）
  - [x] リモートコード：使用しない
  - [x] データ使用の申告（ページの内容を収集・送信しない。外部への通信なし）
- [x] `PRIVACY.md`（日本語・英語）：収集・送信しないこと・外部通信なし・保存するもの（設定のみ）・問い合わせ先（GitHub の Issues）
- [x] `PRIVACY.md` を公開 URL に置く（022 の GitHub Pages）

## 完了条件

- [ ] 文章一式がそろい、ユーザーが内容を確認済み
- [x] プライバシーポリシーの公開 URL が決まっている（https://gucchin.github.io/thread-to-markdown-for-x/PRIVACY.html）

## 作業メモ

- 掲載文は README と実装（`thread.ts`・`parseText.ts`・`parseMedia.ts`・`expandTruncated.ts`・オプションページの文言）を 1 文ずつ突き合わせて書いた。ストアの説明欄は Markdown を解釈しないので、記号は「•」「・」と大文字の見出しだけ
- 概要（短い説明）はダッシュボードでは `manifest.json` の `description` から取られて編集できない。`_locales` が無いので日本語の掲載ページでも英語の概要が出る（`listing.ja.md` に記載）
- 「データの使用」は、ページの内容を読むが端末の外に出さないので「収集しない」と判断した（根拠は `privacy-practices.md`。審査で指摘されたら従う）
- X とは無関係である旨を掲載文の末尾に入れた（商標の扱いで誤解されないように）
- `tests/store.test.ts`：概要と `manifest.json` の `description` の一致（132 文字以内）、掲載文にショートカット・対象サイト・GitHub の URL があること、申告の権限一覧が manifest の権限と一致すること、ポリシーに全権限が書かれていること、申告にポリシーの URL があることを確認する
- GitHub Pages：`_config.yml` でソース・テスト・チケットなどを除外し、README（トップページ）と `PRIVACY.md` だけを公開。ビルド後に、ポリシーが表示されることと、除外したパスが 404 になることを確認した
