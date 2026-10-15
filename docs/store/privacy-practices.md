# プライバシーへの取り組み（申告文）

Chrome Web Store Developer Dashboard の「プライバシーへの取り組み」タブに入力する内容（PLAN.md §10, §16.4）。
入力欄は英語で書く（審査担当が読む。コードブロックの中をそのまま貼る）。実装を変えて権限・通信・保存するものが
変わったら、ここと `PRIVACY.md` を必ず更新する。

## 単一用途の説明（Single purpose description）

```text
Copies the X (Twitter) thread that the user is viewing to the clipboard as Markdown, so it can be pasted into an LLM, Notion or Obsidian.
```

## 権限が必要な理由（Permission justification）

`storage`

```text
Saves the user's output settings only (which posts to copy, auto-scroll on/off, image size, how dates and URLs are written, and whether to add YAML frontmatter). No page content or copied text is stored.
```

`clipboardWrite`

```text
Writes the generated Markdown to the clipboard when the user clicks the in-page button, clicks the button in the popup, or presses the keyboard shortcut. A fallback copy method is used when the page does not have focus.
```

ホスト権限（Host permission justification：`https://x.com/*`, `https://twitter.com/*`）

```text
The content script runs only on x.com and twitter.com. It adds a "Copy as Markdown" button to post pages and reads the thread shown on the page, locally in the browser, to convert it to Markdown. The extension does not access any other site.
```

## リモートコード（Are you using remote code?）

- **No, I am not using remote code**
- 理由欄が必要な場合：

```text
All code is bundled in the extension package. It does not load or run any external scripts and does not use eval.
```

## データの使用（Data usage）

収集するデータの種類：**どれにもチェックしない**

- 個人を特定できる情報・健康・金融・認証・個人的な通信・位置情報・ウェブ履歴・ユーザーのアクティビティ・ウェブサイトのコンテンツ：いずれも収集しない
- 判断の根拠：表示中のページの内容（ポストの本文など）は読み取るが、ブラウザのメモリ上で Markdown に変換してクリップボードに渡すだけで、保存も送信もしない（外部への通信が一切無いことは `npm run check:no-network` で確認している）。端末の外に出ないので「収集」には当たらないと判断した
- 審査で「ウェブサイトのコンテンツ」の申告を求められた場合は、指摘に従って申告し、ここに理由を記録する

開示事項（3 つともチェックする）

- [ ] I do not sell or transfer user data to third parties, outside of the approved use cases
- [ ] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [ ] I do not use or transfer user data to determine creditworthiness or for lending purposes

## プライバシーポリシー（Privacy policy URL）

```text
https://gucchin.github.io/thread-to-markdown-for-x/PRIVACY.html
```

（`PRIVACY.md` を GitHub Pages で公開した URL。docs/022）
