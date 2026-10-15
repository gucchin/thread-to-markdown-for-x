import { describe, expect, it } from 'vitest';
import { escapeText, toMarkdown } from '../src/content/markdown';
import type { ThreadResult, TweetData } from '../src/shared/types';

const author = { displayName: '表示名', handle: 'username' };

function tweet(overrides: Partial<TweetData> = {}): TweetData {
  return {
    id: '1234567890',
    url: 'https://x.com/username/status/1234567890',
    author,
    datetime: '2026-10-14T00:12:00.000Z',
    text: '本文テキスト…',
    truncated: false,
    media: [],
    quote: null,
    isMain: true,
    ...overrides,
  };
}

function result(tweets: TweetData[], overrides: Partial<ThreadResult> = {}): ThreadResult {
  return {
    sourceUrl: 'https://x.com/username/status/1234567890',
    rootAuthor: author,
    tweets,
    warnings: [],
    extractedAt: '2026-10-14T12:30:00.000Z',
    ...overrides,
  };
}

const tokyo = { timeZone: 'Asia/Tokyo' };

describe('toMarkdown: default format (PLAN.md §8.1)', () => {
  it('renders the documented example', () => {
    const main = tweet({
      media: [
        { type: 'image', url: 'https://pbs.twimg.com/media/XXXX?format=jpg&name=large' },
        { type: 'video', url: 'https://pbs.twimg.com/amplify_video_thumb/1/img/a.jpg' },
      ],
      quote: {
        id: '987',
        url: 'https://x.com/other/status/987',
        author: { displayName: 'Other', handle: 'other' },
        datetime: '2026-10-13T03:00:00.000Z',
        text: '引用元の本文…',
        truncated: false,
        media: [],
      },
    });
    const reply = tweet({
      id: '1234567891',
      url: 'https://x.com/username/status/1234567891',
      datetime: '2026-10-14T00:15:00.000Z',
      text: 'リプライ本文…',
      isMain: false,
    });
    const md = toMarkdown(
      result([main, reply], {
        warnings: ['Tweet 3 was truncated ("Show more") and may be incomplete.'],
      }),
      tokyo,
    );

    expect(md).toBe(`# X Thread by @username (2026-10-14)

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
  - [video] (poster) https://pbs.twimg.com/amplify_video_thumb/1/img/a.jpg

> **Quoted post by @other** (2026-10-13)
> 引用元の本文…
> Source: https://x.com/other/status/987

### Tweet 2
<!-- 2026-10-14 09:15 +09:00 · https://x.com/username/status/1234567891 -->

リプライ本文…

---

> ⚠️ Warning: Tweet 3 was truncated ("Show more") and may be incomplete.
`);
  });

  it('omits the warnings section when there are none', () => {
    const md = toMarkdown(result([tweet()]), tokyo);
    expect(md).not.toContain('Warning');
    expect(md.trimEnd().endsWith('本文テキスト…')).toBe(true);
  });

  it('puts each warning in its own blockquote', () => {
    const md = toMarkdown(result([tweet()], { warnings: ['first', 'second'] }), tokyo);
    expect(md).toContain('> ⚠️ Warning: first\n\n> ⚠️ Warning: second\n');
  });

  it('omits empty text and media sections', () => {
    const md = toMarkdown(result([tweet({ text: '' })]), tokyo);
    expect(md).toMatch(/-->\n$/);
    expect(md).not.toContain('Attached Media');
  });

  it('numbers posts in order and marks only the main one', () => {
    const md = toMarkdown(
      result([
        tweet({ id: '1', isMain: false }),
        tweet({ id: '2', isMain: true }),
        tweet({ id: '3', isMain: false }),
      ]),
      tokyo,
    );
    expect(md.match(/^### .*$/gm)).toEqual(['### Tweet 1', '### Tweet 2 (Main)', '### Tweet 3']);
  });
});

describe('toMarkdown: options (PLAN.md §8.1, §8.2)', () => {
  const reply = tweet({
    id: '2',
    url: 'https://x.com/other/status/2',
    author: { displayName: 'Other', handle: 'other' },
    datetime: '2026-10-14T00:15:00.000Z',
    text: 'reply',
    isMain: false,
  });

  it('prepends the documented frontmatter', () => {
    const md = toMarkdown(result([tweet(), reply]), { ...tokyo, frontmatter: true });
    const expected = [
      '---',
      'title: "X Thread by @username"',
      'author: "@username"',
      'source: "https://x.com/username/status/1234567890"',
      'date: 2026-10-14',
      'posts: 2',
      'tags: [x-thread, clipping]',
      '---',
      '',
      '# X Thread by @username (2026-10-14)',
      '',
    ].join('\n');
    expect(md.startsWith(expected)).toBe(true);
  });

  it('omits the frontmatter by default', () => {
    expect(toMarkdown(result([tweet()]), tokyo)).toMatch(/^# X Thread/);
  });

  it('quotes frontmatter strings safely', () => {
    const md = toMarkdown(result([tweet()], { sourceUrl: 'https://x.com/a/status/1?q="x"' }), {
      frontmatter: true,
    });
    expect(md).toContain('source: "https://x.com/a/status/1?q=\\"x\\""\n');
  });

  it('leaves out the frontmatter date when the main post has no date', () => {
    const md = toMarkdown(result([tweet({ datetime: null })], { extractedAt: 'bad' }), {
      frontmatter: true,
    });
    expect(md).not.toMatch(/^date:/m);
    expect(md).toMatch(/^posts: 1$/m);
  });

  it('writes the meta as a normal line', () => {
    const md = toMarkdown(result([tweet()]), { ...tokyo, metaFormat: 'line' });
    expect(md).toContain(
      '### Tweet 1 (Main)\n2026-10-14 09:12 +09:00 · https://x.com/username/status/1234567890\n\n本文テキスト…',
    );
    expect(md).not.toContain('<!--');
  });

  it('adds the author to every heading in reply-all mode', () => {
    const md = toMarkdown(result([tweet(), reply]), { ...tokyo, authorInHeadings: true });
    expect(md.match(/^### .*$/gm)).toEqual([
      '### Tweet 1 — @username (Main)',
      '### Tweet 2 — @other',
    ]);
  });

  it('keeps the headings without authors by default', () => {
    expect(toMarkdown(result([tweet(), reply]), tokyo).match(/^### .*$/gm)).toEqual([
      '### Tweet 1 (Main)',
      '### Tweet 2',
    ]);
  });
});

describe('toMarkdown: dates', () => {
  it('uses the main post’s local date in the title', () => {
    // 20:00 UTC on the 14th is the 15th in Tokyo.
    const md = toMarkdown(result([tweet({ datetime: '2026-10-14T20:00:00.000Z' })]), tokyo);
    expect(md).toMatch(/^# X Thread by @username \(2026-10-15\)$/m);
    expect(md).toContain('<!-- 2026-10-15 05:00 +09:00 ·');
  });

  // Post at 00:12 UTC, extracted at 12:30 UTC.
  it.each([
    ['UTC', '2026-10-14 00:12 +00:00', '2026-10-14 12:30 (+00:00)'],
    ['America/New_York', '2026-10-13 20:12 -04:00', '2026-10-14 08:30 (-04:00)'],
    ['Asia/Kolkata', '2026-10-14 05:42 +05:30', '2026-10-14 18:00 (+05:30)'],
  ])('formats %s with its offset', (timeZone, meta, extracted) => {
    const md = toMarkdown(result([tweet()]), { timeZone });
    expect(md).toContain(`<!-- ${meta} · `);
    expect(md).toContain(`- Extracted: ${extracted}\n`);
  });

  it('falls back to the extraction date when the main post has no time', () => {
    const md = toMarkdown(result([tweet({ datetime: null })]), tokyo);
    expect(md).toMatch(/^# X Thread by @username \(2026-10-14\)$/m);
    expect(md).toContain('<!-- https://x.com/username/status/1234567890 -->');
  });

  it('treats an unparsable datetime as missing', () => {
    const md = toMarkdown(result([tweet({ datetime: 'not a date' })]), tokyo);
    expect(md).toContain('<!-- https://x.com/username/status/1234567890 -->');
  });
});

describe('toMarkdown: media and quotes', () => {
  it('labels video posters, and video fallbacks without "(poster)"', () => {
    const md = toMarkdown(
      result([
        tweet({
          media: [
            { type: 'gif', url: 'https://pbs.twimg.com/tweet_video_thumb/x.jpg' },
            { type: 'video', url: 'https://x.com/username/status/1234567890' },
          ],
        }),
      ]),
      tokyo,
    );
    expect(md).toContain('  - [gif] (poster) https://pbs.twimg.com/tweet_video_thumb/x.jpg\n');
    expect(md).toContain('  - [video] https://x.com/username/status/1234567890\n');
  });

  it('renders a quote without date or URL, with media, multi-line text and escaping', () => {
    const md = toMarkdown(
      result([
        tweet({
          quote: {
            id: null,
            url: null,
            author: { displayName: 'Q', handle: 'q' },
            datetime: null,
            text: '# line 1\n\nline 2',
            truncated: false,
            media: [{ type: 'image', url: 'https://pbs.twimg.com/media/Q?format=jpg&name=large' }],
          },
        }),
      ]),
      tokyo,
    );
    expect(md).toContain(
      '> **Quoted post by @q**\n> \\# line 1\n>\n> line 2\n>\n> - [image] https://pbs.twimg.com/media/Q?format=jpg&name=large\n',
    );
    expect(md).not.toContain('> Source:');
    expect(md.trimEnd().endsWith('name=large')).toBe(true);
  });

  it('separates the quote’s media list from its Source line', () => {
    const md = toMarkdown(
      result([
        tweet({
          quote: {
            id: '9',
            url: 'https://x.com/q/status/9',
            author: { displayName: 'Q', handle: 'q' },
            datetime: null,
            text: 'text',
            truncated: false,
            media: [{ type: 'image', url: 'https://pbs.twimg.com/media/Q?format=jpg&name=large' }],
          },
        }),
      ]),
      tokyo,
    );
    // Without the blank ">" line, "Source:" would be read as a continuation of the list item.
    expect(md).toContain(
      '> text\n>\n> - [image] https://pbs.twimg.com/media/Q?format=jpg&name=large\n>\n> Source: https://x.com/q/status/9\n',
    );
  });
});

describe('toMarkdown: HTML comment safety', () => {
  it('neutralizes --> inside the meta comment', () => {
    const md = toMarkdown(result([tweet({ url: 'https://x.com/a/status/1?q=-->' })]), tokyo);
    expect(md).toContain('https://x.com/a/status/1?q=--&gt; -->');
    expect(md.match(/-->/g)).toHaveLength(1);
  });
});

describe('escapeText (PLAN.md §8.3)', () => {
  const esc = (text: string) => escapeText(text).text;

  it.each([
    ['# heading', '\\# heading'],
    ['## sub', '\\## sub'],
    ['###### six', '\\###### six'],
    ['#', '\\#'],
    ['#\ttab', '\\#\ttab'],
    ['> quote', '\\> quote'],
    ['>no space', '\\>no space'],
    ['---', '\\---'],
    ['-----', '\\-----'],
    ['***', '\\***'],
    ['   # three spaces', '   \\# three spaces'],
  ])('escapes line-start %j', (input, expected) => {
    expect(esc(input)).toBe(expected);
  });

  it.each([
    '#hashtag',
    '#tag1 #tag2',
    '####### seven is not a heading',
    'a # not at line start',
    'a > b',
    '- list item',
    '* bullet',
    '*emphasis* and _underscore_',
    '`inline code`',
    '    # four spaces is a code block',
    '--',
    '-- not a rule',
  ])('leaves %j alone', (input) => {
    expect(esc(input)).toBe(input);
  });

  it('escapes each line independently', () => {
    expect(esc('# a\nplain\n> b')).toBe('\\# a\nplain\n\\> b');
  });

  it('does not escape inside a closed code fence', () => {
    const input = 'before\n```\n# comment in code\n> not a quote\n```\n# after';
    expect(escapeText(input)).toEqual({
      text: 'before\n```\n# comment in code\n> not a quote\n```\n\\# after',
      unclosedFence: false,
    });
  });

  it('supports ~~~ fences and longer closing fences', () => {
    expect(escapeText('~~~\n# x\n~~~~\n# y')).toEqual({
      text: '~~~\n# x\n~~~~\n\\# y',
      unclosedFence: false,
    });
  });

  it('does not close a ``` fence with ~~~', () => {
    expect(escapeText('```\n~~~\n# x').unclosedFence).toBe(true);
  });

  it('reports an unclosed fence without closing it', () => {
    expect(escapeText('```js\nconst a = 1;')).toEqual({
      text: '```js\nconst a = 1;',
      unclosedFence: true,
    });
  });

  it('adds a warning for an unclosed fence in a post', () => {
    const md = toMarkdown(result([tweet({ text: '```\ncode' })]), tokyo);
    expect(md).not.toMatch(/```\n```/);
    expect(md).toContain(
      '> ⚠️ Warning: Tweet 1 contains an unclosed code fence; the rest of the output may render as code.',
    );
  });
});
