import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BUTTON_HOST_ATTR,
  findMainActionBar,
  startPageButton,
  syncButton,
  type PageButtonEnv,
} from '../src/content/ui/button';
import { SELECTORS } from '../src/content/extract/selectors';
import { loadFixture, timeline } from './helpers/dom';
import quoteHtml from './fixtures/quote.html?raw';
import threadHtml from './fixtures/thread.html?raw';

const hosts = (doc: Document) => [...doc.querySelectorAll(`[${BUTTON_HOST_ATTR}]`)];
const buttonOf = (host: Element) => host.shadowRoot!.querySelector('button')!;

function env(doc: Document, url: string, onClick = vi.fn(async () => {})) {
  const state = { url };
  const e: PageButtonEnv & { state: typeof state } = {
    doc,
    getUrl: () => state.url,
    onClick,
    state,
  };
  return e;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('findMainActionBar', () => {
  it('finds the action bar of the main post, not of a quote or reply', () => {
    const { document, mainId } = loadFixture(threadHtml);
    const bar = findMainActionBar(document, mainId);
    expect(bar?.matches(SELECTORS.actionBar)).toBe(true);
    expect(bar?.closest(SELECTORS.tweet)).toBe(document.querySelectorAll(SELECTORS.tweet)[0]);
  });

  it('returns null when the post is not rendered', () => {
    const { document } = loadFixture(threadHtml);
    expect(findMainActionBar(document, '999')).toBeNull();
  });
});

describe('syncButton', () => {
  it('injects one button right after the main post’s action bar', () => {
    const { document, url, mainId } = loadFixture(threadHtml);
    syncButton(env(document, url));
    const [host, ...rest] = hosts(document);
    expect(rest).toHaveLength(0);
    expect(host?.previousElementSibling).toBe(findMainActionBar(document, mainId));
    expect(host?.getAttribute(BUTTON_HOST_ATTR)).toBe('1');
    expect(buttonOf(host!).textContent).toBe('Copy as Markdown');
  });

  it('is idempotent', () => {
    const { document, url } = loadFixture(threadHtml);
    const e = env(document, url);
    syncButton(e);
    const first = hosts(document)[0];
    syncButton(e);
    syncButton(e);
    expect(hosts(document)).toEqual([first]);
  });

  it('works when the main post quotes another post', () => {
    const { document, url } = loadFixture(quoteHtml);
    syncButton(env(document, url));
    expect(hosts(document)).toHaveLength(1);
  });

  it('moves the button when the URL switches to another rendered post (SPA navigation)', () => {
    const doc = timeline([
      { handle: 'a', id: '1' },
      { handle: 'a', id: '2' },
    ]);
    const e = env(doc, 'https://x.com/a/status/1');
    syncButton(e);
    e.state.url = 'https://x.com/a/status/2';
    syncButton(e);
    const [host, ...rest] = hosts(doc);
    expect(rest).toHaveLength(0);
    expect(host?.closest(SELECTORS.tweet)).toBe(doc.querySelectorAll(SELECTORS.tweet)[1]);
  });

  it.each(['https://x.com/home', 'https://x.com/a', 'https://x.com/a/status/999'])(
    'removes the button on %s',
    (url) => {
      const doc = timeline([{ handle: 'a', id: '1' }]);
      const e = env(doc, 'https://x.com/a/status/1');
      syncButton(e);
      expect(hosts(doc)).toHaveLength(1);
      e.state.url = url;
      syncButton(e);
      expect(hosts(doc)).toHaveLength(0);
    },
  );

  it('removes duplicates and misplaced buttons', () => {
    const doc = timeline([{ handle: 'a', id: '1' }]);
    const stray = doc.createElement('div');
    stray.setAttribute(BUTTON_HOST_ATTR, '1');
    doc.body.append(stray);
    syncButton(env(doc, 'https://x.com/a/status/1'));
    expect(hosts(doc)).toHaveLength(1);
    expect(hosts(doc)[0]).not.toBe(stray);
  });
});

describe('button click', () => {
  it('calls onClick and keeps the click from reaching the post', async () => {
    const doc = timeline([{ handle: 'a', id: '1' }]);
    const onClick = vi.fn(async () => {});
    syncButton(env(doc, 'https://x.com/a/status/1', onClick));
    const articleClick = vi.fn();
    doc.querySelector(SELECTORS.tweet)!.addEventListener('click', articleClick);

    buttonOf(hosts(doc)[0]!).click();
    expect(onClick).toHaveBeenCalledOnce();
    expect(articleClick).not.toHaveBeenCalled();
  });

  it('is disabled while the copy runs, ignoring repeated clicks', async () => {
    const doc = timeline([{ handle: 'a', id: '1' }]);
    let finish!: () => void;
    const onClick = vi.fn(() => new Promise<void>((r) => (finish = r)));
    syncButton(env(doc, 'https://x.com/a/status/1', onClick));
    const button = buttonOf(hosts(doc)[0]!);

    button.click();
    expect(button.disabled).toBe(true);
    button.click();
    expect(onClick).toHaveBeenCalledOnce();
    finish();
    await vi.waitFor(() => expect(button.disabled).toBe(false));
  });
});

describe('startPageButton', () => {
  it('syncs immediately and stops cleanly', () => {
    const doc = timeline([{ handle: 'a', id: '1' }]);
    const stop = startPageButton(env(doc, 'https://x.com/a/status/1'));
    expect(hosts(doc)).toHaveLength(1);
    stop();
    expect(hosts(doc)).toHaveLength(0);
  });

  it('re-syncs after DOM changes in <main>, debounced', async () => {
    vi.useFakeTimers();
    const doc = timeline([]);
    const e = env(doc, 'https://x.com/a/status/1');
    const stop = startPageButton(e);
    expect(hosts(doc)).toHaveLength(0);

    // X renders the post later, in several mutations.
    const main = doc.querySelector('main')!;
    const fresh = timeline([{ handle: 'a', id: '1' }]).querySelector('main')!;
    for (const cell of [...fresh.children]) main.append(doc.importNode(cell, true));
    main.append(doc.createElement('div'));
    await Promise.resolve(); // MutationObserver callbacks are microtasks
    expect(hosts(doc)).toHaveLength(0); // still debouncing
    vi.advanceTimersByTime(150);
    expect(hosts(doc)).toHaveLength(1);

    // Navigating away (URL change noticed on the next mutation) removes it.
    e.state.url = 'https://x.com/home';
    main.append(doc.createElement('div'));
    await Promise.resolve();
    vi.advanceTimersByTime(150);
    expect(hosts(doc)).toHaveLength(0);
    stop();
  });

  it('waits for <main> to appear', async () => {
    vi.useFakeTimers();
    const doc = new DOMParser().parseFromString('<body><div id="root"></div></body>', 'text/html');
    const stop = startPageButton(env(doc, 'https://x.com/a/status/1'));
    const later = timeline([{ handle: 'a', id: '1' }]).querySelector('main')!;
    doc.getElementById('root')!.append(doc.importNode(later, true));
    await Promise.resolve();
    vi.advanceTimersByTime(150);
    expect(hosts(doc)).toHaveLength(1);
    stop();
  });

  it('follows a replaced <main>', async () => {
    vi.useFakeTimers();
    const doc = timeline([{ handle: 'a', id: '1' }]);
    const e = env(doc, 'https://x.com/a/status/1');
    const stop = startPageButton(e);
    // Let the mutation caused by the initial insertion settle, so that only the replacement
    // itself can trigger the next sync.
    await Promise.resolve();
    vi.advanceTimersByTime(150);
    await Promise.resolve();
    const replacement = timeline([{ handle: 'a', id: '2' }]).querySelector('main')!;
    doc.querySelector('main')!.replaceWith(doc.importNode(replacement, true));
    e.state.url = 'https://x.com/a/status/2';
    await Promise.resolve();
    vi.advanceTimersByTime(150);
    expect(hosts(doc)).toHaveLength(1);

    // Mutations inside the new <main> are observed too.
    e.state.url = 'https://x.com/home';
    doc.querySelector('main')!.append(doc.createElement('div'));
    await Promise.resolve();
    vi.advanceTimersByTime(150);
    expect(hosts(doc)).toHaveLength(0);
    stop();
  });

  it('does not loop on its own insertion', async () => {
    vi.useFakeTimers();
    const doc = timeline([{ handle: 'a', id: '1' }]);
    const e = env(doc, 'https://x.com/a/status/1');
    const getUrl = vi.spyOn(e, 'getUrl');
    const stop = startPageButton(e);
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      vi.advanceTimersByTime(150);
    }
    // One initial sync, plus at most one triggered by the insertion itself.
    expect(getUrl.mock.calls.length).toBeLessThanOrEqual(2);
    stop();
  });
});
