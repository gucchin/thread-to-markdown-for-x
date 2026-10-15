# PLAN.md — X Thread → Markdown Clipper (Chrome Extension, MV3)

> 本ドキュメントは Claude Code に実装を依頼するための開発計画書です。
> 実装は **Phase 単位** で進め、各 Phase の「完了条件」をすべて満たしてから次へ進むこと。

---

## 0. TL;DR

- X（Twitter）のスレッドを **DOM から抽出**し、LLM 入力や Notion/Obsidian 保存に最適化した Markdown にして **クリップボードへコピー**する Chrome 拡張（Manifest V3）。
- 外部通信なし・X API 不使用・コンテンツ保存なし。権限は最小限。
- 壊れやすい部分（X の DOM 構造）は **`selectors.ts` 1ファイルに隔離**し、**HTML フィクスチャによる自動テスト**で守る。
- 期間：2〜3日（Day 1：抽出コア＋テスト、Day 2：UI・コピー・スレッド判定、Day 3：自動スクロール収集・設定・仕上げ）。Day 1〜3 は 2026-10-15 に完了。
- Day 4：Chrome ウェブストアでの公開と、ソースコードの GitHub 公開（§16）。

---

## 1. スコープ

### 1.1 MVP（必須）
1. X の個別ポストページ（`/<user>/status/<id>`）で、メインポストに **「Copy as Markdown」ボタン**を表示
2. 拡張機能ポップアップからも **ワンクリック実行**
3. 抽出項目：投稿者（表示名・@ハンドル）、本文、投稿日時、ポスト URL、画像 URL、動画の有無、引用ポスト
4. スレッド判定：**画面内にレンダリング済みの「同一著者の連続ポスト」** を収集
5. Markdown 整形 → クリップボードへコピー → **トースト通知**

### 1.2 Should（Day 3 で余裕があれば）
- 自動スクロール収集モード（仮想スクロール対策、上限付き）
- 出力オプション：YAML frontmatter（Obsidian 向け）、リプライ全件モード（他者リプライも含める）、画像 URL 解像度
- キーボードショートカット（例：`Alt+Shift+M`）

### 1.3 スコープ外（明示的にやらない）
- X API / 非公開 GraphQL エンドポイントの直接呼び出し
- 未ログイン状態でのスクレイピング、バックグラウンドでの大量クロール
- Notion API / Obsidian への直接書き込み（将来拡張。今回はクリップボードまで）
- 抽出内容のサーバ送信・永続保存・解析ログ送信

---

## 2. 技術スタック

| 項目 | 選定 | 理由 |
|---|---|---|
| 言語 | TypeScript（strict） | DOM 抽出のデータ型を固定して壊れにくくする |
| バンドル | esbuild（または Vite） | 依存を最小化。MV3 は ESM の SW をそのまま扱える |
| テスト | Vitest + jsdom | HTML フィクスチャに対して抽出・整形を単体テスト |
| Lint/Format | ESLint + Prettier | — |
| ランタイム依存 | **なし**（Markdown 整形は自前実装） | サプライチェーンリスクと審査負荷を下げる |

> フレームワーク（WXT / CRXJS 等）は使ってもよいが、2〜3日の規模なら素の構成で十分。Claude Code が迷ったら「依存の少ない方」を選ぶ。

---

## 3. アーキテクチャ

```
┌────────────── x.com タブ ──────────────┐
│ Content Script (isolated world)         │
│  ├ ui/button.ts   … ボタン注入(MutationObserver) │
│  ├ ui/toast.ts    … Shadow DOM トースト     │
│  ├ extract/*      … DOM → TweetData[]     │
│  ├ markdown.ts    … TweetData[] → string  │
│  └ clipboard.ts   … コピー(フォールバック付) │
└───────▲────────────────────────────────┘
        │ chrome.tabs.sendMessage({type:'EXTRACT_AND_COPY'})
┌───────┴──────────┐      ┌──────────────────┐
│ Popup            │      │ Service Worker   │
│ ・実行ボタン     │      │ ・commands(ショートカット)│
│ ・結果/エラー表示 │      │ ・状態を持たない      │
└──────────────────┘      └──────────────────┘
        設定: chrome.storage.sync（出力オプションのみ）
```

