import { describe, expect, it, vi } from 'vitest';
import type { CopyResult } from '../src/content/clipboard';
import { expandPosts } from '../src/content/expandTruncated';
import { extractAndCopy } from '../src/content/extractAndCopy';
import { SELECTORS } from '../src/content/extract/selectors';
import { loadFixture, timeline } from './helpers/dom';
import showMoreHtml from './fixtures/show_more.html?raw';

const SHOW_MORE = SELECTORS.showMoreLink;

/**
 * Makes "Show more" behave like on x.com: after a short delay the full text is rendered and the
 * button disappears.
 */
function simulateX(doc: Document, { delayMs = 5, sync = false } = {}) {
  const pressed: Element[] = [];
  doc.querySelectorAll(SHOW_MORE).forEach((button, i) => {
    button.addEventListener('click', () => {
      pressed.push(button);
      const expand = () => {
        const text = button.closest(SELECTORS.tweet)?.querySelector(SELECTORS.tweetText);
        text?.append(doc.createTextNode(` FULL TEXT ${i + 1}`));
        button.remove();
      };
      if (sync) expand();
      else setTimeout(expand, delayMs);
    });
  });
  return pressed;
}

function capture() {
  const copied: string[] = [];
  const copy = async (text: string): Promise<CopyResult> => {
    copied.push(text);
    return { ok: true, method: 'clipboard-api' };
  };
  return { copied, copy };
}

describe('show_more.html (the page from the real-device NG report)', () => {
  it('reproduces the problem without expansion: two posts are truncated', async () => {
    const { document, url } = loadFixture(showMoreHtml);
    const { copy } = capture();
    const response = await extractAndCopy({ root: document, url, copy });
    expect(response).toMatchObject({ ok: true, count: 3, truncated: 2 });
    expect(response.ok && response.warnings).toEqual([
      'Tweet 1 was truncated ("Show more") and may be incomplete.',
      'Tweet 2 was truncated ("Show more") and may be incomplete.',
    ]);
  });

  it('expands the truncated posts before copying', async () => {
    const { document, url } = loadFixture(showMoreHtml);
    const pressed = simulateX(document);
    const { copied, copy } = capture();
    const response = await extractAndCopy({
      root: document,
      url,
      copy,
      expand: (ids) => expandPosts(document, ids, { timeoutMs: 1000 }),
    });
    expect(pressed).toHaveLength(2);
    expect(response).toEqual({ ok: true, count: 3, truncated: 0, warnings: [] });
    expect(copied[0]).toContain('FULL TEXT 1');
    expect(copied[0]).toContain('FULL TEXT 2');
    expect(copied[0]).not.toContain('Warning');
  });
});

describe('expandPosts', () => {
  it('presses only the buttons of the requested posts', async () => {
    const doc = timeline([
      { handle: 'a', id: '1', truncated: true },
      { handle: 'other', id: '2', truncated: true },
    ]);
    const pressed = simulateX(doc);
    await expect(expandPosts(doc, new Set(['1']), { timeoutMs: 1000 })).resolves.toBe(1);
    expect(pressed).toHaveLength(1);
    expect(doc.querySelectorAll(SHOW_MORE)).toHaveLength(1); // the other post is untouched
  });

  it('does not press a "Show more" that is a link (it would leave the page)', async () => {
    const doc = timeline([{ handle: 'a', id: '1' }]);
    const link = doc.createElement('a');
    link.setAttribute('data-testid', 'tweet-text-show-more-link');
    link.setAttribute('href', '/a/status/1');
    const click = vi.fn();
    link.addEventListener('click', click);
    doc.querySelector(SELECTORS.tweet)!.append(link);
    await expect(expandPosts(doc, new Set(['1']))).resolves.toBe(0);
    expect(click).not.toHaveBeenCalled();
  });

  it('does not press the quote’s "Show more"', async () => {
    const doc = timeline([{ handle: 'a', id: '1', quote: 'q', quoteTruncated: true }]);
    const click = vi.fn();
    doc.querySelector(SHOW_MORE)!.addEventListener('click', click);
    await expect(expandPosts(doc, new Set(['1']))).resolves.toBe(0);
    expect(click).not.toHaveBeenCalled();
  });

  it('resolves immediately when X expands synchronously', async () => {
    const doc = timeline([{ handle: 'a', id: '1', truncated: true }]);
    simulateX(doc, { sync: true });
    const started = Date.now();
    await expandPosts(doc, new Set(['1']), { timeoutMs: 10_000 });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('treats a re-rendered post (old elements detached) as expanded', async () => {
    const doc = timeline([{ handle: 'a', id: '1', truncated: true }]);
    const article = doc.querySelector(SELECTORS.tweet)!;
    doc.querySelector(SHOW_MORE)!.addEventListener('click', () => {
      setTimeout(() => article.replaceWith(article.cloneNode(true)), 5);
    });
    const started = Date.now();
    await expandPosts(doc, new Set(['1']), { timeoutMs: 10_000 });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('gives up after the timeout; the warning stays', async () => {
    const doc = timeline([{ handle: 'a', id: '1', truncated: true }]);
    const { copy } = capture(); // the button does nothing
    const response = await extractAndCopy({
      root: doc,
      url: 'https://x.com/a/status/1',
      copy,
      expand: (ids) => expandPosts(doc, ids, { timeoutMs: 30 }),
    });
    expect(response).toMatchObject({ ok: true, truncated: 1 });
  });
});

describe('extractAndCopy expansion', () => {
  it('does not try to expand when nothing is truncated', async () => {
    const expand = vi.fn(async () => 0);
    await extractAndCopy({
      root: timeline([{ handle: 'a', id: '1' }]),
      url: 'https://x.com/a/status/1',
      copy: capture().copy,
      expand,
    });
    expect(expand).not.toHaveBeenCalled();
  });

  it('asks to expand only truncated posts of the thread', async () => {
    const expand = vi.fn(async () => 0);
    await extractAndCopy({
      root: timeline([
        { handle: 'a', id: '1' },
        { handle: 'a', id: '2', truncated: true },
        { handle: 'other', id: '3', truncated: true },
      ]),
      url: 'https://x.com/a/status/1',
      copy: capture().copy,
      expand,
    });
    expect(expand).toHaveBeenCalledWith(new Set(['2']));
  });
});
