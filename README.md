# Thread to Markdown for X

English | [日本語](README.ja.md)

A Chrome extension (Manifest V3) that copies a thread on X (formerly Twitter) to the clipboard as Markdown, ready to paste into an LLM, Notion or Obsidian.

- It does not use the X API. It reads the **DOM of the page you are viewing** in your logged-in browser
- It makes no network requests. The extracted content is handled in memory only and is never stored or sent (only your settings are stored)
- Permissions: `storage`, `clipboardWrite`, and access to `x.com` / `twitter.com` only

## Installation

### From a release zip

1. Extract `thread-to-markdown-for-x-<version>.zip` into any folder
2. Open `chrome://extensions` in Chrome and turn on "Developer mode" (top right)
3. Click "Load unpacked" and choose the extracted folder (the one containing `manifest.json`)
4. **Reload any x.com tabs that are already open** (the extension does not run on pages opened before it was loaded)

### Build from source

Requires Node.js 22.2 or later (packaging uses `crc32` from `node:zlib`).

```sh
npm install
npm run build      # builds the extension into dist/ (load this folder in step 3 above)
npm run package    # builds and creates thread-to-markdown-for-x-<version>.zip
```

## Usage

On a post page (`https://x.com/<user>/status/<id>`), use any of the following.

| Method | How |
|---|---|
| In-page button | The "Copy as Markdown" button below the actions (reply, like, …) of the main post |
| Popup | Extension icon in the toolbar → "Copy thread as Markdown" |
| Shortcut | `Alt+Shift+M` (can be changed at `chrome://extensions/shortcuts`) |

When the copy finishes, the result (e.g. `✅ 5 posts copied as Markdown`) appears at the bottom right. If copying fails, the Markdown is shown in a text area so you can copy it by hand.

### Settings

Open "Options" in the popup, or "Details" → "Extension options" in `chrome://extensions`. Changes are saved immediately and apply from the next copy.

| Setting | Choices (default in bold) | Description |
|---|---|---|
| Posts to copy | **Thread by the author only** / All posts from the main post on | "All posts" includes replies by others and adds `— @handle` to every heading (also switchable in the popup) |
| Auto-scroll | **Off** / On | Scrolls down automatically to collect posts beyond the screen (also switchable in the popup) |
| Image size | **Large** / Original | The `name=` parameter of image URLs |
| Date and URL of each post | **HTML comment** / Normal line | HTML comments are hidden in Obsidian and Notion previews |
| Obsidian | **No frontmatter** / Add YAML frontmatter | Adds YAML frontmatter (title, author, source, date, posts, tags) at the top |

### Example output

```markdown
# X Thread by @username (2026-10-14)

- Author: Display Name (@username)
- Source: https://x.com/username/status/1234567890
- Posts: 2
- Extracted: 2026-10-14 21:30 (+09:00)

---

### Tweet 1 (Main)
<!-- 2026-10-14 09:12 +09:00 · https://x.com/username/status/1234567890 -->

Post text…

- Attached Media:
  - [image] https://pbs.twimg.com/media/XXXX?format=jpg&name=large
  - [video] (poster) https://pbs.twimg.com/amplify_video_thumb/...

> **Quoted post by @other** (2026-10-13)
> Quoted text…
> Source: https://x.com/other/status/987

### Tweet 2
<!-- 2026-10-14 09:15 +09:00 · https://x.com/username/status/1234567891 -->

Reply text…
```

Post text is output almost as is. Only line-leading characters that would break the Markdown structure (`# ` that would become a heading, `>`, `---`, …) are escaped.

## Known limitations

- **Only posts rendered on the page** are copied. X removes off-screen posts from the DOM, so a long thread may be cut off. Turn on auto-scroll to collect posts further down
- Auto-scroll stops at **100 posts or 30 seconds** (you can also press "Stop"). When it stops early, the toast and the end of the Markdown warn that the thread may continue. Posts above the main post are limited to those shown when the page was opened. Buttons such as "Show more replies" are not pressed
- Posts below "Discover more" (recommendations) are excluded, even by the same author
- Long posts truncated with "Show more" are expanded by pressing X's own "Show more" before extraction. A post that does not expand within 3 seconds is output truncated, with a warning
- For videos and GIFs, only the poster image URL is recorded (the video file URL is not)
- Image ALT text is not output. X fills images without ALT text with a default in the UI language (e.g. "Image"), which cannot be told apart from real ALT text
- The URL of a quoted post is available only when its card contains an image (otherwise the `Source:` line is omitted)
- The extension does not run in tabs opened before it was installed or updated. Reload the page (in that case the shortcut does nothing)
- Extraction may break when X changes its page structure (DOM). See "Fixing selectors" below

## Fixing selectors (when X changes its DOM)

All dependencies on X's DOM are collected in `src/content/extract/selectors.ts`. They do not rely on obfuscated class names (`css-xxxxx`, `r-xxxxx`), `aria-label`, or displayed text (which changes with the UI language).

1. Open a page where extraction fails and run the following in the DevTools console (it copies the page's `main` element, with its URL, to the clipboard)

   ```js
   copy('<!-- url: ' + location.href + ' -->\n' + document.querySelector('main').outerHTML)
   ```

2. Save it as `tests/fixtures/raw/<case>.html` (this folder is excluded from Git because it contains real user names and posts)
3. Create the anonymized fixture. The script fails if anonymization leaves any original value behind

   ```sh
   node scripts/anonymize.mjs tests/fixtures/raw/<case>.html tests/fixtures/<case>.html
   ```

4. Run `npm test` to see which extraction broke. To add the fixture to the tests, import it like the existing ones: `import html from './fixtures/<case>.html?raw'`
5. Fix the selectors in `selectors.ts` (comment the purpose of any new selector)
6. Check that the snapshot diffs are as intended, then update them with `npx vitest run -u`
7. Rebuild with `npm run build` and check in the browser

## Development

| Command | Description |
|---|---|
| `npm run build` | Rebuild `dist/` |
| `npm run package` | Build and create the release zip |
| `npm test` | Tests (Vitest + jsdom) |
| `npm run typecheck` | Type check |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run check:no-network` | Check that `src/` contains no `fetch(` / `XMLHttpRequest` |

The design is in `PLAN.md`, the development workflow in `CLAUDE.md`, and the work tickets in `docs/` (all in Japanese).

## License

[MIT](LICENSE)