**設計原則**
- **抽出・整形は純粋関数**（`Element → TweetData`, `TweetData[] → string`）。UI・Chrome API と分離し、jsdom でテスト可能にする。
- Service Worker は **ステートレス**（MV3 では SW がいつ停止しても壊れないように）。
- 実処理はすべて Content Script 内で完結。Popup/SW はメッセージで起動するだけ。

---

## 4. manifest.json（方針）

```jsonc
{
  "manifest_version": 3,
  "name": "Thread to Markdown for X",
  "version": "1.0.0",
  "minimum_chrome_version": "120",
  "permissions": ["storage", "clipboardWrite"],
  "host_permissions": ["https://x.com/*", "https://twitter.com/*"],
  "content_scripts": [{
    "matches": ["https://x.com/*", "https://twitter.com/*"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }],
  "background": { "service_worker": "sw.js", "type": "module" },
  "icons": { "16": "icons/icon16.png", "32": "icons/icon32.png", "48": "icons/icon48.png", "128": "icons/icon128.png" },
  "action": { "default_popup": "popup.html", "default_icon": { "16": "icons/icon16.png", "32": "icons/icon32.png" } },
  "options_ui": { "page": "options.html", "open_in_tab": false },
  "commands": {
    "copy-thread": { "suggested_key": { "default": "Alt+Shift+M" }, "description": "Copy thread as Markdown" }
  }
}
```

- `<all_urls>` は使わない。`tabs` 権限も不要（`sendMessage` はアクティブタブ ID があれば可）。
- リモートコード読み込み・`eval`・`innerHTML` への外部文字列代入は禁止。
- オフスクリーンドキュメント（`offscreen` 権限）は **クリップボードのフォールバックが必要と判明した場合のみ**追加。

---

## 5. ディレクトリ構成

```
thread-to-markdown-for-x/
├─ PLAN.md / CLAUDE.md / README.md
├─ src/
│  ├─ manifest.json
│  ├─ background/sw.ts
│  ├─ popup/{popup.html, popup.ts, popup.css}
│  ├─ options/{options.html, options.ts}        # Day 3
│  ├─ content/
│  │  ├─ index.ts              # エントリ：observer起動・メッセージ受信
│  │  ├─ extract/
│  │  │  ├─ selectors.ts       # ★ X依存セレクタをここに集約
│  │  │  ├─ parseTweet.ts      # article → TweetData
│  │  │  ├─ parseText.ts       # tweetText → プレーンテキスト(リンク/絵文字/改行)
│  │  │  ├─ parseMedia.ts      # 画像URL正規化・動画検出
│  │  │  ├─ parseQuote.ts      # 引用ポスト
│  │  │  ├─ thread.ts          # スレッド範囲判定・重複排除・並び順
│  │  │  └─ autoScroll.ts      # Day 3
│  │  ├─ markdown.ts
│  │  ├─ clipboard.ts
│  │  └─ ui/{button.ts, toast.ts}
│  └─ shared/{types.ts, messages.ts, settings.ts}
├─ tests/
│  ├─ fixtures/*.html          # 匿名化済みのX DOMスナップショット
│  ├─ parseTweet.test.ts / thread.test.ts / markdown.test.ts
│  └─ __snapshots__/
└─ scripts/build.mjs
```

---

## 6. データモデル

```ts
// shared/types.ts
export interface Author {
  displayName: string;
  handle: string;        // "@" なし
}

export interface Media {
  type: 'image' | 'video' | 'gif';
  url: string;           // 画像: 正規化済み / 動画: poster URL またはポストURL
  alt?: string;          // 代替テキストがあれば
}

export interface TweetData {
  id: string;            // status ID（重複排除キー）
  url: string;           // https://x.com/<handle>/status/<id>
  author: Author;
  datetime: string | null; // ISO8601（<time datetime>）
  text: string;
  truncated: boolean;    // 「さらに表示」で省略されている
  media: Media[];
  quote: QuotedTweet | null;  // 引用は1段まで
  isMain: boolean;       // URLのstatus IDと一致
}

// 引用ポスト。引用カード自体はパーマリンクを持たず、カード内に /status/ リンク（添付画像など）が
// ある場合だけ ID・URL が分かる（§7.2）。そのため id・url は null 許容。isMain は持たない
export type QuotedTweet = Omit<TweetData, 'quote' | 'id' | 'url' | 'isMain'> & {
  id: string | null;
  url: string | null;
};

export interface ThreadResult {
  sourceUrl: string;
  rootAuthor: Author;
  tweets: TweetData[];   // 表示順
  warnings: string[];    // 例: "2件のポストが省略表示のため全文取得できませんでした"
  extractedAt: string;
}
```

