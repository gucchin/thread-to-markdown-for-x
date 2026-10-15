import { describe, expect, it, vi } from 'vitest';
import type { CopyResult } from '../src/content/clipboard';
import {
  collectByScrolling,
  MergedTimeline,
  waitForSettle,
  type ScrollPort,
} from '../src/content/extract/autoScroll';
import { selectThread, type TimelineEntry } from '../src/content/extract/thread';
import { extractAndCopy } from '../src/content/extractAndCopy';
import type { TweetData } from '../src/shared/types';
import { timeline } from './helpers/dom';

function post(id: string, handle = 'a', extra: Partial<TweetData> = {}): TimelineEntry {
  return {
    kind: 'tweet',
    tweet: {
      id,
      url: `https://x.com/${handle}/status/${id}`,
      author: { displayName: handle, handle },
      datetime: null,
      text: `text ${id}`,
      truncated: false,
      media: [],
      quote: null,
      isMain: id === '1',
      ...extra,
    },
  };
}
const BREAK: TimelineEntry = { kind: 'break' };
const ids = (entries: readonly TimelineEntry[]) =>
  entries.map((e) => (e.kind === 'tweet' ? e.tweet.id : '|'));

/**
 * A virtually scrolled page: only `viewport` entries starting at the scroll position are rendered.
 * One scroll unit is one entry (100 px).
 */
function fakePage(all: TimelineEntry[], { viewport = 4, step = 3, startAt = 0 } = {}) {
  let at = startAt;
  const port: ScrollPort = {
    getY: () => at * 100,
    scrollBy: vi.fn((dy: number) => {
      at = Math.min(at + dy / 100, Math.max(0, all.length - viewport));
    }),
    scrollTo: vi.fn((y: number) => {
      at = y / 100;
    }),
    stepHeight: () => step * 100,
    settle: vi.fn(async () => {}),
  };
  return { port, read: () => all.slice(at, at + viewport), position: () => at };
}

