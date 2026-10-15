# Store listing (English)

Text to paste into the Chrome Web Store Developer Dashboard, "Store listing" tab. Keep it in line with
README.md and the implementation: never describe a feature the extension does not have (PLAN.md §16.3).

- Category: Productivity
- Language: English (the Japanese listing is in `listing.ja.md`)

## Summary (from manifest.json, 132 characters max)

The dashboard takes the summary from the `description` of `manifest.json`; it cannot be edited there.
`tests/store.test.ts` checks that the line below matches it.

```text
Copy an X (Twitter) thread as Markdown for LLMs, Notion and Obsidian.
```

## Description

```text
Copy a thread on X (formerly Twitter) to the clipboard as clean Markdown, ready to paste into ChatGPT, Claude or another LLM, or to save in Notion or Obsidian.

HOW TO USE
Open a post (x.com/<user>/status/<id>) and use any of these:
• The "Copy as Markdown" button below the main post
• The extension icon in the toolbar → "Copy thread as Markdown"
• The keyboard shortcut Alt+Shift+M (can be changed at chrome://extensions/shortcuts)

WHAT YOU GET
• The author's posts in the thread, in order, including posts above the one you opened
• Post text with line breaks, emoji, links (full URLs where X shows them) and hashtags
• Image URLs (large or original size), and the poster image of videos and GIFs
• Quoted posts, as Markdown block quotes
• The date and URL of each post
• Long posts cut off with "Show more" are expanded before copying

SETTINGS
• Posts to copy: the author's thread only, or every post from the main post on, including replies by others
• Auto-scroll: scroll down automatically to collect posts beyond the screen (up to 100 posts / 30 seconds, with a Stop button)
• Image size: Large or Original
• Date and URL of each post: as an HTML comment (hidden in Obsidian and Notion previews) or as a normal line
• Obsidian: add YAML frontmatter (title, author, source, date, posts, tags)

PRIVACY
• No network access at all. Nothing you view or copy is collected, stored or sent anywhere
• It reads only the page you are viewing on x.com / twitter.com, in your own browser. It does not use the X API
• Only your settings are saved (with Chrome sync, if you have it turned on)

KNOWN LIMITATIONS
• Only posts loaded on the page can be copied. X removes off-screen posts, so turn on auto-scroll for long threads
• Posts under "Discover more" (recommendations) are not included
• For videos and GIFs, only the poster image URL is included, not the video itself
• Image ALT text is not included
• Reload x.com tabs that were open before the extension was installed or updated
• Copying may stop working when X changes its page structure; it will be fixed in an update

Free and open source (MIT License):
https://github.com/gucchin/thread-to-markdown-for-x

This extension is not affiliated with or endorsed by X Corp.
```
