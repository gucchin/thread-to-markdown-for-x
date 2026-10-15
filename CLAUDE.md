# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

X（Twitter）のスレッドを DOM から抽出し、LLM 入力や Notion/Obsidian 保存向けの Markdown にしてクリップボードへコピーする Chrome 拡張（Manifest V3, TypeScript strict）。
**詳細仕様の正は `PLAN.md`**（データモデル §6、抽出ロジック §7、出力仕様 §8、テスト §11、スケジュール §12）。仕様を変えるときは PLAN.md も合わせて更新する。

PLAN.md §5 のディレクトリ構成（`thread-to-markdown-for-x/` 配下）は、このリポジトリのルートにそのまま置く。進捗は docs/README.md のチケット一覧を参照。

## 進め方（PLAN.md §12）

各 Day の完了条件を満たすまで次へ進まない。

- **Day 1 抽出コア（UI なし）**：雛形・ビルド・manifest・Lint・Vitest、`types.ts`/`selectors.ts`、`parseText`/`parseMedia`/`parseQuote`/`parseTweet`、`markdown.ts`。
  完了条件：`npm test` が通り、フィクスチャ 4 種以上から §8.1 形式の Markdown が生成される。
- **Day 2 スレッド判定・コピー・UI**：`thread.ts`、`clipboard.ts`（フォールバック 1・2）、メッセージ受信、ポップアップ、ページ内ボタン、トースト。
  完了条件：実機で「ボタン or ポップアップ → コピー → 貼り付け」が通り、§11.2 の全フィクスチャでテスト green。
- **Day 3 拡張・仕上げ**：自動スクロール収集、オプションページ、ショートカットとクリップボードフォールバック 3 の要否検証、README。
  完了条件：§11.4 手動 E2E チェックリスト全項目クリア、`dist/` を zip 化して配布可能。
- **Day 4 公開（PLAN.md §16）**：名前・アイコン・manifest、ソースコードの GitHub 公開、掲載文・プライバシー申告・ポリシー、画像素材、提出用 zip の確認、提出と審査対応。
  完了条件：審査を通過して公開され、ストアから入れた版で 3 経路のコピーが動く。ソースコードが GitHub で公開されている。

**チケット**：作業は `docs/NNN-*.md` のチケット単位で進める（一覧は `docs/README.md`）。Todo・完了条件を終えたら `[ ]` を `[x]` にし、チケットの全項目が終わったら `docs/README.md` の該当行も `[x]` にする。

**スコープ外**：X API・非公開 GraphQL の呼び出し、未ログイン状態でのスクレイピング・バックグラウンドクロール、Notion/Obsidian への直接書き込み、抽出内容の送信・永続保存。

## コマンド

- ビルド：`npm run build`（`scripts/build.mjs`。esbuild で `dist/` を作り直す。content・popup は IIFE、SW は ESM。静的ファイルは `build.mjs` の `staticFiles` に追加する。アイコンは `assets/icon.svg` からビルドのたびに `scripts/icon.mjs`（依存なしのラスタライザ。塗りの `rect`・`circle`・`g fill` のみ対応）で `dist/icons/` に PNG を生成する）
- テスト：`npm test`（Vitest + jsdom、`tests/**/*.test.ts`）。監視モードは `npm run test:watch`
- 単一テスト：`npx vitest run tests/markdown.test.ts`、名前で絞るなら `-t "<テスト名>"`
- スナップショット更新：`npx vitest run -u`
- 型チェック：`npm run typecheck`
- Lint：`npm run lint`（ESLint flat config。`src/` では `eval`・`innerHTML`/`outerHTML` 代入・`insertAdjacentHTML` をエラーにしている）
- Format：`npm run format`／確認のみ `npm run format:check`（Prettier。`*.md` は対象外）
- 外部通信の混入チェック：`npm run check:no-network`（`src/` に `fetch(`・`XMLHttpRequest` があれば失敗）
- 実機確認：`npm run build` 後、`chrome://extensions` で `dist/` を「パッケージ化されていない拡張機能」として読み込む
- 配布用 zip：`npm run package`（ビルド後、`scripts/package.mjs` が `dist/` を `thread-to-markdown-for-x-<version>.zip`（`package.json` の `name` と `version`）にまとめる。依存なし・`node:zlib` のみ）

`tests/manifest.test.ts` が manifest の権限を固定している。権限を変えるときはこのテストも意図して更新する。
esbuild の postinstall は npm の allowScripts で未承認のままだが、プラットフォーム別バイナリ（`@esbuild/win32-x64`）で動作するため承認は不要。

