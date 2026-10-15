# Thread to Markdown for X

[English](README.md) | 日本語

X（旧 Twitter）のスレッドを、LLM・Notion・Obsidian に貼り付けやすい Markdown にしてクリップボードへコピーする Chrome 拡張機能（Manifest V3）です。

- X の API は使わず、**ログイン中のブラウザに表示されている DOM** から抽出します
- 外部への通信は一切しません。抽出した内容はメモリ上だけで扱い、保存も送信もしません（保存するのは設定値だけ）
- 権限は `storage`・`clipboardWrite` と、`x.com` / `twitter.com` へのアクセスだけです

## インストール

### 配布された zip から

1. `thread-to-markdown-for-x-<version>.zip` を任意のフォルダに展開する
2. Chrome で `chrome://extensions` を開き、右上の「デベロッパー モード」をオンにする
3. 「パッケージ化されていない拡張機能を読み込む」で、展開したフォルダ（`manifest.json` があるフォルダ）を選ぶ
4. **すでに開いている x.com のタブは再読み込みする**（読み込む前に開いたページでは動きません）

### ソースからビルドする

Node.js 22.2 以降が必要です（zip 作成に `node:zlib` の `crc32` を使うため）。

```sh
npm install
npm run build      # dist/ に拡張機能ができる（これを上の手順 3 で読み込む）
npm run package    # ビルドして thread-to-markdown-for-x-<version>.zip を作る
```

## 使い方

個別ポストのページ（`https://x.com/<user>/status/<id>`）で、次のどれかを使います。

| 方法 | 操作 |
|---|---|
| ページ内ボタン | メインポストのアクション（返信・いいね等）の下に出る「Copy as Markdown」ボタン |
| ポップアップ | ツールバーの拡張機能アイコン →「Copy thread as Markdown」 |
| ショートカット | `Alt+Shift+M`（`chrome://extensions/shortcuts` で変更できます） |

コピーが終わると、右下に結果（例：`✅ 5 posts copied as Markdown`）が表示されます。コピーに失敗した場合は、Markdown がテキストエリアに表示されるので手動でコピーしてください。

### 設定

ポップアップの「Options」、または `chrome://extensions` の「詳細」→「拡張機能のオプション」から変更できます。変更はすぐ保存され、次のコピーから反映されます。

| 設定 | 選択肢（太字が既定） | 内容 |
|---|---|---|
| Posts to copy | **著者のスレッドのみ** ／ 全リプライ | 全リプライでは、他の人の返信も含め、各見出しに `— @handle` を付けます（ポップアップでも切り替え可） |
| Auto-scroll | **オフ** ／ オン | 画面外のポストを集めるため自動で下にスクロールします（ポップアップでも切り替え可） |
| Image size | **Large** ／ Original | 画像 URL の `name=` パラメータ |
| Date and URL of each post | **HTML コメント** ／ 通常行 | HTML コメントは Obsidian・Notion のプレビューでは表示されません |
| Obsidian | **frontmatter なし** ／ あり | 先頭に YAML frontmatter（title・author・source・date・posts・tags）を付けます |

### 出力例

```markdown
# X Thread by @username (2026-10-14)

- Author: 表示名 (@username)
- Source: https://x.com/username/status/1234567890
- Posts: 2
- Extracted: 2026-10-14 21:30 (+09:00)

---

### Tweet 1 (Main)
<!-- 2026-10-14 09:12 +09:00 · https://x.com/username/status/1234567890 -->

本文テキスト…

- Attached Media:
  - [image] https://pbs.twimg.com/media/XXXX?format=jpg&name=large
  - [video] (poster) https://pbs.twimg.com/amplify_video_thumb/...

> **Quoted post by @other** (2026-10-13)
> 引用元の本文…
> Source: https://x.com/other/status/987

### Tweet 2
<!-- 2026-10-14 09:15 +09:00 · https://x.com/username/status/1234567891 -->

リプライ本文…
```

本文はほぼそのまま出力します。Markdown の構造を壊す行頭の記号（見出しになる `# `、`>`、`---` など）だけをエスケープします。

## 既知の制約

- **画面に表示されているポストだけ**が対象です。X は画面外のポストを DOM から消すため、長いスレッドは途中までになることがあります。自動スクロールをオンにすると下方向に集めます
- 自動スクロールは **100 件・30 秒**で止まります（途中で「Stop」も可能）。止まった場合は、トーストと Markdown の末尾に「続きがあるかもしれない」旨の警告が出ます。メインポストより上は、開いた時点で表示されている分だけです。「返信をさらに表示」のようなボタンは押しません
- 「もっと見つける」（おすすめ）より下のポストは、同じ著者のものでも含めません
- 「さらに表示」で省略された長文は、X 自身の「さらに表示」を押して展開してから抽出します。3 秒以内に展開されなかったポストは省略されたまま出力し、警告を付けます
- 動画・GIF は poster 画像の URL だけを記録します（動画本体の URL は取得しません）
- 画像の ALT テキストは出力しません。X は ALT の無い画像にも UI 言語の既定値（日本語なら「画像」）を入れるため、本物の ALT と区別できないためです
- 引用ポストの URL は、引用カード内に画像があるときしか取れません（取れない場合は `Source:` 行を省きます）
- 拡張機能のインストール・更新より前に開いたタブでは動きません。ページを再読み込みしてください（ショートカットはこの場合、何も起きません）
- X の画面構造（DOM）が変わると、抽出できなくなることがあります（下の「セレクタの修正方法」）

## セレクタの修正方法（X の DOM が変わったとき）

X の DOM への依存はすべて `src/content/extract/selectors.ts` に集めてあります。難読化されたクラス名（`css-xxxxx`・`r-xxxxx`）・`aria-label`・表示文言（UI 言語で変わる）には依存しません。

1. 動かなくなったページを開き、DevTools のコンソールで次を実行する（ページの `main` 要素が URL 付きでクリップボードに入る）

   ```js
   copy('<!-- url: ' + location.href + ' -->\n' + document.querySelector('main').outerHTML)
   ```

2. `tests/fixtures/raw/<case>.html` に保存する（このフォルダは Git の対象外。実在のユーザー名・本文を含むため）
3. 匿名化したフィクスチャを作る。匿名化に失敗した（元の値が残った）場合はエラーになります

   ```sh
   node scripts/anonymize.mjs tests/fixtures/raw/<case>.html tests/fixtures/<case>.html
   ```

4. `npm test` で、どの抽出が壊れたかを確認する。フィクスチャをテストに追加する場合は、既存のものと同じく `import html from './fixtures/<case>.html?raw'` で読み込む
5. `selectors.ts` のセレクタを直す（新しいセレクタには用途をコメントで書く）
6. スナップショットの差分が意図どおりであることを確認してから `npx vitest run -u` で更新する
7. `npm run build` で作り直し、実機で確認する

## 開発

| コマンド | 内容 |
|---|---|
| `npm run build` | `dist/` を作り直す |
| `npm run package` | ビルドして配布用 zip を作る |
| `npm test` | テスト（Vitest + jsdom） |
| `npm run typecheck` | 型チェック |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run check:no-network` | `src/` に `fetch(` / `XMLHttpRequest` が無いことの確認 |

設計は `PLAN.md`、開発の進め方は `CLAUDE.md`、作業チケットは `docs/` を参照してください。

## ライセンス

[MIT](LICENSE)
