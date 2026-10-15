import { describe, expect, it } from 'vitest';
import { parseTweet } from '../src/content/extract/parseTweet';
import { el, loadFixture } from './helpers/dom';
import singleTweetHtml from './fixtures/single_tweet.html?raw';

describe('parseTweet on the single_tweet fixture', () => {
  // A single post (an ad, as it happens) with 16 replies from other users; the last reply quotes it.
  const { articles, mainId, url } = loadFixture(singleTweetHtml);
  const tweets = articles.map((article) => parseTweet(article, mainId));

  it('parses all 17 articles', () => {
    expect(articles).toHaveLength(17);
    expect(tweets.every((t) => t !== null)).toBe(true);
  });

  it('parses the main post', () => {
    const main = tweets[0]!;
    expect(main).toMatchObject({
      id: mainId,
      url,
      author: { displayName: 'User 1', handle: 'user1' },
      datetime: '2026-09-10T12:05:57.000Z',
      truncated: false,
      media: [
        { type: 'image', url: 'https://pbs.twimg.com/media/MEDIA0001?format=jpg&name=large' },
      ],
      quote: null,
      isMain: true,
    });
    expect(main.text).toMatch(/^lorem ipsum/);
    expect(main.text).toContain('👇');
    // The full URL from the hidden spans, not the t.co href and without the trailing "…".
    expect(main.text).toContain('https://example.com/link1/part1');
    expect(main.text).not.toContain('t.co');
    expect(main.text).not.toContain('…');
  });

  it('marks only the main post as main', () => {
    expect(tweets.filter((t) => t?.isMain).map((t) => t?.id)).toEqual([mainId]);
  });

  it('parses a reply (time inside User-Name)', () => {
    expect(tweets[1]).toMatchObject({
      id: '1000000000000000002',
      url: 'https://x.com/user3/status/1000000000000000002',
      author: { displayName: 'User 3', handle: 'user3' },
      datetime: '2026-09-15T04:05:16.000Z',
      media: [],
      quote: null,
      isMain: false,
    });
  });

  it('keeps the quote’s photo out of the quoting post', () => {
    const quoting = tweets[16]!;
    expect(quoting.author.handle).toBe('user18');
    expect(quoting.text).toBe('consectetur adipiscing elit sed');
    expect(quoting.media).toEqual([]);
    expect(quoting.quote?.media).toHaveLength(1);
    expect(quoting.quote?.author.handle).toBe('user1');
  });

  it('uses each post’s own User-Name, not the quoted one', () => {
    expect(tweets.map((t) => t?.author.handle)).toEqual([
      'user1',
      ...Array.from({ length: 16 }, (_, i) => `user${i + 3}`),
    ]);
  });

  it('never outputs blob: URLs or avatar images', () => {
    const json = JSON.stringify(tweets);
    expect(json).not.toContain('blob:');
    expect(json).not.toContain('profile_images');
  });

  it('honours the orig resolution', () => {
    expect(parseTweet(articles[0]!, mainId, { resolution: 'orig' })?.media[0]?.url).toBe(
      'https://pbs.twimg.com/media/MEDIA0001?format=jpg&name=orig',
    );
  });

  it('matches the snapshot', () => {
    expect(tweets).toMatchSnapshot();
  });
});

describe('parseTweet edge cases', () => {
  it('returns null for an article without a permalink (e.g. a promoted cell)', () => {
    const article = el(
      '<article data-testid="tweet"><div data-testid="User-Name"><a href="/ad">Ad</a><a href="/ad">@ad</a></div>' +
        '<div data-testid="tweetText"><span>buy</span></div></article>',
    );
    expect(parseTweet(article, null)).toBeNull();
  });

  it('marks truncated posts', () => {
    const article = el(
      '<article data-testid="tweet"><div data-testid="User-Name"><a href="/a">A</a><a href="/a">@a</a>' +
        '<a href="/a/status/5"><time datetime="2026-01-01T00:00:00.000Z">x</time></a></div>' +
        '<div data-testid="tweetText"><span>long…</span></div>' +
        '<button data-testid="tweet-text-show-more-link">more</button></article>',
    );
    expect(parseTweet(article, '5')).toMatchObject({ id: '5', truncated: true, isMain: true });
  });

  it('allows a post without text (media only)', () => {
    const article = el(
      '<article data-testid="tweet"><div data-testid="User-Name"><a href="/a">A</a><a href="/a">@a</a>' +
        '<a href="/a/status/5"><time datetime="2026-01-01T00:00:00.000Z">x</time></a></div></article>',
    );
    expect(parseTweet(article, null)?.text).toBe('');
  });
});
