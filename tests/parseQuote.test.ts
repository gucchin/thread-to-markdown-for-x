import { describe, expect, it } from 'vitest';
import { findQuoteContainer, parseQuote } from '../src/content/extract/parseQuote';
import { el, loadFixture } from './helpers/dom';
import singleTweetHtml from './fixtures/single_tweet.html?raw';

// Minimal quote card modelled on the fixture: no links on the name, <time> without a permalink.
const card = (inner: string) =>
  `<article><div data-testid="User-Name"><a href="/outer">Outer</a><a href="/outer">@outer</a></div>
   <div data-testid="tweetText"><span>outer text</span></div>
   <div role="link"><div data-testid="User-Name"><div><span>Quoted Name</span></div><div><span>@quoted</span></div>
   <div><time datetime="2026-01-02T03:04:05.000Z">Jan 2</time></div></div>
   <div data-testid="tweetText"><span>quoted text</span></div>${inner}</div></article>`;

describe('findQuoteContainer', () => {
  it('ignores div[role=link] without a User-Name', () => {
    expect(
      findQuoteContainer(el('<article><div role="link"><span>card</span></div></article>')),
    ).toBeNull();
  });

  it('finds the card that contains a User-Name', () => {
    expect(findQuoteContainer(el(card('')))?.textContent).toContain('quoted text');
  });
});

describe('parseQuote', () => {
  it('reads author, time and text from the card only', () => {
    const quote = parseQuote(findQuoteContainer(el(card('')))!);
    expect(quote).toEqual({
      id: null,
      url: null,
      author: { displayName: 'Quoted Name', handle: 'quoted' },
      datetime: '2026-01-02T03:04:05.000Z',
      text: 'quoted text',
      truncated: false,
      media: [],
    });
  });

  it('takes the URL from a /status/ link of the quoted author inside the card', () => {
    const photo =
      '<a href="/quoted/status/42/photo/1"><div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/Q?format=jpg&amp;name=small"></div></a>';
    const quote = parseQuote(findQuoteContainer(el(card(photo)))!);
    expect(quote?.id).toBe('42');
    expect(quote?.url).toBe('https://x.com/quoted/status/42');
    expect(quote?.media).toEqual([
      { type: 'image', url: 'https://pbs.twimg.com/media/Q?format=jpg&name=large' },
    ]);
  });

  it('ignores /status/ links of other authors', () => {
    const quote = parseQuote(
      findQuoteContainer(el(card('<a href="/someone_else/status/7">x</a>')))!,
    );
    expect(quote?.url).toBeNull();
  });
});

describe('parseQuote on the single_tweet fixture', () => {
  const { articles } = loadFixture(singleTweetHtml);
  const quoting = articles.filter((a) => findQuoteContainer(a));

  it('finds exactly one quoting post', () => {
    expect(quoting).toHaveLength(1);
  });

  it('parses the quoted post (which is the main post)', () => {
    const quote = parseQuote(findQuoteContainer(quoting[0]!)!);
    expect(quote).toMatchObject({
      id: '1000000000000000001',
      url: 'https://x.com/user1/status/1000000000000000001',
      author: { displayName: 'User 1', handle: 'user1' },
      datetime: '2026-09-10T12:05:57.000Z',
      truncated: false,
      media: [
        { type: 'image', url: 'https://pbs.twimg.com/media/MEDIA0001?format=jpg&name=large' },
      ],
    });
    expect(quote?.text).toContain('https://example.com/text1/part1');
    expect(quote?.text).not.toMatch(/…$/m);
  });
});
