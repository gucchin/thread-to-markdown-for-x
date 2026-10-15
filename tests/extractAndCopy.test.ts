import { describe, expect, it, vi } from 'vitest';
import type { CopyResult } from '../src/content/clipboard';
import { createController, createMessageListener } from '../src/content/controller';
import { extractAndCopy } from '../src/content/extractAndCopy';
import { EXTRACT_AND_COPY, isExtractAndCopyRequest } from '../src/shared/messages';
import type { ExtractAndCopyResponse } from '../src/shared/messages';
import { loadFixture, timeline } from './helpers/dom';
import threadHtml from './fixtures/thread.html?raw';

const copied = (): CopyResult => ({ ok: true, method: 'clipboard-api' });
const now = () => new Date('2026-10-15T00:00:00.000Z');

describe('extractAndCopy', () => {
  it('copies the thread as Markdown and reports the count', async () => {
    const { document, url } = loadFixture(threadHtml);
    const copy = vi.fn<(text: string) => Promise<CopyResult>>(async () => copied());
    const response = await extractAndCopy({ root: document, url, copy, now, timeZone: 'UTC' });
    expect(response).toEqual({ ok: true, count: 4, truncated: 0, warnings: [] });
    expect(copy).toHaveBeenCalledOnce();
    const markdown = copy.mock.calls[0]?.[0] ?? '';
    // Main post: 2026-10-13T02:54:00Z.
    expect(markdown).toMatch(/^# X Thread by @user1 \(2026-10-13\)\n/);
    expect(markdown.match(/^### Tweet/gm)).toHaveLength(4);
  });

  it('reports truncated posts and their warnings', async () => {
    const doc = timeline([
      { handle: 'a', id: '1', truncated: true },
      { handle: 'a', id: '2', quote: 'q', quoteTruncated: true },
    ]);
    const response = await extractAndCopy({
      root: doc,
      url: 'https://x.com/a/status/1',
      copy: async () => copied(),
    });
    expect(response).toMatchObject({ ok: true, count: 2, truncated: 2 });
    expect(response.ok && response.warnings).toHaveLength(2);
  });

  it('applies the settings: mode, frontmatter and meta format', async () => {
    const doc = timeline([
      { handle: 'a', id: '1' },
      { handle: 'b', id: '2' },
    ]);
    const copy = vi.fn<(text: string) => Promise<CopyResult>>(async () => copied());
    const response = await extractAndCopy({
      root: doc,
      url: 'https://x.com/a/status/1',
      copy,
      settings: { mode: 'all', frontmatter: true, metaFormat: 'line' },
    });
    expect(response).toMatchObject({ ok: true, count: 2 });
    const markdown = copy.mock.calls[0]?.[0] ?? '';
    expect(markdown).toMatch(/^---\ntitle: "X Thread by @a"\n/);
    expect(markdown).toContain('### Tweet 2 — @b\n');
    expect(markdown).not.toContain('<!--');
  });

  it('uses the defaults for missing settings (author only)', async () => {
    const doc = timeline([
      { handle: 'a', id: '1' },
      { handle: 'b', id: '2' },
    ]);
    const copy = vi.fn<(text: string) => Promise<CopyResult>>(async () => copied());
    const response = await extractAndCopy({
      root: doc,
      url: 'https://x.com/a/status/1',
      copy,
      settings: { frontmatter: true },
    });
    expect(response).toMatchObject({ ok: true, count: 1 });
    expect(copy.mock.calls[0]?.[0]).toContain('### Tweet 1 (Main)\n<!-- ');
  });

  it('returns the extraction error without copying', async () => {
    const copy = vi.fn(async () => copied());
    const response = await extractAndCopy({ root: timeline([]), url: 'https://x.com/home', copy });
    expect(response).toMatchObject({ ok: false, code: 'NOT_STATUS_PAGE' });
    expect(copy).not.toHaveBeenCalled();
  });

  it('returns COPY_FAILED with the Markdown so the caller can retry or offer manual copy', async () => {
    const doc = timeline([{ handle: 'a', id: '1' }]);
    const response = await extractAndCopy({
      root: doc,
      url: 'https://x.com/a/status/1',
      copy: async () => ({ ok: false, error: 'denied' }),
    });
    expect(response).toMatchObject({
      ok: false,
      code: 'COPY_FAILED',
      message: expect.stringContaining('denied'),
      markdown: expect.stringContaining('# X Thread by @a'),
    });
  });

  it('turns unexpected exceptions into UNKNOWN', async () => {
    const root = {
      querySelectorAll: () => {
        throw new Error('DOM exploded');
      },
    } as unknown as ParentNode;
    const response = await extractAndCopy({
      root,
      url: 'https://x.com/a/status/1',
      copy: async () => copied(),
    });
    expect(response).toEqual({
      ok: false,
      code: 'UNKNOWN',
      message: 'Unexpected error: DOM exploded',
    });
  });
});

describe('createController', () => {
  it('shares one run between concurrent triggers and reports it once', async () => {
    let resolve!: (r: ExtractAndCopyResponse) => void;
    const task = vi.fn(() => new Promise<ExtractAndCopyResponse>((r) => (resolve = r)));
    const onResult = vi.fn();
    const { run } = createController(task, onResult);

    const first = run('button');
    const second = run('popup');
    expect(task).toHaveBeenCalledOnce();
    resolve({ ok: true, count: 1, truncated: 0, warnings: [] });
    await expect(first).resolves.toMatchObject({ ok: true });
    await expect(second).resolves.toMatchObject({ ok: true });
    // Reported once, with the source of the trigger that started the run.
    expect(onResult).toHaveBeenCalledOnce();
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ ok: true }), 'button');
  });

  it('starts a new run after the previous one finished', async () => {
    const task = vi.fn(async (): Promise<ExtractAndCopyResponse> => ({
      ok: true,
      count: 1,
      truncated: 0,
      warnings: [],
    }));
    const { run } = createController(task);
    await run('button');
    await run('button');
    expect(task).toHaveBeenCalledTimes(2);
  });
});

describe('createMessageListener', () => {
  const response: ExtractAndCopyResponse = { ok: true, count: 3, truncated: 0, warnings: [] };

  it('answers EXTRACT_AND_COPY asynchronously, passing the source on', async () => {
    const run = vi.fn(async () => response);
    const listener = createMessageListener(isExtractAndCopyRequest, run);
    const sendResponse = vi.fn();
    expect(listener({ type: EXTRACT_AND_COPY, source: 'shortcut' }, {}, sendResponse)).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(response));
    expect(run).toHaveBeenCalledWith('shortcut');
  });

  it('treats a request without a source as coming from the popup', () => {
    const run = vi.fn(async () => response);
    createMessageListener(isExtractAndCopyRequest, run)({ type: EXTRACT_AND_COPY }, {}, vi.fn());
    expect(run).toHaveBeenCalledWith('popup');
  });

  it('ignores other messages and does not keep the channel open', () => {
    const run = vi.fn(async () => response);
    const listener = createMessageListener(isExtractAndCopyRequest, run);
    expect(listener({ type: 'OTHER' }, {}, vi.fn())).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
});
