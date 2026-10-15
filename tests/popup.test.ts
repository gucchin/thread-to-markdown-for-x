import { describe, expect, it, vi } from 'vitest';
import {
  initPopup,
  isMissingReceiver,
  pageState,
  TEXT,
  type PopupApi,
} from '../src/popup/popupController';
import type { ExtractAndCopyResponse } from '../src/shared/messages';
import { SETTINGS_KEY } from '../src/shared/settings';
import { memoryStorage } from './helpers/storage';
import popupHtml from '../src/popup/popup.html?raw';

const POST = 'https://x.com/a/status/1';

// The tab is passed as a whole: a bare `url = POST` default would also replace an explicit
// `undefined` (the url Chrome reports for non-X tabs).
function setup(
  overrides: Partial<PopupApi> = {},
  tab: { id?: number; url?: string } = { id: 7, url: POST },
) {
  const doc = new DOMParser().parseFromString(popupHtml, 'text/html');
  const { storage, data } = memoryStorage();
  const api: PopupApi = {
    queryActiveTab: vi.fn(async () => tab),
    sendMessage: vi.fn(async (): Promise<ExtractAndCopyResponse> => ({
      ok: true,
      count: 3,
      truncated: 0,
      warnings: [],
    })),
    writeClipboard: vi.fn(async () => {}),
    storage,
    openOptions: vi.fn(),
    ...overrides,
  };
  const ui = {
    button: doc.getElementById('copy') as HTMLButtonElement,
    status: doc.getElementById('status')!,
    manual: doc.getElementById('manual') as HTMLTextAreaElement,
  };
  const mode = (value: string) =>
    doc.querySelector<HTMLInputElement>(`input[name="mode"][value="${value}"]`)!;
  return { doc, api, ui, data, mode, ready: initPopup(doc, api) };
}

/** Clicks the button and waits until the popup is idle again. */
async function click(ui: ReturnType<typeof setup>['ui']) {
  ui.button.click();
  await vi.waitFor(() => expect(ui.button.disabled).toBe(false));
}

describe('pageState', () => {
  it.each([
    'https://x.com/a/status/1',
    'https://twitter.com/a/status/1/photo/1',
    'https://x.com/a/status/1?s=20',
  ])('enables on %s', (url) => {
    expect(pageState(url)).toEqual({ enabled: true });
  });

  it.each([undefined, 'https://example.com/a/status/1', 'chrome://newtab/', 'not a url'])(
    'explains that X is needed for %s',
    (url) => {
      expect(pageState(url)).toEqual({ enabled: false, reason: TEXT.notX });
    },
  );

  it.each(['https://x.com/home', 'https://x.com/a', 'https://x.com/search?q=status'])(
    'asks for a single post on %s',
    (url) => {
      expect(pageState(url)).toEqual({ enabled: false, reason: TEXT.notStatus });
    },
  );
});

describe('isMissingReceiver', () => {
  it('recognizes Chrome’s “no content script” error', () => {
    expect(
      isMissingReceiver(new Error('Could not establish connection. Receiving end does not exist.')),
    ).toBe(true);
    expect(isMissingReceiver(new Error('Something else'))).toBe(false);
  });
});

