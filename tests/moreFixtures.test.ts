// Fixtures collected during the Day 2 real-device test (PLAN.md §11.2):
// mid_thread (opened mid-thread), special (emoji / newlines), english (English UI), gif.
import { describe, expect, it } from 'vitest';
import type { CopyResult } from '../src/content/clipboard';
import { expandPosts } from '../src/content/expandTruncated';
import { extractAndCopy } from '../src/content/extractAndCopy';
import { parseTweet } from '../src/content/extract/parseTweet';
import { SELECTORS } from '../src/content/extract/selectors';
import { extractThread } from '../src/content/extract/thread';
import { syncButton, BUTTON_HOST_ATTR } from '../src/content/ui/button';
import { loadFixture } from './helpers/dom';
import englishHtml from './fixtures/english.html?raw';
import gifHtml from './fixtures/gif.html?raw';
import image4Html from './fixtures/image4.html?raw';
import threadHtml from './fixtures/thread.html?raw';
import midThreadHtml from './fixtures/mid_thread.html?raw';
import specialHtml from './fixtures/special.html?raw';

function thread(html: string) {
  const { document, url, mainId } = loadFixture(html);
  const outcome = extractThread(document, url);
  if (!outcome.ok) throw new Error(outcome.message);
  return { document, url, mainId, result: outcome.result };
}

describe('mid_thread.html: the main post is the 3rd of a 6-post thread', () => {
  it('collects the two posts above the main post (upwards) and the three below', () => {
    const { result, mainId } = thread(midThreadHtml);
    expect(result.tweets).toHaveLength(6);
    expect(result.tweets.map((t) => t.isMain)).toEqual([false, false, true, false, false, false]);
    expect(result.tweets[2]?.id).toBe(mainId);
    expect(new Set(result.tweets.map((t) => t.author.handle))).toEqual(new Set(['user1']));
    // The heading and Source still point at the main post, not the first one.
    expect(result.sourceUrl).toBe(`https://x.com/user1/status/${mainId}`);
  });

  it('numbers truncation warnings by position in the whole thread', () => {
    expect(thread(midThreadHtml).result.warnings).toEqual([
      'Tweet 4 was truncated ("Show more") and may be incomplete.',
      'Tweet 5 was truncated ("Show more") and may be incomplete.',
    ]);
  });

  it('expands both truncated posts below the main post before copying', async () => {
    const { document, url } = loadFixture(midThreadHtml);
    // Simulate X's in-place expansion.
    document.querySelectorAll(SELECTORS.showMoreLink).forEach((button) =>
      button.addEventListener('click', () =>
        setTimeout(() => {
          button.closest(SELECTORS.tweet)?.querySelector(SELECTORS.tweetText)?.append(' (full)');
          button.remove();
        }, 5),
      ),
    );
    const copied: string[] = [];
    const response = await extractAndCopy({
      root: document,
      url,
      copy: async (text): Promise<CopyResult> => {
        copied.push(text);
        return { ok: true, method: 'clipboard-api' };
      },
      expand: (ids) => expandPosts(document, ids, { timeoutMs: 1000 }),
    });
    expect(response).toEqual({ ok: true, count: 6, truncated: 0, warnings: [] });
    expect(copied[0]?.match(/\(full\)/g)).toHaveLength(2);
    expect(copied[0]).toContain('### Tweet 3 (Main)');
  });
});

describe('special.html: emoji and blank lines', () => {
  const { result } = thread(specialHtml);

  it('collects the two thread posts (the 3rd post by user1 is under "Discover more")', () => {
    expect(result.tweets).toHaveLength(2);
  });

  it('keeps emoji (from img alt) and paragraph breaks, with at most one blank line', () => {
    const texts = result.tweets.map((t) => t.text);
    expect(texts.join('\n')).toMatch(/\p{Extended_Pictographic}/u);
    expect(texts.some((t) => t.includes('\n\n'))).toBe(true);
    for (const t of texts) {
      expect(t).not.toMatch(/\n{3,}/);
      expect(t).toBe(t.trim());
    }
  });

  it('keeps the post’s own image apart from its image-less quote', () => {
    // The recommended post under "Discover more" is still real markup for parseTweet.
    // DOM order: tweetText -> tweetPhoto (the post's own, /status/<own id>/photo/1) -> quote card.
    const { document, mainId } = loadFixture(specialHtml);
    const quoting = parseTweet(document.querySelectorAll(SELECTORS.tweet)[2]!, mainId)!;
    expect(quoting.media).toHaveLength(1);
    expect(quoting.quote).toMatchObject({ id: null, url: null, media: [] });
  });
});