## アーキテクチャ

- **実処理はすべて Content Script 内で完結**する。Popup と Service Worker は `chrome.tabs.sendMessage({type:'EXTRACT_AND_COPY'})` で起動するだけ。
- **Service Worker はステートレス**（MV3 でいつ停止しても壊れないこと）。役割は `commands`（Alt+Shift+M）の受け口のみ。
- 処理の流れ：`extract/thread.ts` の `readTimeline`（DOM → ポストと見出しの列。内部で `parseTweet` 群を使う）→ `buildThread`（範囲判定 → `ThreadResult`）→ `markdown.ts` の `toMarkdown` → `clipboard.ts` の `copyText`。自動スクロール（設定 `autoScroll`）のときは `extract/autoScroll.ts` の `collectByScrolling` が読み取りを繰り返して統合する（`ScrollPort` を差し替えてテストする）。この 3 つを `extractAndCopy.ts` がつなぎ、失敗はすべて `ExtractAndCopyResponse`（`ok: false` とエラーコード）にして返す（例外を投げない）。
- 起動の経路は 3 つ（ページ内ボタン・ポップアップ・ショートカット）で、すべて `controller.ts` の `run(source)` を通る。実行中の重複起動は 1 回の実行にまとめ、結果を `ui/toast.ts` に渡す。要求の `source`（`button`/`popup`/`shortcut`）で、ポップアップ起点のコピー失敗だけはトーストを出さずポップアップに任せる（ポップアップがフォーカスを持ってコピーを再試行し、だめなら手動コピー欄を出す）。
- `content/index.ts` と `popup/popup.ts` は Chrome API をつなぐだけにし、判断は `controller.ts`・`ui/button.ts`・`popup/popupController.ts` に置く（偽の API・jsdom でテストするため）。表示文言はトーストとポップアップで `shared/labels.ts` を共用する。
- **抽出・整形は純粋関数**にし、UI・Chrome API から分離して jsdom でテストできるようにする。
- **X の DOM 依存セレクタは `src/content/extract/selectors.ts` 1 ファイルに集約**（一覧は PLAN.md §7.1）。X の DOM 変更時はここだけ直し、フィクスチャ更新でテストが即検知する設計。
- 設定は `chrome.storage.sync` に出力オプションのみ保存（`shared/settings.ts`：キー `settings` 1 つにまとめ、読み込み時に項目ごとに検証して不正値は既定値に戻す）。オプションページ（`src/options/`）とポップアップのモード切替が書き、コンテンツスクリプトは実行のたびに読む。抽出データはメモリ上だけで扱い、永続化しない。

## 実装上の要点（間違えやすい箇所）

