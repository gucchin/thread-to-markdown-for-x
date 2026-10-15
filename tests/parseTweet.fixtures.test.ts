// parseTweet against the Day 1 fixtures (anonymized x.com snapshots, Japanese UI).
import { describe, expect, it } from 'vitest';
import { parseTweet } from '../src/content/extract/parseTweet';
import type { TweetData } from '../src/shared/types';
import { loadFixture } from './helpers/dom';
import image3Html from './fixtures/image3.html?raw';
import quoteHtml from './fixtures/quote.html?raw';
import singleHtml from './fixtures/single.html?raw';
import threadHtml from './fixtures/thread.html?raw';

function parseFixture(html: string) {
  const fixture = loadFixture(html);
  const tweets = fixture.articles.map((article) => parseTweet(article, fixture.mainId));
  expect(tweets.every((t) => t !== null)).toBe(true);
  return { ...fixture, tweets: tweets as TweetData[] };
}

const image = (id: string, format = 'jpg') => ({
  type: 'image',
  url: `https://pbs.twimg.com/media/${id}?format=${format}&name=large`,
});
const video = (n: number) => ({
  type: 'video',
  url: `https://pbs.twimg.com/amplify_video_thumb/${n}/img/VIDEO${String(n).padStart(4, '0')}.jpg`,
});

describe('single.html: one post, no media', () => {
  const { tweets, url } = parseFixture(singleHtml);

  it('parses the only post as main', () => {
    expect(tweets).toHaveLength(1);
    expect(tweets[0]).toMatchObject({
      url,
      author: { displayName: 'User 1', handle: 'user1' },
      datetime: '2026-10-10T13:07:26.000Z',
      media: [],
      quote: null,
      truncated: false,
      isMain: true,
    });
    expect(tweets[0]?.text.length).toBeGreaterThan(0);
  });
});

describe('thread.html: four consecutive posts by one author', () => {
  const { tweets, mainId } = parseFixture(threadHtml);

  it('parses all four posts in display order, by the same author', () => {
    expect(tweets.map((t) => t.id)).toEqual([
      mainId,
      '1000000000000000002',
      '1000000000000000004',
      '1000000000000000006',
    ]);
    expect(new Set(tweets.map((t) => t.author.handle))).toEqual(new Set(['user1']));
    expect(tweets.map((t) => t.isMain)).toEqual([true, false, false, false]);
  });

  it('keeps carousel media in DOM order (3 videos, then 1 image)', () => {
    // Videos sit inside tweetPhoto too; their poster <img> must not be counted as an image.
    expect(tweets[0]?.media).toMatchObject([video(1), video(2), video(3), image('MEDIA0001')]);
  });

  it('separates each self-quote from the quoting post', () => {
    for (const tweet of tweets.slice(1)) {
      expect(tweet.media).toEqual([]);
      expect(tweet.quote?.author.handle).toBe('user1');
      // The quoted post's URL comes from the photo link inside the card.
      expect(tweet.quote?.url).toBe(`https://x.com/user1/status/${tweet.quote?.id}`);
    }
    expect(tweets.map((t) => t.quote?.media.length ?? 0)).toEqual([0, 4, 2, 4]);
  });

  it('matches the snapshot', () => {
    expect(tweets).toMatchSnapshot();
  });
});

describe('image3.html: three images', () => {
  const { tweets } = parseFixture(image3Html);

  it('extracts the three images of the main post in order', () => {
    expect(tweets[0]?.isMain).toBe(true);
    expect(tweets[0]?.media).toMatchObject([
      image('MEDIA0001'),
      image('MEDIA0002'),
      image('MEDIA0003'),
    ]);
  });

  it('extracts mixed video and image media', () => {
    expect(tweets[1]?.media).toMatchObject([video(1), image('MEDIA0004')]);
  });

  it('keeps a quote by another author, with its png images, out of the quoting post', () => {
    expect(tweets[2]?.media).toEqual([]);
    expect(tweets[2]?.quote).toMatchObject({
      id: '1000000000000000004',
      url: 'https://x.com/user3/status/1000000000000000004',
      author: { displayName: 'User 3', handle: 'user3' },
      media: [image('MEDIA0005', 'png'), image('MEDIA0006', 'png')],
    });
  });

  it('matches the snapshot', () => {
    expect(tweets).toMatchSnapshot();
  });
});

describe('quote.html: main post quoting another author’s video', () => {
  const { tweets } = parseFixture(quoteHtml);

  it('keeps the quoted video out of the main post', () => {
    expect(tweets).toHaveLength(1);
    expect(tweets[0]?.isMain).toBe(true);
    expect(tweets[0]?.media).toEqual([]);
  });

  it('parses the quote without a URL (the card has no /status/ link)', () => {
    expect(tweets[0]?.quote).toMatchObject({
      id: null,
      url: null,
      author: { displayName: 'User 2', handle: 'user2' },
      datetime: '2026-10-12T08:38:29.000Z',
      media: [video(1)],
    });
    expect(tweets[0]?.quote?.text.length).toBeGreaterThan(0);
  });

  it('never outputs blob: URLs', () => {
    expect(JSON.stringify(tweets)).not.toContain('blob:');
  });
});

describe('all fixtures', () => {
  it.each([
    ['single', singleHtml],
    ['thread', threadHtml],
    ['image3', image3Html],
    ['quote', quoteHtml],
  ])('%s: no blob:, avatars, video thumbnails as images, or leftover ellipsis URLs', (_, html) => {
    const { tweets } = parseFixture(html);
    const json = JSON.stringify(tweets);
    expect(json).not.toContain('blob:');
    expect(json).not.toContain('profile_images');
    for (const t of tweets) {
      for (const m of [...t.media, ...(t.quote?.media ?? [])]) {
        if (m.type === 'image') expect(m.url).toMatch(/^https:\/\/pbs\.twimg\.com\/media\//);
      }
      expect(t.text).not.toMatch(/https?:\/\/\S*…/);
    }
  });
});