describe('collectByScrolling', () => {
  it('collects a thread longer than the screen and stops at another author', async () => {
    const all = [...['1', '2', '3', '4', '5', '6', '7'].map((id) => post(id)), post('8', 'b')];
    const page = fakePage(all);
    const result = await collectByScrolling({ read: page.read, scroll: page.port });
    expect(result.reason).toBe('end');
    expect(ids(result.entries)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(page.port.scrollBy).toHaveBeenCalled();
    expect(page.position()).toBe(0); // restored
  });

  it('does not scroll when the whole thread is already on screen', async () => {
    const page = fakePage([post('1'), post('2'), post('3', 'b')]);
    const result = await collectByScrolling({ read: page.read, scroll: page.port });
    expect(result.reason).toBe('end');
    expect(page.port.scrollBy).not.toHaveBeenCalled();
  });

  it('stops at the "Discover more" heading, in mode "all" too', async () => {
    const all = [post('1'), post('2', 'b'), post('3', 'c'), post('4'), post('5', 'b'), BREAK];
    const page = fakePage([...all, post('6'), post('7')]);
    const result = await collectByScrolling({ read: page.read, scroll: page.port, mode: 'all' });
    expect(result.reason).toBe('end');
    // The reading that showed the heading may hold posts below it; the thread excludes them.
    expect(selectThread(result.entries, 'all')?.tweets.map((t) => t.id)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
    expect(page.port.scrollBy).toHaveBeenCalledOnce(); // stopped as soon as the heading appeared
  });

  it('keeps going past other authors in mode "all" until nothing new appears', async () => {
    const all = ['1', '2', '3', '4', '5', '6', '7'].map((id, i) => post(id, i % 2 ? 'b' : 'a'));
    const page = fakePage(all);
    const result = await collectByScrolling({
      read: page.read,
      scroll: page.port,
      mode: 'all',
      maxIdleSteps: 2,
    });
    expect(result.reason).toBe('idle');
    expect(ids(result.entries)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
  });

  it('gives up after N steps in a row without new posts (end of page, nothing loads)', async () => {
    const page = fakePage(['1', '2', '3', '4', '5'].map((id) => post(id)));
    const result = await collectByScrolling({
      read: page.read,
      scroll: page.port,
      maxIdleSteps: 3,
    });
    expect(result.reason).toBe('idle');
    expect(ids(result.entries)).toEqual(['1', '2', '3', '4', '5']);
    // The step that reached the end added a post; then three idle steps.
    expect(vi.mocked(page.port.settle).mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('stops at the post limit', async () => {
    const page = fakePage(Array.from({ length: 30 }, (_, i) => post(String(i + 1))));
    const result = await collectByScrolling({ read: page.read, scroll: page.port, maxPosts: 10 });
    expect(result.reason).toBe('limit');
    expect(result.entries.length).toBeGreaterThanOrEqual(10);
    expect(page.position()).toBe(0);
  });

  it('stops at the time limit', async () => {
    let clock = 0;
    const page = fakePage(Array.from({ length: 30 }, (_, i) => post(String(i + 1))));
    vi.mocked(page.port.settle).mockImplementation(async () => {
      clock += 10_000;
    });
    const result = await collectByScrolling({
      read: page.read,
      scroll: page.port,
      maxMs: 25_000,
      now: () => clock,
    });
    expect(result.reason).toBe('timeout');
    expect(clock).toBe(30_000);
  });

  it('stops when aborted, without waiting for the DOM to settle', async () => {
    const page = fakePage(Array.from({ length: 30 }, (_, i) => post(String(i + 1))));
    vi.mocked(page.port.settle).mockImplementation(() => new Promise(() => {})); // never settles
    const stop = new AbortController();
    const progress: number[] = [];
    const run = collectByScrolling({
      read: page.read,
      scroll: page.port,
      signal: stop.signal,
      onProgress: (n) => progress.push(n),
    });
    await vi.waitFor(() => expect(progress).toEqual([4]));
    stop.abort();
    const result = await run;
    expect(result.reason).toBe('aborted');
    expect(page.position()).toBe(0);
  });

  it('reports the number of thread posts after each step', async () => {
    const all = [...['1', '2', '3', '4', '5', '6', '7'].map((id) => post(id)), post('8', 'b')];
    const page = fakePage(all);
    const progress: number[] = [];
    await collectByScrolling({
      read: page.read,
      scroll: page.port,
      onProgress: (n) => progress.push(n),
    });
    expect(progress).toEqual([4, 7]);
  });

  it('returns at once when the main post is not rendered (buildThread reports it)', async () => {
    const page = fakePage([post('5'), post('6')]);
    const result = await collectByScrolling({ read: page.read, scroll: page.port });
    expect(result.reason).toBe('end');
    expect(page.port.scrollBy).not.toHaveBeenCalled();
  });

  it('restores the scroll position even when reading throws', async () => {
    const page = fakePage([post('1')], { startAt: 0 });
    let calls = 0;
    const read = () => {
      calls += 1;
      if (calls === 2) throw new Error('boom');
      return [post('1'), post('2')];
    };
    vi.mocked(page.port.scrollBy).mockImplementation(() => {});
    await expect(
      collectByScrolling({ read, scroll: { ...page.port, getY: () => 700 } }),
    ).rejects.toThrow('boom');
    expect(page.port.scrollTo).toHaveBeenCalledWith(700);
  });

  it('expands truncated thread posts while they are rendered, once each', async () => {
    const all = [
      post('1'),
      post('2', 'a', { truncated: true }),
      post('3'),
      post('4'),
      post('5', 'a', { truncated: true }),
      post('6'),
      post('7', 'b', { truncated: true }), // not in the thread: never expanded
    ];
    const page = fakePage(all);
    const expanded: string[][] = [];
    const expand = vi.fn(async (wanted: ReadonlySet<string>) => {
      expanded.push([...wanted]);
      for (const id of wanted) {
        const i = all.findIndex((e) => e.kind === 'tweet' && e.tweet.id === id);
        all[i] = post(id, 'a', { text: `full ${id}` });
      }
      return wanted.size;
    });
    const result = await collectByScrolling({ read: page.read, scroll: page.port, expand });
    expect(expanded).toEqual([['2'], ['5']]);
    const texts = result.entries.flatMap((e) => (e.kind === 'tweet' ? [e.tweet.text] : []));
    expect(texts).toContain('full 2');
    expect(texts).toContain('full 5');
  });

  it('does not wait again for a post that stayed truncated', async () => {
    const all = [post('1'), post('2', 'a', { truncated: true }), post('3'), post('4'), post('5')];
    const page = fakePage(all, { viewport: 4, step: 1 });
    const expand = vi.fn(async () => 1); // claims to try, but nothing changes
    await collectByScrolling({ read: page.read, scroll: page.port, expand, maxIdleSteps: 2 });
    expect(expand).toHaveBeenCalledOnce();
  });
});

describe('MergedTimeline', () => {
  it('appends readings that overlap, without duplicates', () => {
    const t = new MergedTimeline();
    expect(t.merge([post('1'), post('2'), post('3')])).toBe(3);
    expect(t.merge([post('2'), post('3'), post('4'), post('5')])).toBe(2);
    expect(t.merge([post('5')])).toBe(0);
    expect(ids(t.entries)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('inserts a new post after the known post before it (re-rendered above)', () => {
    const t = new MergedTimeline();
    t.merge([post('1'), post('3')]);
    t.merge([post('1'), post('2'), post('3')]);
    expect(ids(t.entries)).toEqual(['1', '2', '3']);
  });

  it('appends a reading with no known post at the end (the page only scrolls down)', () => {
    const t = new MergedTimeline();
    t.merge([post('1'), post('2')]);
    t.merge([post('7'), post('8')]);
    expect(ids(t.entries)).toEqual(['1', '2', '7', '8']);
  });

  it('puts new posts read above a known one right before it', () => {
    const t = new MergedTimeline();
    t.merge([post('1'), post('4')]);
    t.merge([post('2'), post('3'), post('4'), post('5')]);
    expect(ids(t.entries)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('keeps posts read below a known heading below it', () => {
    const t = new MergedTimeline();
    t.merge([post('1'), post('2'), BREAK]);
    t.merge([post('2'), BREAK, post('9')]);
    expect(ids(t.entries)).toEqual(['1', '2', '|', '9']);
    expect(selectThread(t.entries)?.tweets.map((x) => x.id)).toEqual(['1', '2']);
  });

  it('keeps one heading when it is read again', () => {
    const t = new MergedTimeline();
    t.merge([post('1'), BREAK, post('9')]);
    t.merge([post('1'), BREAK, post('9'), post('10')]);
    t.merge([BREAK, post('10')]);
    expect(ids(t.entries)).toEqual(['1', '|', '9', '10']);
  });

  it('replaces a truncated post with its expanded version, not the other way round', () => {
    const t = new MergedTimeline();
    t.merge([post('1', 'a', { truncated: true, text: 'short' })]);
    t.merge([post('1', 'a', { text: 'full' })]);
    t.merge([post('1', 'a', { truncated: true, text: 'short again' })]);
    expect(t.entries[0]).toMatchObject({ tweet: { text: 'full', truncated: false } });
  });
});

describe('waitForSettle', () => {
  it('resolves once the DOM has been quiet for a while', async () => {
    const target = document.createElement('div');
    const started = Date.now();
    const done = waitForSettle(target, 30, 1000);
    setTimeout(() => target.append('a'), 10);
    setTimeout(() => target.append('b'), 25);
    await done;
    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('gives up at the timeout when the DOM keeps changing', async () => {
    const target = document.createElement('div');
    const timer = setInterval(() => target.append('x'), 5);
    const started = Date.now();
    await waitForSettle(target, 30, 120);
    clearInterval(timer);
    expect(Date.now() - started).toBeLessThan(400);
  });
});

describe('extractAndCopy with auto-scroll', () => {
  const copied = async (): Promise<CopyResult> => ({
    ok: true,
    method: 'clipboard-api',
  });

  function scrollingEnv(maxPosts = 3) {
    // Six posts by the author: more than the post limit.
    const doc = timeline(['1', '2', '3', '4', '5', '6'].map((id) => ({ handle: 'a', id })));
    const port: ScrollPort = {
      getY: () => 0,
      scrollBy: vi.fn(),
      scrollTo: vi.fn(),
      stepHeight: () => 100,
      settle: async () => {},
    };
    return { doc, port, limits: { maxPosts } };
  }

  it('is not used while the setting is off', async () => {
    const { doc, port } = scrollingEnv();
    const response = await extractAndCopy({
      root: doc,
      url: 'https://x.com/a/status/1',
      copy: copied,
      autoScroll: { port },
    });
    expect(response).toMatchObject({ ok: true, count: 6 });
    expect(port.scrollBy).not.toHaveBeenCalled();
  });

  it('cuts the thread at the post limit and says so', async () => {
    const { doc, port, limits } = scrollingEnv(3);
    const copy = vi.fn<(text: string) => Promise<CopyResult>>(copied);
    const response = await extractAndCopy({
      root: doc,
      url: 'https://x.com/a/status/1',
      copy,
      settings: { autoScroll: true },
      autoScroll: { port, limits },
    });
    expect(response).toEqual({
      ok: true,
      count: 3,
      truncated: 0,
      warnings: ['Auto-scroll stopped at 3 posts; the thread may continue.'],
      stopped: 'limit',
    });
    expect(copy.mock.calls[0]?.[0]).toContain(
      '> ⚠️ Warning: Auto-scroll stopped at 3 posts; the thread may continue.',
    );
    expect(port.scrollTo).toHaveBeenCalledWith(0);
  });

  it('copies what was collected when stopped by the user', async () => {
    const { doc, port } = scrollingEnv();
    const stop = new AbortController();
    stop.abort();
    const response = await extractAndCopy({
      root: doc,
      url: 'https://x.com/a/status/1',
      copy: copied,
      settings: { autoScroll: true },
      autoScroll: { port, signal: stop.signal, limits: { maxPosts: 100, maxIdleSteps: 5 } },
    });
    expect(response).toMatchObject({ ok: true, count: 6, stopped: 'aborted' });
  });

  it('reports no stop when the thread ended naturally', async () => {
    const doc = timeline([
      { handle: 'a', id: '1' },
      { handle: 'b', id: '2' },
    ]);
    const response = await extractAndCopy({
      root: doc,
      url: 'https://x.com/a/status/1',
      copy: copied,
      settings: { autoScroll: true },
      autoScroll: { port: scrollingEnv().port },
    });
    expect(response).toEqual({ ok: true, count: 1, truncated: 0, warnings: [] });
  });
});