- **抽出モジュールの構成**：`parseTweet`（article → `TweetData`）が `parseQuote`（引用カードの検出と `queryOwn` による本体側だけの検索）・`parseAuthor`（`User-Name` → `Author`）・`parseText`・`parseMedia`・`permalink`（`/status/` href の解析）を使う。
- **パーマリンク**：本体側の `time` を囲む `a` から取る。`a[href*="/status/"]` は添付画像（`/photo/N`）・アナリティクス・引用一覧にも一致するので、最初の一致を使ってはいけない。`time` はメインポストでは `User-Name` の外、リプライ・スレッドの続きでは `User-Name` の中にある。
- **引用ポスト**：同じ `article` 内に 2 つ目の `User-Name`/`tweetText`/`time` として入れ子で現れる。「`div[role="link"]` で内部に `User-Name` を持つ引用コンテナの内側か」で本体側/引用側に振り分ける。引用カードはパーマリンクも投稿者リンクも持たない（ハンドルは `@handle` のテキストから読む）。ID・URL はカード内の画像リンク（引用元の投稿者のもの）からだけ取れ、無ければ `null`（`QuotedTweet` の `id`・`url` は null 許容）。引用は 1 段まで。
- **本文復元（`parseText`）**：絵文字 `img` は `alt`。X は URL を「非表示の `https://`＋表示部分＋非表示の残り＋`…`」に分けて描画するため、テキストは完全な URL の末尾に `…` が付いた形になる。**末尾の `…` を除いてから** URL 形式か判定し、そうでなければ `href`（t.co）を使う。引用カード内では同じ構造が `<span>` で現れる。`br`・ブロック要素は改行。連続空行は 1 つに、前後は trim。
- **メディア（`parseMedia`）**：`pbs.twimg.com/media/...` で始まる画像だけを採用し、`name` を `large`（既定）/`orig`（設定）に置換する。動画も `tweetPhoto` の中にあり、poster と同じ `<img>`（`amplify_video_thumb/...`）を持つが、接頭辞で除外されるので画像として数えない。動画・GIF は `video[poster]` の poster URL のみ記録し、**`blob:` URL は出力しない**。GIF は poster が `pbs.twimg.com/tweet_video_thumb/`（`GIF_POSTER_PREFIX`）で始まるもの（src は `video.twimg.com/tweet_video/….mp4`。これも出力しない）。複数メディアはカルーセル（`ScrollSnap-List`）で DOM 順。UI 言語の既定値の `alt`（「画像」）は区別できないため、ALT は Markdown に出力しない（docs/015）。
- **スレッド判定（`thread.ts`）**：URL から `mainId` と著者を取得（`/status/` 以外はエラー）。全 `article` を DOM 順に解析して `id` で重複排除。メインより上の同一著者の連続ポストと、メイン直後から同一著者が続く限りを収集し、他者のポストが出たら終了（リプライ全件モードではメイン以降を全部）。**セル内の `h2`（「もっと見つける」の見出し、`sectionHeading`）より後はおすすめで会話ではない**ので、メインと同じセクションだけを対象にする（同じ著者のおすすめポストが混ざるのを防ぐ）。パーマリンクを持たない `article`（広告等）は除外。`truncated` は `warnings` に追加。
- **省略表示の展開（`expandTruncated.ts`）**：スレッドの続きの長文ポストは、X が「さらに表示」で省略して描画する（実機で確認）。これは全文をその場で展開する `<button data-testid="tweet-text-show-more-link">` なので、`extractAndCopy` は抽出後に省略されたスレッドのポストのボタンを押し、展開（ボタンの消滅か本文の変化）を MutationObserver で待って（上限 3 秒）抽出し直す。`<a>` の「さらに表示」と引用カード内のものは押さない。0 件・メイン不在は明確なエラーを返し、例外を UI まで素通りさせない。
- **Markdown（PLAN.md §8）**：各ポストのメタ情報（日時・URL）は HTML コメントで付ける（設定で通常行）。frontmatter（§8.2）は設定でオン。リプライ全件モードでは全見出しを `### Tweet 3 — @handle` にする（メインは `### Tweet 1 — @handle (Main)`）。日時はローカルタイムゾーン＋オフセット（`Intl.DateTimeFormat`）。警告は末尾にまとめ、本文は改変しない。エスケープは**行頭のみ**（見出しになる `# x`→`\# x`、`---`/`***`→`\---`、`>`→`\>`）。`#tag` のような行頭のハッシュタグとコードフェンスの内側はエスケープしない。メタ情報コメント内の `-->` は `--&gt;` に置換。それ以外（`*`・`_`）はエスケープしない。閉じていないコードフェンスは補わず警告だけ出す。引用ブロック内のメディア一覧の前後には空の `>` 行を入れる（`Source:` がリスト項目の続きにならないように）。`markdown.ts` は `result.warnings` をそのまま出力するだけで、省略表示の警告は `thread.ts` が作る。
- **クリップボード**：`navigator.clipboard.writeText()` → 一時 `textarea` + `execCommand('copy')` → （Day 3 で要否を検証）オフスクリーンドキュメント。最終的に失敗したら、トーストに Markdown 入りのテキストエリアを出して手動コピーできるようにする。
- **ページ内 UI**：ボタン・トーストは **Shadow DOM** に描画（スタイルは `ui/styles.ts` の `applyStyles`）。ボタンはメインポストのアクションバー（`div[role="group"]`）の**直後の兄弟要素**として 1 つだけ注入し（中に入れると X のアイコン配置が崩れる）、`data-xmd-injected="1"` で冪等にする。ポスト全体がリンクなので、クリックは `stopPropagation` する。MutationObserver は `main` 配下のみ監視し、100〜200ms デバウンス。`pushState` はフックできないため、SPA 遷移は observer コールバック内で URL 変化を検知して再評価する。トーストは `role="status"`/`aria-live="polite"`。
- **ポップアップ**：X 以外のタブや `/status/` 以外のページでは無効化して理由を表示。コンテンツスクリプト未注入（インストール直後でページ未再読み込み）なら再読み込みを案内する。
- **自動スクロール（Day 3）**：固定 sleep ではなく MutationObserver＋タイムアウトで DOM 変化の収束を待つ。`Map<id, TweetData>` に蓄積。停止条件は、他者ポストの出現・新規 0 件が N 回連続・上限件数（既定 100）・上限時間（既定 30 秒）・トーストの「中止」押下。終了後は元のスクロール位置に戻す。

