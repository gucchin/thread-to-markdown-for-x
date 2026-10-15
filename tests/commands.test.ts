import { describe, expect, it, vi } from 'vitest';
import { COPY_THREAD_COMMAND, handleCommand, type CommandApi } from '../src/background/commands';
import { EXTRACT_AND_COPY } from '../src/shared/messages';
import manifest from '../src/manifest.json';

function api(overrides: Partial<CommandApi> = {}): CommandApi {
  return {
    queryActiveTab: vi.fn(async () => ({ id: 3, url: 'https://x.com/a/status/1' })),
    sendMessage: vi.fn(async () => ({ ok: true })),
    ...overrides,
  };
}

describe('handleCommand', () => {
  it('uses the command name declared in manifest.json', () => {
    expect(Object.keys(manifest.commands)).toEqual([COPY_THREAD_COMMAND]);
    expect(manifest.commands[COPY_THREAD_COMMAND].suggested_key.default).toBe('Alt+Shift+M');
  });

  it('sends EXTRACT_AND_COPY from the shortcut to the tab of the event', async () => {
    const a = api();
    await handleCommand(COPY_THREAD_COMMAND, { id: 7, url: 'https://x.com/a/status/1' }, a);
    expect(a.sendMessage).toHaveBeenCalledWith(7, { type: EXTRACT_AND_COPY, source: 'shortcut' });
    expect(a.queryActiveTab).not.toHaveBeenCalled();
  });

  it('falls back to the active tab when the event has none', async () => {
    const a = api();
    await handleCommand(COPY_THREAD_COMMAND, undefined, a);
    expect(a.sendMessage).toHaveBeenCalledWith(3, { type: EXTRACT_AND_COPY, source: 'shortcut' });
  });

  it('sends on any X page; the content script explains non-post pages in a toast', async () => {
    const a = api();
    await handleCommand(COPY_THREAD_COMMAND, { id: 7, url: 'https://twitter.com/home' }, a);
    expect(a.sendMessage).toHaveBeenCalledOnce();
  });

  it.each([undefined, 'https://example.com/a/status/1', 'chrome://newtab/', 'not a url'])(
    'ignores tabs that are not on X (%s)',
    async (url) => {
      const a = api();
      await handleCommand(COPY_THREAD_COMMAND, { id: 7, url }, a);
      expect(a.sendMessage).not.toHaveBeenCalled();
    },
  );

  it('ignores other commands', async () => {
    const a = api();
    await handleCommand('something-else', { id: 7, url: 'https://x.com/a/status/1' }, a);
    expect(a.sendMessage).not.toHaveBeenCalled();
  });

  it('never throws (no content script in the tab, no active tab)', async () => {
    const failing = api({
      sendMessage: vi.fn(async () => {
        throw new Error('Could not establish connection. Receiving end does not exist.');
      }),
    });
    await expect(
      handleCommand(COPY_THREAD_COMMAND, { id: 7, url: 'https://x.com/a/status/1' }, failing),
    ).resolves.toBeUndefined();
    const noTab = api({ queryActiveTab: vi.fn(async () => undefined) });
    await expect(handleCommand(COPY_THREAD_COMMAND, undefined, noTab)).resolves.toBeUndefined();
    const queryFails = api({ queryActiveTab: vi.fn(() => Promise.reject(new Error('x'))) });
    await expect(
      handleCommand(COPY_THREAD_COMMAND, undefined, queryFails),
    ).resolves.toBeUndefined();
  });
});
