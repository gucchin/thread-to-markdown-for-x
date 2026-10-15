<a id="en"></a>

# Privacy Policy — Thread to Markdown for X

English | [日本語](#ja)

Effective date: 2026-10-16

Thread to Markdown for X ("the extension") is a Chrome extension that copies the X (Twitter) thread you are viewing to your clipboard as Markdown.

## What the extension reads

When you use it (the in-page button, the popup or the keyboard shortcut), the extension reads the thread shown on the current x.com or twitter.com page: post text, author names and handles, dates, post URLs, image URLs and quoted posts. It does this locally in your browser, only on x.com and twitter.com, and does not use the X API.

## What it does with it

It converts what it reads into Markdown in memory and puts the result on your clipboard. That is all.

- It does **not** collect, store, sell or share the content of the pages you view or the text you copy.
- It does **not** send any data anywhere. The extension makes no network requests at all.
- It does **not** use analytics, tracking or advertising.

## What it stores

Only your settings: which posts to copy, auto-scroll on/off, image size, how dates and URLs are written, and whether to add YAML frontmatter. They are saved with `chrome.storage.sync`; if Chrome sync is turned on, Chrome syncs them across your devices through your Google Account. You can delete them by removing the extension.

## Permissions

- `storage`: to save the settings above.
- `clipboardWrite`: to copy the generated Markdown to your clipboard.
- Access to `x.com` and `twitter.com`: to show the "Copy as Markdown" button and read the thread you are viewing. The extension does not access any other site.

## Changes and contact

If this policy changes, the new version will be published at this address with a new effective date. Questions: please open an issue at <https://github.com/gucchin/thread-to-markdown-for-x/issues>.

---

<a id="ja"></a>

# プライバシーポリシー — Thread to Markdown for X

[English](#en) | 日本語

施行日：2026-10-16

Thread to Markdown for X（以下「本拡張機能」）は、表示中の X（旧 Twitter）のスレッドを Markdown にしてクリップボードへコピーする Chrome 拡張機能です。

## 読み取る情報

本拡張機能を使ったとき（ページ内のボタン・ポップアップ・ショートカット）に、表示中の x.com または twitter.com のページから、スレッドの内容（ポストの本文、投稿者の名前とユーザー名、日時、ポストの URL、画像の URL、引用ポスト）を読み取ります。読み取りはお使いのブラウザの中だけで行い、対象は x.com と twitter.com だけです。X の API は使いません。

## 読み取った情報の扱い

読み取った内容はメモリ上で Markdown に変換し、クリップボードに渡すだけです。

- 表示したページやコピーした内容を、収集・保存・販売・共有することは**ありません**。
- データを外部に送信することは**ありません**。本拡張機能は通信を一切行いません。
- アクセス解析・トラッキング・広告は**使いません**。

## 保存する情報

保存するのは設定だけです（コピーするポスト、自動スクロールのオン／オフ、画像サイズ、日時と URL の書き方、YAML frontmatter の有無）。`chrome.storage.sync` に保存され、Chrome の同期がオンの場合は、Chrome が Google アカウントを通じてお使いの端末間で同期します。本拡張機能を削除すると設定も削除されます。

## 権限

- `storage`：上記の設定を保存するため。
- `clipboardWrite`：生成した Markdown をクリップボードへコピーするため。
- `x.com`・`twitter.com` へのアクセス：「Copy as Markdown」ボタンを表示し、表示中のスレッドを読み取るため。これ以外のサイトにはアクセスしません。

## 変更とお問い合わせ

本ポリシーを変更する場合は、施行日を更新してこのページで公開します。ご質問は <https://github.com/gucchin/thread-to-markdown-for-x/issues> で Issue を作成してください。
