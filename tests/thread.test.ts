import { describe, expect, it } from 'vitest';
import { countTruncated, extractThread } from '../src/content/extract/thread';
import type { ThreadResult } from '../src/shared/types';
import { HEADING, loadFixture, timeline } from './helpers/dom';
import image3Html from './fixtures/image3.html?raw';
import image4Html from './fixtures/image4.html?raw';
import quoteHtml from './fixtures/quote.html?raw';
import showMoreHtml from './fixtures/show_more.html?raw';
import singleHtml from './fixtures/single.html?raw';
import singleTweetHtml from './fixtures/single_tweet.html?raw';
import specialHtml from './fixtures/special.html?raw';
import threadHtml from './fixtures/thread.html?raw';

const now = () => new Date('2026-10-15T00:00:00.000Z');

function ok(outcome: ReturnType<typeof extractThread>): ThreadResult {
  if (!outcome.ok) throw new Error(`Expected success, got ${outcome.code}: ${outcome.message}`);
  return outcome.result;
}
const ids = (result: ThreadResult) => result.tweets.map((t) => t.id);

describe('extractThread on fixtures', () => {
  it.each([
    ['thread', threadHtml, 4],
    // A 3rd post by user1 follows under "Discover more": a recommendation, not the thread.
    ['image3', image3Html, 2],
    // Everything below the main post is under "Discover more".
    ['image4', image4Html, 1],
    ['single', singleHtml, 1],
    ['quote', quoteHtml, 1],
    // The 16 posts below the main one are replies by other users: collection stops at once.
    ['single_tweet', singleTweetHtml, 1],
  ])('%s.html collects %i post(s) by the main author', (_, html, count) => {
    const { document, url, mainId } = loadFixture(html);
    const result = ok(extractThread(document, url, { now }));
    expect(result.tweets).toHaveLength(count);
    expect(result.tweets[0]?.id).toBe(mainId);
    expect(new Set(result.tweets.map((t) => t.author.handle))).toEqual(new Set(['user1']));
    expect(result).toMatchObject({
      sourceUrl: url,
      rootAuthor: { handle: 'user1' },
      warnings: [],
      extractedAt: '2026-10-15T00:00:00.000Z',
    });
  });

  it('accepts the page URL with extra path and query (photo viewer, share links)', () => {
    const { document, url } = loadFixture(threadHtml);
    const result = ok(extractThread(document, `${url}/photo/1?s=20`, { now }));
    expect(result.tweets).toHaveLength(4);
    expect(result.sourceUrl).toBe(url); // canonical URL, tracking query dropped
  });

  it.each([
    ['image3', image3Html, 2],
    ['image4', image4Html, 1],
    ['special', specialHtml, 2],
    ['show_more', showMoreHtml, 6],
  ])('%s.html: never collects posts under "Discover more", in either mode', (_, html, count) => {
    const { document, url } = loadFixture(html);
    const cells = [...document.querySelectorAll('[data-testid="cellInnerDiv"]')];
    const below = cells
      .slice(cells.findIndex((c) => c.querySelector('h2')))
      .flatMap((c) => [...c.querySelectorAll('a[href*="/status/"] time')])
      .map((t) => t.closest('a')!.getAttribute('href')!.split('/')[3]);
    expect(below.length).toBeGreaterThan(0);
    for (const mode of ['author', 'all'] as const) {
      const result = ok(extractThread(document, url, { mode }));
      if (mode === 'all') expect(result.tweets).toHaveLength(count);
      for (const id of below) expect(ids(result)).not.toContain(id);
    }
  });

  it('passes the image resolution through', () => {
    const { document, url } = loadFixture(image3Html);
    const result = ok(extractThread(document, url, { resolution: 'orig' }));
    expect(result.tweets[0]?.media[0]?.url).toMatch(/name=orig$/);
  });
});

describe('extractThread: thread range', () => {
  const url = (id: string) => `https://x.com/a/status/${id}`;

  it('collects same-author posts above the main post (opened mid-thread)', () => {
    const doc = timeline([
      { handle: 'other', id: '1' },
      { handle: 'a', id: '2' },
      { handle: 'a', id: '3' },
      { handle: 'a', id: '4' }, // main
      { handle: 'a', id: '5' },
    ]);
    expect(ids(ok(extractThread(doc, url('4'))))).toEqual(['2', '3', '4', '5']);
  });

  it('stops at the first post by another author in both directions', () => {
    const doc = timeline([
      { handle: 'a', id: '1' },
      { handle: 'other', id: '2' },
      { handle: 'a', id: '3' }, // main
      { handle: 'a', id: '4' },
      { handle: 'other', id: '5' },
      { handle: 'a', id: '6' }, // the author again, after someone else's reply: not the thread
    ]);
    expect(ids(ok(extractThread(doc, url('3'))))).toEqual(['3', '4']);
  });

  it('compares handles case-insensitively', () => {
    const doc = timeline([
      { handle: 'Alice', id: '1' },
      { handle: 'alice', id: '2' },
    ]);
    expect(ids(ok(extractThread(doc, 'https://x.com/ALICE/status/1')))).toEqual(['1', '2']);
  });

  it('removes duplicate posts (re-rendered cells) keeping the first', () => {
    const doc = timeline([
      { handle: 'a', id: '1' },
      { handle: 'a', id: '2' },
      { handle: 'a', id: '2', text: 'duplicate' },
      { handle: 'a', id: '3' },
    ]);
    const result = ok(extractThread(doc, url('1')));
    expect(ids(result)).toEqual(['1', '2', '3']);
    expect(result.tweets[1]?.text).toBe('text 2');
  });

  it('skips articles without a permalink (promoted cells) between thread posts', () => {
    const doc = timeline([
      { handle: 'a', id: '1' },
      { handle: 'a', id: '2' },
    ]);
    const ad = doc.createElement('article');
    ad.setAttribute('data-testid', 'tweet');
    doc
      .querySelector('main')!
      .insertBefore(ad, doc.querySelectorAll('[data-testid="cellInnerDiv"]')[1]!);
    expect(ids(ok(extractThread(doc, url('1'))))).toEqual(['1', '2']);
  });

  it('stops at a section heading even when the author continues below it', () => {
    const doc = timeline([
      { handle: 'a', id: '1' },
      { handle: 'a', id: '2' },
      HEADING,
      { handle: 'a', id: '3' }, // recommended post by the same author
    ]);
    expect(ids(ok(extractThread(doc, url('1'))))).toEqual(['1', '2']);
  });

  it('uses only the main post’s section (a heading above it cuts off the posts before)', () => {
    const doc = timeline([
      { handle: 'a', id: '1' },
      HEADING,
      { handle: 'a', id: '2' }, // main
      { handle: 'a', id: '3' },
    ]);
    expect(ids(ok(extractThread(doc, url('2'))))).toEqual(['2', '3']);
  });

  it('MAIN_NOT_FOUND when the main post is in no section', () => {
    expect(extractThread(timeline([HEADING, { handle: 'a', id: '1' }]), url('9'))).toMatchObject({
      ok: false,
      code: 'MAIN_NOT_FOUND',
    });
  });

  it('works on twitter.com URLs', () => {
    const doc = timeline([{ handle: 'a', id: '1' }]);
    expect(ok(extractThread(doc, 'https://twitter.com/a/status/1')).tweets).toHaveLength(1);
  });
});