---

## 7. DOM 抽出ロジック

### 7.1 セレクタ方針（`selectors.ts` に集約）

| 対象 | セレクタ | 備考 |
|---|---|---|
| ポスト | `article[data-testid="tweet"]` | 基準単位 |
| 本文 | `div[data-testid="tweetText"]` | 引用内にも存在 → スコープ判定必須 |
| 投稿者 | `div[data-testid="User-Name"]` | 表示名と `@handle` を含む |
| 日時・パーマリンク | `time[datetime]` とその親 `a[href*="/status/"]` | 日時の `datetime` は UTC ISO |
| 画像 | `div[data-testid="tweetPhoto"] img` | `src` が `pbs.twimg.com/media/...` |
| 動画 | `div[data-testid="videoPlayer"]`, `video[poster]` | `blob:` URL は使わない |
| 省略表示 | `[data-testid="tweet-text-show-more-link"]` | 存在すれば `truncated=true` |
| タイムラインのセル | `div[data-testid="cellInnerDiv"]` | 並び順の基準 |
| セクション見出し | `div[data-testid="cellInnerDiv"] h2` | 会話の下の「もっと見つける」。これより後はおすすめ（ポスト内に `h2` は無い） |

**禁止事項**
- `css-xxxxx` / `r-xxxxx` などの難読化クラスへの依存
- `aria-label` や表示テキスト（「返信」「Show more」等）による判定 → **UI言語で壊れる**
- `nth-child` など構造位置への強い依存（やむを得ない場合はコメントで理由を書く）

### 7.2 引用ポストの切り分け
- 引用は `article` 内に **2つ目の `User-Name` / `tweetText`** として入れ子で現れる（`div[role="link"]` で囲まれる）。
- 手順：article 内の `User-Name` / `tweetText` / `time` を全取得 → 各要素について「引用コンテナ（`div[role="link"]` で、内部に `User-Name` を持つもの）」の内側かどうかで **本体側 / 引用側** に振り分ける。
- 引用の URL は引用コンテナ内の `a[href*="/status/"]` から取得（取れない場合は `null` 許容）。

### 7.3 本文テキストの復元（`parseText.ts`）
`tweetText` の子ノードを再帰走査して組み立てる：
- テキストノード：そのまま
- `img`（絵文字）：`alt` を採用
- `a`（URL）：表示は `…` で切り詰められるため、**`textContent` が URL 形式ならそれを、そうでなければ `href`（t.co）** を採用
- `@mention` / `#hashtag`：テキストのまま（リンク化は任意。LLM 用途ではプレーンで十分）
- `br` / ブロック要素：改行に変換
- 連続空行は最大1つに正規化、前後の空白を trim

### 7.4 メディア URL 正規化（`parseMedia.ts`）
- `https://pbs.twimg.com/media/<ID>?format=jpg&name=small` → `name` を **`large`（既定）/ `orig`（設定で選択）** に置換
- 動画・GIF：`video[poster]` の poster URL を記録し、種別を明記。本体の動画 URL は取得しない（`blob:` のため。GIF の src は実 mp4 だが、統一のため poster のみ）。GIF は poster が `pbs.twimg.com/tweet_video_thumb/` で始まるもので判定する（動画は `amplify_video_thumb` / `ext_tw_video_thumb`）
- プロフィール画像・カードのサムネイル・絵文字は **除外**

### 7.5 スレッド範囲の判定（`thread.ts`）
1. URL から `mainId` と著者ハンドルを取得（`/status/` 以外のページではエラーを返す）
2. 画面内の全 `article` を DOM 順に解析し、`id` で重複排除。セクション見出し（「もっと見つける」）で区切り、**メインと同じセクションだけ**を対象にする（見出しの後はおすすめで、同じ著者のポストが続くこともある。2026-10-15 にフィクスチャ 3 件で確認）
3. `isMain` のポストを起点に：
   - **上方向**：メインより前にある同一著者の連続ポスト（メインがスレッド途中の場合の親）
   - **下方向**：メイン直後から、**同一著者のポストが続く限り**収集。他者のポストが現れた時点で終了（モード「著者のみ」）