describe('initPopup', () => {
  it('enables the button on a post page', async () => {
    const { ui, ready } = setup();
    await ready;
    expect(ui.button.disabled).toBe(false);
    expect(ui.status.textContent).toBe('');
    expect(ui.manual.hidden).toBe(true);
  });

  it.each([
    ['https://x.com/home', TEXT.notStatus],
    [undefined, TEXT.notX], // non-X tabs have no visible url without the tabs permission
  ])('disables the button on %s with a reason', async (url, reason) => {
    const { ui, api, ready } = setup({}, { id: 7, url });
    await ready;
    expect(ui.button.disabled).toBe(true);
    expect(ui.status.textContent).toBe(reason);
    ui.button.click();
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('disables the button when the tab cannot be queried', async () => {
    const { ui, ready } = setup({
      queryActiveTab: vi.fn(async () => Promise.reject(new Error('x'))),
    });
    await ready;
    expect(ui.button.disabled).toBe(true);
  });

  it('sends EXTRACT_AND_COPY from the popup and shows the result', async () => {
    const { ui, api, ready } = setup();
    await ready;
    await click(ui);
    expect(api.sendMessage).toHaveBeenCalledWith(7, { type: 'EXTRACT_AND_COPY', source: 'popup' });
    expect(ui.status.textContent).toBe('✅ 3 posts copied as Markdown');
    expect(ui.status.dataset.kind).toBe('success');
  });

  it('shows the truncation warning', async () => {
    const { ui, ready } = setup({
      sendMessage: vi.fn(async () => ({ ok: true, count: 2, truncated: 1, warnings: ['w'] })),
    } as Partial<PopupApi>);
    await ready;
    await click(ui);
    expect(ui.status.textContent).toBe('⚠️ 2 posts copied (1 truncated)');
    expect(ui.status.dataset.kind).toBe('warning');
  });

  it('shows extraction errors from the content script', async () => {
    const { ui, ready } = setup({
      sendMessage: vi.fn(async () => ({ ok: false, code: 'MAIN_NOT_FOUND', message: 'x' })),
    } as Partial<PopupApi>);
    await ready;
    await click(ui);
    expect(ui.status.dataset.kind).toBe('error');
    expect(ui.status.textContent).toContain('not loaded yet');
  });

  it('asks to reload when the content script is not injected', async () => {
    const { ui, ready } = setup({
      sendMessage: vi.fn(async () =>
        Promise.reject(new Error('Could not establish connection. Receiving end does not exist.')),
      ),
    });
    await ready;
    await click(ui);
    expect(ui.status.textContent).toBe(TEXT.reload);
  });

  it('reports other messaging errors', async () => {
    const { ui, ready } = setup({
      sendMessage: vi.fn(async () => Promise.reject(new Error('The message port closed'))),
    });
    await ready;
    await click(ui);
    expect(ui.status.textContent).toBe('Something went wrong. The message port closed');
  });

  describe('when the page could not copy', () => {
    const copyFailed = {
      sendMessage: vi.fn(async () => ({
        ok: false,
        code: 'COPY_FAILED',
        message: 'denied',
        markdown: '# X Thread',
      })),
    } as Partial<PopupApi>;

    it('copies from the popup instead', async () => {
      const { ui, api, ready } = setup(copyFailed);
      await ready;
      await click(ui);
      expect(api.writeClipboard).toHaveBeenCalledWith('# X Thread');
      expect(ui.status.textContent).toBe(TEXT.copiedByPopup);
      expect(ui.manual.hidden).toBe(true);
    });

    it('falls back to manual copy when the popup cannot copy either', async () => {
      const { ui, ready } = setup({
        ...copyFailed,
        writeClipboard: vi.fn(async () => Promise.reject(new Error('denied'))),
      });
      await ready;
      await click(ui);
      expect(ui.status.textContent).toBe(TEXT.manualCopy);
      expect(ui.manual.hidden).toBe(false);
      expect(ui.manual.value).toBe('# X Thread');
    });
  });

  it('disables the button while copying', async () => {
    let finish: ((r: ExtractAndCopyResponse) => void) | undefined;
    const { ui, ready } = setup({
      sendMessage: vi.fn(() => new Promise<ExtractAndCopyResponse>((r) => (finish = r))),
    });
    await ready;
    ui.button.click();
    expect(ui.button.disabled).toBe(true);
    expect(ui.status.textContent).toBe(TEXT.copying);
    await vi.waitFor(() => expect(finish).toBeDefined());
    expect(ui.button.disabled).toBe(true);
    finish!({ ok: true, count: 1, truncated: 0, warnings: [] });
    await vi.waitFor(() => expect(ui.button.disabled).toBe(false));
    expect(ui.status.textContent).toBe('✅ 1 post copied as Markdown');
  });

  describe('mode toggle', () => {
    it('shows the stored mode (author by default)', async () => {
      const { mode, ready } = setup();
      await ready;
      expect(mode('author').checked).toBe(true);
      expect(mode('all').checked).toBe(false);
    });

    it('shows a mode stored earlier', async () => {
      const { storage } = memoryStorage({ [SETTINGS_KEY]: { mode: 'all' } });
      const { mode, ready } = setup({ storage });
      await ready;
      expect(mode('all').checked).toBe(true);
    });

    it('saves the mode as a setting, also on pages where copying is disabled', async () => {
      const { mode, data, ready } = setup({}, { id: 7, url: 'https://x.com/home' });
      await ready;
      mode('all').checked = true;
      mode('all').dispatchEvent(new Event('change'));
      await vi.waitFor(() => expect(data[SETTINGS_KEY]).toMatchObject({ mode: 'all' }));
    });

    it('copies only after a mode change is stored', async () => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const { storage, data } = memoryStorage();
      const slowSet = storage.set;
      storage.set = async (items) => {
        await gate;
        await slowSet(items);
      };
      const order: string[] = [];
      const { ui, mode, ready } = setup({
        storage,
        sendMessage: vi.fn(async (): Promise<ExtractAndCopyResponse> => {
          order.push(`send (stored mode: ${(data[SETTINGS_KEY] as { mode?: string })?.mode})`);
          return { ok: true, count: 1, truncated: 0, warnings: [] };
        }),
      });
      await ready;
      mode('all').checked = true;
      mode('all').dispatchEvent(new Event('change'));
      ui.button.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(order).toEqual([]); // still waiting for the save
      release();
      await vi.waitFor(() => expect(order).toEqual(['send (stored mode: all)']));
    });
  });

  it('saves the auto-scroll checkbox as a setting', async () => {
    const { doc, data, ready } = setup();
    await ready;
    const box = doc.querySelector<HTMLInputElement>('input[name="autoScroll"]')!;
    expect(box.checked).toBe(false);
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(data[SETTINGS_KEY]).toMatchObject({ autoScroll: true }));
  });

  it('opens the options page from the link', async () => {
    const { doc, api, ready } = setup();
    await ready;
    doc.getElementById('options')!.click();
    expect(api.openOptions).toHaveBeenCalledOnce();
  });

  it('throws if popup.html lacks the expected elements', async () => {
    const doc = new DOMParser().parseFromString('<body></body>', 'text/html');
    await expect(initPopup(doc, setup().api)).rejects.toThrow('#copy');
  });
});