describe('gif.html: a post with a GIF', () => {
  it('records the GIF as gif with its poster, not the mp4', () => {
    const { result } = thread(gifHtml);
    expect(result.tweets).toHaveLength(1);
    expect(result.tweets[0]?.media).toEqual([
      { type: 'gif', url: 'https://pbs.twimg.com/tweet_video_thumb/1/img/VIDEO0001.jpg' },
    ]);
    expect(JSON.stringify(result)).not.toContain('video.twimg.com');
  });

  it('labels it [gif] (poster) in the Markdown', async () => {
    const { document, url } = loadFixture(gifHtml);
    const copied: string[] = [];
    await extractAndCopy({
      root: document,
      url,
      copy: async (text): Promise<CopyResult> => {
        copied.push(text);
        return { ok: true, method: 'clipboard-api' };
      },
    });
    expect(copied[0]).toContain(
      '  - [gif] (poster) https://pbs.twimg.com/tweet_video_thumb/1/img/VIDEO0001.jpg\n',
    );
  });
});

describe('image4.html: a post with four images', () => {
  it('records the four images in display order, at the chosen size', () => {
    const { document, url } = loadFixture(image4Html);
    const outcome = extractThread(document, url, { resolution: 'orig' });
    if (!outcome.ok) throw new Error(outcome.message);
    expect(outcome.result.tweets).toHaveLength(1);
    expect(outcome.result.tweets[0]?.media).toEqual(
      ['MEDIA0001', 'MEDIA0002', 'MEDIA0003', 'MEDIA0004'].map((id) => ({
        type: 'image',
        url: `https://pbs.twimg.com/media/${id}?format=jpg&name=orig`,
        // X's default alt ("画像") is recorded but not written to the Markdown (docs/015).
        alt: '画像',
      })),
    );
  });

  it('does not take a link card thumbnail (card_img) for an attached image', () => {
    const { document, mainId } = loadFixture(image4Html);
    const withCard = [...document.querySelectorAll(SELECTORS.tweet)].find((a) =>
      a.querySelector('img[src*="/card_img/"], [style*="/card_img/"]'),
    );
    expect(withCard).toBeDefined();
    expect(parseTweet(withCard!, mainId)?.media).toEqual([]);
  });
});

describe('videos in earlier fixtures stay videos', () => {
  it('thread.html: amplify_video_thumb posters are videos', () => {
    const { result } = thread(threadHtml);
    const types = result.tweets.flatMap((t) =>
      [...t.media, ...(t.quote?.media ?? [])].map((m) => m.type),
    );
    expect(types).toContain('video');
    expect(types).not.toContain('gif');
  });
});

describe('english.html: English UI', () => {
  // The same selectors must work regardless of the UI language (PLAN.md §7.1).
  const { document, mainId, url, result } = thread(englishHtml);

  it('parses every post', () => {
    const articles = [...document.querySelectorAll(SELECTORS.tweet)];
    expect(articles).toHaveLength(6);
    for (const article of articles) {
      const tweet = parseTweet(article, mainId);
      expect(tweet?.author.handle).toMatch(/^user\d+$/);
      expect(tweet?.datetime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it('collects the main post only (the replies are by other users)', () => {
    expect(result.tweets).toHaveLength(1);
    expect(result.tweets[0]).toMatchObject({ id: mainId, isMain: true, truncated: false });
    expect(result.tweets[0]?.text.length).toBeGreaterThan(0);
  });

  it('places the page button', () => {
    syncButton({ doc: document, getUrl: () => url, onClick: async () => {} });
    expect(document.querySelectorAll(`[${BUTTON_HOST_ATTR}]`)).toHaveLength(1);
  });
});