4. 「リプライ全件」モード（Should）：メイン以降の全ポストを収集し、著者を各見出しに表示（上方向はモードによらず同一著者のみ）
5. 「さらに表示」で省略されたポストは、まず X 自身の「さらに表示」ボタン（その場で全文を展開する `<button>`）を押して展開し、MutationObserver で展開を待って（上限 3 秒）抽出し直す。展開できずに残ったものは `truncated=true` とし、`warnings` に追加
   - 実機で、スレッドの続きの長文ポストが省略表示されることを確認した（2026-10-15）。押すのはスレッドのポストのボタンだけ。リンク（`<a>`）の「さらに表示」と、引用カード内のものは押さない（ページを離れてしまうため）
   - 全文の取得は X 自身の処理が行う。拡張機能自体は通信しない
6. 取得件数が 0 件 / メインが見つからない場合は、明確なエラーメッセージを返す（例外を UI まで素通りさせない）

### 7.6 自動スクロール収集（Day 3・Should）
- `window.scrollBy` で段階的にスクロールし、各ステップで抽出 → `Map<id, TweetData>` に蓄積
- **停止条件**：(a) 他者ポストが出現（著者のみモード）、(b) 新規ポストが N 回連続で 0 件、(c) 上限件数（既定 100）、(d) 上限時間（既定 30 秒）、(e) ユーザーがトーストの「中止」を押下
- 終了後は元のスクロール位置に戻す
- 待機は固定 sleep ではなく MutationObserver + タイムアウトで「DOM 変化の収束」を待つ
- 実装メモ（docs/018）：
  - 各ステップの読み取り（ポストとセクション見出し）を ID で順序どおりに統合し、§7.5 と同じ範囲判定をかける。スレッドの終わり（他者ポスト・「もっと見つける」見出し）が見えたら、その時点で止まる（停止条件 (a) の一般化。全件モードでも見出しで止まる）
  - 「中止」はスクロールを止め、**それまでに集めた分をコピー**する（警告付き）。上限件数・上限時間で止まった場合も同様に警告を付ける。トーストは警告表示になる
  - (b) の N は 3。待機は「400ms 変化なし」で収束とみなし、1 ステップ最大 2.5 秒
  - 「さらに表示」の省略ポストは、表示中に展開する（同じポストを待つのは 1 回だけ）
  - 上方向（メインより上）はスクロールしない。開いた時点で描画されている分だけ
  - 自動スクロールは設定（オプションページ・ポップアップのチェックボックス）。オンのときはボタン・ポップアップ・ショートカットのすべてに効く。進捗トーストは実際にスクロールするときだけ出る

---

## 8. Markdown 出力仕様

### 8.1 既定フォーマット

```markdown
# X Thread by @username (2026-10-14)

- Author: 表示名 (@username)
- Source: https://x.com/username/status/1234567890
- Posts: 5
- Extracted: 2026-10-14 21:30 (+09:00)

---

### Tweet 1 (Main)
<!-- 2026-10-14 09:12 +09:00 · https://x.com/username/status/1234567890 -->

本文テキスト…

- Attached Media:
  - [image] https://pbs.twimg.com/media/XXXX?format=jpg&name=large
  - [video] (poster) https://pbs.twimg.com/...

> **Quoted post by @other** (2026-10-13)
> 引用元の本文…
> Source: https://x.com/other/status/987

### Tweet 2
<!-- 2026-10-14 09:15 +09:00 · https://x.com/username/status/1234567891 -->

リプライ本文…

---
> ⚠️ Warning: Tweet 3 was truncated ("Show more") and may be incomplete.
```

**設計判断**
- 各ポストのメタ情報は HTML コメントで付与 → LLM には文脈として読めるが、Obsidian/Notion のプレビューでは邪魔にならない（設定で「通常行として表示」に切替可）
- 日時はローカルタイムゾーン＋オフセット表記（`Intl.DateTimeFormat`）、タイトルの日付はメインポストの投稿日
- リプライ全件モードでは見出しを `### Tweet 3 — @other` のように著者付きにする（メインの著者のポストも含め全見出し。メインは `### Tweet 1 — @username (Main)`）
- メタ情報を通常行にした場合は、見出しの次の行に `2026-10-14 09:12 +09:00 · https://x.com/...` をそのまま書く
- 警告は末尾にまとめ、本文は改変しない

