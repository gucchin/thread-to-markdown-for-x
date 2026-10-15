import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  showProgressToast,
  showResultToast,
  showToast,
  TOAST_HOST_ATTR,
} from '../src/content/ui/toast';
import { describeResponse } from '../src/shared/labels';

const hosts = () => document.querySelectorAll(`[${TOAST_HOST_ATTR}]`);
const shadowOf = (host: Element) => host.shadowRoot!;

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('showToast', () => {
  it('renders the message in an open shadow root with status semantics', () => {
    const host = showToast({ kind: 'success', message: '✅ 3 posts copied as Markdown' });
    const box = shadowOf(host).querySelector('.toast')!;
    expect(box.textContent).toContain('✅ 3 posts copied as Markdown');
    expect(box.getAttribute('role')).toBe('status');
    expect(box.getAttribute('aria-live')).toBe('polite');
    expect(box.classList.contains('success')).toBe(true);
    // The toast lives in its own shadow tree: nothing leaks into the page DOM.
    expect(host.children).toHaveLength(0);
  });

  it('includes its styles inside the shadow root', () => {
    const host = showToast({ kind: 'success', message: 'x' });
    const root = shadowOf(host);
    const hasStyle =
      root.querySelector('style') !== null || (root.adoptedStyleSheets?.length ?? 0) > 0;
    expect(hasStyle).toBe(true);
  });

  it('treats the message as text, not HTML', () => {
    const host = showToast({ kind: 'error', message: '<img src=x onerror=alert(1)>' });
    expect(shadowOf(host).querySelector('img')).toBeNull();
    expect(shadowOf(host).querySelector('p')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('replaces the previous toast', () => {
    showToast({ kind: 'success', message: 'first' });
    showToast({ kind: 'success', message: 'second' });
    expect(hosts()).toHaveLength(1);
    expect(shadowOf(hosts()[0]!).textContent).toContain('second');
  });

  it('disappears after 3 seconds', () => {
    vi.useFakeTimers();
    showToast({ kind: 'success', message: 'x' });
    vi.advanceTimersByTime(2999);
    expect(hosts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(hosts()).toHaveLength(0);
  });

  it('keeps errors a little longer (6 seconds)', () => {
    vi.useFakeTimers();
    showToast({ kind: 'error', message: 'x' });
    vi.advanceTimersByTime(3000);
    expect(hosts()).toHaveLength(1);
    vi.advanceTimersByTime(3000);
    expect(hosts()).toHaveLength(0);
  });

  it('offers the Markdown for manual copy and stays until closed', () => {
    vi.useFakeTimers();
    const host = showToast({ kind: 'error', message: 'failed', markdown: '# X Thread <b>' });
    const area = shadowOf(host).querySelector('textarea')!;
    expect(area.value).toBe('# X Thread <b>');
    expect(area.readOnly).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(hosts()).toHaveLength(1);

    shadowOf(host).querySelector<HTMLButtonElement>('button.close')!.click();
    expect(hosts()).toHaveLength(0);
  });

  it('selects the Markdown when the textarea gets focus', () => {
    const host = showToast({ kind: 'error', message: 'failed', markdown: 'abc' });
    const area = shadowOf(host).querySelector('textarea')!;
    area.dispatchEvent(new Event('focus'));
    expect(area.selectionStart).toBe(0);
    expect(area.selectionEnd).toBe(3);
  });

  it('a stale timer does not remove a newer toast', () => {
    vi.useFakeTimers();
    showToast({ kind: 'success', message: 'old' });
    vi.advanceTimersByTime(2000);
    showToast({ kind: 'error', message: 'new', markdown: 'md' });
    vi.advanceTimersByTime(5000);
    expect(hosts()).toHaveLength(1);
    expect(shadowOf(hosts()[0]!).textContent).toContain('new');
  });
});

describe('describeResponse', () => {
  it.each([
    [1, 0, 'success', '✅ 1 post copied as Markdown'],
    [5, 0, 'success', '✅ 5 posts copied as Markdown'],
    [5, 1, 'warning', '⚠️ 5 posts copied (1 truncated)'],
  ] as const)('%i posts, %i truncated -> %s', (count, truncated, kind, text) => {
    expect(describeResponse({ ok: true, count, truncated, warnings: [] })).toEqual({ kind, text });
  });

  it.each([
    ['limit', 0, '⚠️ 100 posts copied (post limit reached)'],
    ['timeout', 0, '⚠️ 100 posts copied (time limit reached)'],
    ['aborted', 2, '⚠️ 100 posts copied (2 truncated; stopped)'],
  ] as const)('auto-scroll stopped by %s is a warning', (stopped, truncated, text) => {
    expect(describeResponse({ ok: true, count: 100, truncated, warnings: [], stopped })).toEqual({
      kind: 'warning',
      text,
    });
  });

  it.each(['NOT_STATUS_PAGE', 'MAIN_NOT_FOUND', 'NO_TWEETS', 'COPY_FAILED'] as const)(
    '%s has its own text',
    (code) => {
      const { kind, text } = describeResponse({ ok: false, code, message: 'internal detail' });
      expect(kind).toBe('error');
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toContain('internal detail');
    },
  );

  it('UNKNOWN includes the error detail', () => {
    expect(
      describeResponse({ ok: false, code: 'UNKNOWN', message: 'Unexpected error: boom' }).text,
    ).toContain('Unexpected error: boom');
  });
});

describe('showProgressToast', () => {
  it('shows the progress until replaced, and updates it', () => {
    vi.useFakeTimers();
    const toast = showProgressToast('Collecting posts… 4', () => {});
    const box = shadowOf(toast.host).querySelector('.toast')!;
    expect(box.classList.contains('progress')).toBe(true);
    toast.update('Collecting posts… 9');
    expect(box.querySelector('p')?.textContent).toBe('Collecting posts… 9');
    vi.advanceTimersByTime(60_000); // no auto-dismiss while collecting
    expect(hosts()).toHaveLength(1);

    showResultToast({ ok: true, count: 9, truncated: 0, warnings: [] }, 'button');
    expect(hosts()).toHaveLength(1);
    expect(toast.host.isConnected).toBe(false);
  });

  it('calls onStop once from the Stop button and keeps the click from the page', () => {
    const onStop = vi.fn();
    const pageClick = vi.fn();
    document.body.addEventListener('click', pageClick);
    const toast = showProgressToast('Collecting posts… 4', onStop);
    const stop = shadowOf(toast.host).querySelector<HTMLButtonElement>('button.stop')!;
    expect(stop.textContent).toBe('Stop');
    stop.click();
    stop.click();
    expect(onStop).toHaveBeenCalledOnce();
    expect(stop.disabled).toBe(true);
    expect(pageClick).not.toHaveBeenCalled();
    document.body.removeEventListener('click', pageClick);
  });
});

describe('showResultToast', () => {
  it('shows a warning toast for truncated posts', () => {
    const host = showResultToast({ ok: true, count: 2, truncated: 1, warnings: ['w'] }, 'button')!;
    expect(shadowOf(host).querySelector('.toast.warning')).not.toBeNull();
  });

  it('shows manual copy when the copy failed (button / shortcut)', () => {
    const host = showResultToast(
      { ok: false, code: 'COPY_FAILED', message: 'denied', markdown: '# md' },
      'shortcut',
    )!;
    expect(shadowOf(host).querySelector('textarea')?.value).toBe('# md');
  });

  it('leaves a failed copy from the popup to the popup', () => {
    expect(
      showResultToast({ ok: false, code: 'COPY_FAILED', message: 'x', markdown: '# md' }, 'popup'),
    ).toBeNull();
    expect(hosts()).toHaveLength(0);
  });

  it('still shows other popup errors on the page', () => {
    expect(
      showResultToast({ ok: false, code: 'MAIN_NOT_FOUND', message: 'x' }, 'popup'),
    ).not.toBeNull();
  });
});
