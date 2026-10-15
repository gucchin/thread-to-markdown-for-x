# 023 ストア掲載文・プライバシー申告・プライバシーポリシー

- Day：4
- 依存：021, 022
- 参照：PLAN.md §10, §16.3, §16.4, §16.5

## 目的

ストアに入力する文章一式を、実装と食い違わない形で用意する。

## Todo

- [ ] `docs/store/listing.ja.md`・`docs/store/listing.en.md`
  - [ ] 短い説明（132 文字以内。`manifest.json` の `description` と同じにする）
  - [ ] 詳しい説明：機能・使い方（3 経路）・設定・既知の制約・無料であること・ソースコードの公開先（GitHub）
  - [ ] 実装にない機能を書いていないか、README と突き合わせる
  - [ ] カテゴリ：仕事効率化（Productivity）
- [ ] `docs/store/privacy-practices.md`（「プライバシーへの取り組み」タブの入力内容）
  - [ ] 単一用途
  - [ ] 権限ごとの理由（`storage`・`clipboardWrite`・x.com/twitter.com）
  - [ ] リモートコード：使用しない
  - [ ] データ使用の申告（ページの内容を収集・送信しない。外部への通信なし）
- [ ] `PRIVACY.md`（日本語・英語）：収集・送信しないこと・外部通信なし・保存するもの（設定のみ）・問い合わせ先（GitHub の Issues）
- [ ] `PRIVACY.md` を公開 URL に置く（022 の GitHub Pages）

## 完了条件

- [ ] 文章一式がそろい、ユーザーが内容を確認済み
- [ ] プライバシーポリシーの公開 URL が決まっている