## テスト

- `parseTweet`/`thread`/`markdown` を Vitest + jsdom で単体テスト。Markdown 出力はスナップショットテスト。`markdown.ts` はフィクスチャ不要の純粋関数テスト（エスケープ規則の境界値）も用意する。
- 必須フィクスチャ（PLAN.md §11.2）：単発ポスト、同一著者スレッド 5 件以上、スレッド途中を開いた状態、画像 4 枚、動画、引用、長文（Show more）、絵文字・URL・改行・行頭 `#` を含む本文、日本語 UI/英語 UI。
- フィクスチャはユーザーが DevTools で `copy('<!-- url: ' + location.href + ' -->\n' + document.querySelector('main').outerHTML)` を実行して取得し、**`tests/fixtures/raw/<case>.html`（`.gitignore` 済み）** に保存する。それを `node scripts/anonymize.mjs tests/fixtures/raw/<case>.html tests/fixtures/<case>.html [--url <ページ URL>]` で匿名化したものだけを `tests/fixtures/` に置く。スクリプトは冪等で、元の値が残っていると失敗する（詳細は docs/003）。`tests/fixtures.guard.test.ts` が `tests/fixtures/*.html` すべてについて、匿名化済みの URL・ポスト ID であることと `class` 属性が無いことを確認する（匿名化前のファイルを `raw/` の外に置く事故を防ぐ）。
- テストではフィクスチャを `import html from './fixtures/<case>.html?raw'` で読み、`loadFixture(html)`（`tests/helpers/dom.ts`）で `Document`・`mainId`・`articles` にする。小さな HTML 片は `el(html)` で作る。
- 現在のフィクスチャ（`english` 以外は日本語 UI）：`mid_thread`（同一著者 6 件の 3 件目を開いた状態。上方向の収集と省略表示 2 件）・`special`（絵文字・空行。3 件目は「もっと見つける」のおすすめで、自分の画像＋画像の無い引用を持つ。`parseTweet` の直接テストに使う）・`english`（英語 UI）・`gif`（GIF 1 件のみのポスト）・`single`・`thread`（同一著者 4 件、各ポストが自己引用）・`image4`（メインに画像 4 枚。表示名に絵文字。下は「もっと見つける」のみで、その中にリンクカード（`card_img`）付きのポスト）・`image3`（画像 3 枚、動画＋画像の混在。3 件目は「もっと見つける」のおすすめで、他者の画像付き引用を持つ）・`quote`（URL の取れない引用）・`single_tweet`（広告のメイン＋他者リプライ 16 件）・`show_more`（実機 NG の再現。スレッドの続きの 2 件が「さらに表示」で省略。メインポストは画面外で DOM に無いため、先頭のポストの URL で匿名化している）。

## 厳守ルール

- **セレクタに難読化クラス（`css-xxxxx`/`r-xxxxx`）・`aria-label`・表示文言（「返信」「Show more」等）を使わない**（UI 言語で壊れる）。`nth-child` 等の構造位置依存はやむを得ない場合のみ、理由をコメントで書く。新しいセレクタは必ず `selectors.ts` に追加し、用途をコメントする。
- `fetch` / `XMLHttpRequest` / 外部通信・`eval`・リモートコード・`innerHTML` への外部由来文字列の代入は禁止（外部文字列は `textContent` で設定）。CSP は MV3 デフォルトのまま。
- ランタイム依存はゼロ（Markdown 整形も自前実装）。依存追加は開発依存のみ。ランタイム依存が必要なら理由を説明して確認を取る。フレームワーク（WXT/CRXJS 等）は迷ったら依存の少ない方を選ぶ。
- 権限は `storage`・`clipboardWrite` と x.com/twitter.com の host_permissions のみ。`<all_urls>`・`tabs` は使わない。`offscreen` はクリップボードのフォールバックが必要と判明した場合のみ追加。権限追加時は理由をコミットに明記。
- 抽出・整形ロジックを変えたら必ずテストを追加・更新する。
- テストフィクスチャは**匿名化済みのみ**コミットする。
- X の DOM 構造など不明点は推測で実装せず、フィクスチャの確認または実機確認をユーザーに依頼する。