describe('extractThread: mode "all" (replies by others included)', () => {
  const url = (id: string) => `https://x.com/a/status/${id}`;

  it('collects every post below the main post, whoever wrote it', () => {
    const doc = timeline([
      { handle: 'a', id: '1' },
      { handle: 'a', id: '2' }, // main
      { handle: 'a', id: '3' },
      { handle: 'b', id: '4' },
      { handle: 'a', id: '5' },
      { handle: 'c', id: '6' },
    ]);
    const result = ok(extractThread(doc, url('2'), { mode: 'all' }));
    expect(ids(result)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(result.rootAuthor.handle).toBe('a');
  });

  it('still goes upwards by the main author only', () => {
    const doc = timeline([
      { handle: 'b', id: '1' },
      { handle: 'a', id: '2' },
      { handle: 'a', id: '3' }, // main
      { handle: 'b', id: '4' },
    ]);
    expect(ids(ok(extractThread(doc, url('3'), { mode: 'all' })))).toEqual(['2', '3', '4']);
  });

  it('stops at a section heading', () => {
    const doc = timeline([
      { handle: 'a', id: '1' },
      { handle: 'b', id: '2' },
      HEADING,
      { handle: 'c', id: '3' },
    ]);
    expect(ids(ok(extractThread(doc, url('1'), { mode: 'all' })))).toEqual(['1', '2']);
  });

  it('single_tweet.html: the main post and its 16 replies', () => {
    const { document, url: pageUrl } = loadFixture(singleTweetHtml);
    const result = ok(extractThread(document, pageUrl, { mode: 'all' }));
    expect(result.tweets).toHaveLength(17);
    expect(result.tweets[0]?.isMain).toBe(true);
    expect(result.tweets.slice(1).map((t) => t.author.handle)).not.toContain('user1');
  });

  it('warns about truncated replies by others too', () => {
    const doc = timeline([
      { handle: 'a', id: '1' },
      { handle: 'b', id: '2', truncated: true },
    ]);
    expect(ok(extractThread(doc, url('1'), { mode: 'all' })).warnings).toEqual([
      'Tweet 2 was truncated ("Show more") and may be incomplete.',
    ]);
  });
});

describe('extractThread: warnings', () => {
  it('warns about truncated posts and quotes using output numbering', () => {
    const doc = timeline([
      { handle: 'other', id: '1', truncated: true }, // not part of the thread: no warning
      { handle: 'a', id: '2' },
      { handle: 'a', id: '3', truncated: true },
      { handle: 'a', id: '4', quote: 'q', quoteTruncated: true },
    ]);
    const result = ok(extractThread(doc, 'https://x.com/a/status/2'));
    expect(result.warnings).toEqual([
      'Tweet 2 was truncated ("Show more") and may be incomplete.',
      'The quoted post in Tweet 3 was truncated ("Show more") and may be incomplete.',
    ]);
    expect(countTruncated(result)).toBe(2);
  });
});

describe('extractThread: errors (never throws)', () => {
  it.each([
    'https://x.com/home',
    'https://x.com/a',
    'https://example.com/a/status/1',
    'chrome://extensions',
    'not a url',
  ])('NOT_STATUS_PAGE for %s', (pageUrl) => {
    expect(extractThread(timeline([{ handle: 'a', id: '1' }]), pageUrl)).toMatchObject({
      ok: false,
      code: 'NOT_STATUS_PAGE',
    });
  });

  it('NO_TWEETS when nothing is rendered', () => {
    expect(extractThread(timeline([]), 'https://x.com/a/status/1')).toMatchObject({
      ok: false,
      code: 'NO_TWEETS',
    });
  });

  it('MAIN_NOT_FOUND when the URL’s post is not rendered', () => {
    expect(
      extractThread(timeline([{ handle: 'a', id: '1' }]), 'https://x.com/a/status/999'),
    ).toMatchObject({ ok: false, code: 'MAIN_NOT_FOUND' });
  });

  it('includes a human-readable message', () => {
    const outcome = extractThread(timeline([]), 'https://x.com/home');
    expect(outcome.ok === false && outcome.message.length > 0).toBe(true);
  });
});