### 8.2 Obsidian 向け frontmatter（オプション）

出力の先頭に付け、その後に §8.1 の本文を続ける。文字列は JSON 形式で引用する（YAML として有効）。メインの日時が無いときは `date` を省く。

```yaml
---
title: "X Thread by @username"
author: "@username"
source: "https://x.com/username/status/1234567890"
date: 2026-10-14
posts: 5
tags: [x-thread, clipping]
---
```

### 8.3 エスケープ規則（本文内）
本文がフォーマットを壊さないよう、**行頭のみ**最小限エスケープする：
- 行頭 `#`（見出しになる形：`#`〜`######` の後に空白か行末）→ `\#`、行頭 `---` / `***` → `\---`、行頭 `>` → `\>`
  - `#tag` のような行頭のハッシュタグは見出しにならないのでエスケープしない（Obsidian ではタグとして扱われる）
  - コードフェンスの内側はエスケープしない
- `-->` を含む場合、メタ情報コメント内では `--&gt;` に置換
- コードフェンス（```）は本文中ではそのまま残す（LLM が解釈できるため）。ただし閉じられていない場合は末尾に閉じフェンスを補わず、警告のみ出す
- それ以外（`*` `_` 等）はエスケープしない（可読性を優先）

---

## 9. クリップボード・UI

### 9.1 クリップボード（`clipboard.ts`）
フォールバックチェーンで実装：
1. `navigator.clipboard.writeText()`（ボタン／ポップアップ操作はユーザー操作起点なので基本これで通る）
2. 失敗時：一時 `textarea` + `document.execCommand('copy')`
3. それでも失敗（ショートカット起点でフォーカスが無い等）：**Phase 3 で検証**し、必要ならオフスクリーンドキュメント（`reason: CLIPBOARD`）経由に切り替え
- 最終的に失敗した場合は、トーストに「コピー失敗」と **Markdown を表示するテキストエリア**を出し、手動コピーできるようにする

### 9.2 ページ内ボタン（`ui/button.ts`）
- 個別ポストページのメインポストのアクションバー（`div[role="group"]`）付近に1つだけ注入（全ポストへの注入は Should 設定）
- 注入済み要素には `data-xmd-injected="1"` を付与して **冪等**に
- MutationObserver はデバウンス（100〜200ms）し、`main` 要素配下のみ監視
- SPA 遷移対応：URL 変化を observer コールバック内で検知して再評価（`pushState` はコンテンツスクリプトからフックできないため）
- スタイルは X の CSS と衝突しないよう、ボタン／トーストは **Shadow DOM** 内に描画

### 9.3 トースト（`ui/toast.ts`）
- 右下に表示、3秒で自動消滅。成功：「✅ 5 posts copied as Markdown」、警告付き成功：「⚠️ 5 posts copied (1 truncated)」、失敗：理由＋手動コピー UI
- `role="status"` / `aria-live="polite"` を付与

### 9.4 ポップアップ
- 「Copy thread as Markdown」ボタン、モード切替（著者のみ / リプライ全件）、自動スクロールのチェックボックス
- X 以外のタブ・`/status/` 以外のページでは無効化して理由を表示
- コンテンツスクリプト未注入（拡張インストール直後で未リロード）の場合は「ページを再読み込みしてください」と案内

---

## 10. セキュリティ・プライバシー

- 外部ネットワーク通信：**ゼロ**（`fetch` を一切使わない。CI で `fetch(` / `XMLHttpRequest` の grep チェック）
- 抽出データは**メモリ上のみ**。`chrome.storage` には設定値のみ保存
- DOM への書き込みは自作 UI のみ。外部由来の文字列は `textContent` で設定し `innerHTML` を使わない
- CSP は MV3 デフォルトのまま（インラインスクリプト禁止）
- 権限は §4 の最小構成。追加する場合は理由を PR/コミットに明記
- テストフィクスチャは **匿名化**（実在ユーザー名・本文を置換）してからコミット

---

## 11. テスト戦略

### 11.1 フィクスチャ取得手順（ユーザー作業）
1. 対象ページを開き、DevTools コンソールで
   `copy(document.querySelector('main').outerHTML)`
2. `tests/fixtures/<case>.html` に保存
3. Claude Code に匿名化スクリプト（`scripts/anonymize.mjs`：ハンドル・表示名・本文をダミーへ置換、構造と `data-testid` は保持）を書かせて適用

### 11.2 必須フィクスチャ
| ケース | 確認点 |
|---|---|
| 単発ポスト（画像なし） | 最小パス |
| 同一著者スレッド 5件以上 | 連続収集・終了判定 |
| スレッド途中のポストを開いた状態 | 上方向（親）の収集 |
| 画像4枚付き | URL 正規化・件数 |
| 動画付き | `blob:` を出力しない |
| 引用ポスト付き | 本体と引用の分離 |
| 長文（Show more あり） | `truncated` 警告 |
| 絵文字・URL・改行・行頭 `#` を含む本文 | テキスト復元とエスケープ |
| 日本語 UI / 英語 UI | 言語非依存であること |

### 11.3 自動テスト
- `parseTweet` / `thread` / `markdown` の単体テスト（Vitest + jsdom）
- Markdown 出力はスナップショットテスト
- `markdown.ts` はフィクスチャ不要の純粋関数テストも用意（エスケープ規則の境界値）

### 11.4 手動 E2E チェックリスト（リリース前）
- [ ] `chrome://extensions` でパッケージ化されていない拡張として読み込み、エラーなし
- [ ] ページ内ボタン／ポップアップ／ショートカットの3経路でコピー成功
- [ ] 貼り付け先：Claude、ChatGPT、Obsidian、Notion で崩れない
- [ ] SPA 遷移（ポスト → 別ポスト → ホーム）でボタンが重複・残留しない
- [ ] SW 停止後（`chrome://serviceworker-internals` で停止）もショートカットが動く
- [ ] 長時間スクロールしてもメモリ・CPU が増え続けない（observer リーク確認）

---

## 12. 実装スケジュール

### Day 1：抽出コア（UI なし）
- [x] プロジェクト雛形、ビルド、manifest、Lint、Vitest 設定
- [x] `types.ts` / `selectors.ts`
- [x] `parseText` / `parseMedia` / `parseQuote` / `parseTweet`
- [x] `markdown.ts`（既定フォーマット＋エスケープ）
- [x] フィクスチャ 4種以上でテスト green

**完了条件**：`npm test` が通り、フィクスチャから §8.1 形式の Markdown が生成される。

### Day 2：スレッド判定・コピー・UI
- [x] `thread.ts`（上下方向・重複排除・警告）
- [x] `clipboard.ts`（フォールバック1・2）
- [x] コンテンツスクリプトのメッセージ受信、ポップアップ
- [x] ページ内ボタン（冪等・SPA 対応・Shadow DOM）、トースト
- [x] 実機（x.com）で MVP 全機能が動作

**完了条件**：実機で「ボタン or ポップアップ → コピー → 貼り付け」が通り、§11.2 の全フィクスチャでテスト green。

### Day 3：拡張・仕上げ
- [x] 自動スクロール収集（停止条件すべて・中止ボタン）
- [x] オプションページ（モード、frontmatter、画像解像度、メタ情報の表示形式）
- [x] ショートカット＋クリップボードフォールバック3の要否検証
- [x] §11.4 手動 E2E、README（インストール手順・既知の制約・セレクタ修正方法）

**完了条件**：手動 E2E チェックリスト全項目クリア、`dist/` を zip 化して配布可能。

### Day 4：Chrome ウェブストア公開（詳細は §16）
- [x] 公開前に決めること（§16.1）：ストア上の名前・公開範囲・掲載言語・プライバシーポリシーの公開先・バージョン
- [ ] ソースコードを GitHub の公開リポジトリにする（実績用。README の英語版、プライバシーポリシーは GitHub Pages で公開）
- [x] アイコン（16/32/48/128 px）と manifest の更新（`icons`・`action.default_icon`・名前・バージョン・`minimum_chrome_version`）
- [ ] ストア掲載文（短い説明・詳しい説明。日本語・英語。無料）
- [ ] 単一用途・権限ごとの理由・データ使用の申告文（「プライバシーへの取り組み」タブ用。外部通信なし）
- [ ] プライバシーポリシー（文面の作成はこちら、公開 URL の用意はユーザー）
- [ ] スクリーンショット（ユーザーが実機で撮影）とプロモーション タイル
- [ ] 提出用パッケージの最終確認（zip の中身・サイズ・自動チェック・zip から入れての E2E 再確認）
- [ ] デベロッパー登録・アップロード・提出（ユーザー作業）と、審査結果への対応

**完了条件**：審査を通過してストアで公開（または限定公開）され、ストアからインストールした版で §11.4 の主要項目（3 経路でのコピー）が動く。ソースコードが GitHub で公開されている。

---

## 13. リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| X の DOM 変更で `data-testid` が変わる | 抽出不能 | セレクタを `selectors.ts` に集約、フィクスチャ更新→テストで即検知。README に修正手順を記載 |
| 仮想スクロールで画面外ポストが消える | スレッド欠落 | MVP は画面内のみと明記し件数をトースト表示。Day 3 で自動スクロール |
| 長文ポストの省略表示 | 本文欠落 | `truncated` 警告。個別ポストページのメインは全文表示される前提 |
| クリップボード書き込みの権限・フォーカス制約 | コピー失敗 | 3段フォールバック＋手動コピー UI |
| 引用・広告・「おすすめ」セル等の混入 | 不要データ | 引用スコープ判定、パーマリンクを持たない article は除外、著者判定で打ち切り |
| 自動スクロールの過剰動作 | X 側の負荷・UX 悪化 | 件数・時間上限、ユーザー中止、元位置へ復帰 |
| ストア審査での不承認（権限の理由不足・説明と実装の不一致・商標） | 公開の遅れ | 権限ごとの理由と単一用途を具体的に書く、掲載文を実装どおりにする、X のロゴ・公式に見える名前を使わない（§16） |

---

## 14. Claude Code への作業指示（CLAUDE.md に転記推奨）

- 実装は §12 の Day/Phase 順。各完了条件を満たすまで次へ進まない
- **難読化クラス・aria-label・表示文言でのセレクタは禁止**。新しいセレクタは必ず `selectors.ts` に追加し、用途をコメントで書く
- 抽出・整形ロジックは純粋関数で書き、変更時は必ずテストを追加・更新
- 依存パッケージの追加は開発依存のみ。ランタイム依存を追加する場合は理由を説明して確認を取る
- `fetch` / 外部通信 / `innerHTML` への外部文字列代入 / `eval` は禁止
- フィクスチャは匿名化済みのもののみコミット
- 不明点（X の DOM 構造など）は推測で実装せず、フィクスチャの確認または実機確認をユーザーに依頼する

---

## 15. 将来拡張（参考）

- Notion API / Obsidian Local REST API への直接保存
- 出力テンプレートのユーザー定義（Mustache 風）
- 複数スレッドのバッチ収集（ブックマーク一覧から）
- Firefox 対応（MV3 互換部分の切り出し）

---

## 16. Chrome ウェブストア公開（Day 4）

### 16.1 公開前に決めること（ユーザー判断）
| 項目 | 選択肢・推奨 |
|---|---|
| ストア上の名前 | **決定（2026-10-16）：`Thread to Markdown for X`**（「X」は X 社の商標のため、公式に見えないよう対象を説明する形）。`manifest.json` の `name` と一致させる |
| 公開範囲 | **決定（2026-10-16）：公開** |
| 掲載言語 | **決定（2026-10-16）：日本語・英語**。拡張内の UI 文言は英語のまま（`_locales` による多言語化はスコープ外。将来拡張） |
| プライバシーポリシーの公開先 | **決定（2026-10-16）：GitHub Pages**（リポジトリの `PRIVACY.md` を公開） |
| GitHub | 公開リポジトリを作る（ユーザーのアカウント）。git 管理を始める前に、元データのフィクスチャ（`tests/fixtures/raw/`）が `.gitignore` で除外されていることを確認する |
| バージョン | **決定（2026-10-16）：初回公開は `1.0.0`**。以後、提出のたびに `manifest.json` と `package.json` の `version` を上げる |

### 16.2 アイコンと manifest
- アイコンは自作デザイン（X のロゴ・鳥・「𝕏」を使わない）。2026-10-16 にユーザーが決定：藍色（`#4338ca`）の角丸の正方形に、縦線でつないだ 3 つの点（スレッド）と本文の行
- 元データは SVG（`assets/icon.svg`）だけで、PNG はリポジトリに置かない。ビルドのたびに `scripts/icon.mjs` が 16/32/48/128 px の PNG を `dist/icons/` に書き出す（依存なしの自前のラスタライザ。対応するのは塗りの `<rect>`（角丸可）・`<circle>`・`<g fill>` だけで、それ以外の要素は失敗にする）
- `manifest.json`：`icons`（16/32/48/128）、`action.default_icon`（16/32）、`name`（§16.1）、`version`、`minimum_chrome_version`（ビルドのターゲット `chrome120` に合わせて `"120"`）
- 権限は変えない（`storage`・`clipboardWrite`・x.com/twitter.com のみ）。`tests/manifest.test.ts` で、manifest のアイコンがビルドで生成するものと一致することを確認する（ラスタライザ自体は `tests/icon.test.ts`）

### 16.3 ストア掲載情報（`docs/store/`）
- `listing.ja.md` / `listing.en.md`：短い説明（132 文字以内。`manifest.json` の `description` と同じにする）と詳しい説明（機能・使い方・設定・既知の制約。無料であること。README から作成し、**実装にない機能は書かない**）
- カテゴリ：仕事効率化（Productivity）

### 16.4 プライバシーへの取り組み（申告文。`docs/store/privacy-practices.md`）
- 単一用途：「表示中の X のスレッドを Markdown に変換してクリップボードにコピーする」
- 権限ごとの理由
  - `storage`：出力設定（モード・frontmatter・画像サイズ・メタ情報の形式・自動スクロール）の保存のみ
  - `clipboardWrite`：生成した Markdown をクリップボードへ書き込むため（フォーカスが無い場合のフォールバックを含む）
  - ホスト権限（`https://x.com/*`・`https://twitter.com/*`）：ポストのページにボタンを表示し、表示中のスレッドを読み取るため
  - これら以外のサイトにはアクセスしない
- リモートコード：使用しない
- データ使用：ページの内容・抽出データを収集・送信・販売しない。読み取ったページ内容はメモリ上で変換してクリップボードに渡すだけで、保存も送信もしない（§10）。外部への通信は一切しない

### 16.5 プライバシーポリシー（`PRIVACY.md`）
- §10 の内容を利用者向けに書く：ページの内容は収集・送信しない／外部への通信をしない／保存するのは設定だけ（`chrome.storage.sync`。Chrome の同期が有効なら Google アカウントで同期される）／問い合わせ先（GitHub の Issues 等）
- 公開 URL は §16.1 で決めた場所に置き、ストアの「プライバシーへの取り組み」に入力する

### 16.6 画像素材
- スクリーンショット：1280×800（または 640×400）を 1〜5 枚。ユーザーが実機で撮影する。個人のアカウント・他人のポストが写る場合は、自分のポストを使うかぼかす
  - 推奨構図：ページ内ボタンとトースト／ポップアップ（モード切替）／オプションページ／貼り付け結果（Obsidian 等）
- プロモーション タイル（小）：440×280。アイコンと同じ SVG から作る

### 16.7 提出用パッケージの最終確認
- `npm run package` の zip に、`manifest.json`・JS・HTML・CSS・アイコン以外（ソース・テスト・フィクスチャ・ソースマップ）が入っていないこと
- `npm test`・`npm run lint`・`npm run typecheck`・`npm run check:no-network` が通ること
- zip を展開して読み込んだ版で、3 経路のコピー・設定の保存・自動スクロールが動くこと（ユーザー）

### 16.8 提出と審査（ユーザー作業）
1. Chrome Web Store Developer Dashboard でデベロッパー登録（初回のみ登録料。2 段階認証が必要）
2. 新しいアイテムとして zip をアップロード
3. 掲載情報（§16.3）・画像（§16.6）・プライバシーへの取り組み（§16.4、ポリシー URL）を入力
4. 公開範囲（§16.1）を選んで審査に提出
5. 不承認の場合は理由を共有してもらい、修正して再提出する

### 16.9 公開後の更新手順
- 修正 → テスト → `version` を上げる → `npm run package` → ダッシュボードで新しい zip をアップロードして提出
- 変更内容は `CHANGELOG.md` に残す
- X の DOM 変更で動かなくなった場合は README の「セレクタの修正方法」に従い、修正版を提出する
