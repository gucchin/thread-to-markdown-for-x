import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from '../src/content/clipboard';

// jsdom implements neither navigator.clipboard nor execCommand, so both are injected/stubbed.
function stubExecCommand(result: boolean | Error) {
  const fn = vi.fn((command: string) => {
    if (result instanceof Error) throw result;
    // Record what was selected at the time of the copy.
    const active = document.activeElement as HTMLTextAreaElement | null;
    fn.copied = command === 'copy' ? (active?.value ?? null) : null;
    return result;
  }) as ReturnType<typeof vi.fn> & { copied?: string | null };
  document.execCommand = fn as unknown as Document['execCommand'];
  return fn;
}

afterEach(() => {
  // @ts-expect-error -- remove the stub again
  delete document.execCommand;
  document.body.replaceChildren();
});

describe('copyText', () => {
  it('uses the Clipboard API when it works', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const execCommand = stubExecCommand(true);
    await expect(copyText('md', { clipboard: { writeText }, document })).resolves.toEqual({
      ok: true,
      method: 'clipboard-api',
    });
    expect(writeText).toHaveBeenCalledWith('md');
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('falls back to a textarea + execCommand when the Clipboard API rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Document is not focused.'));
    const execCommand = stubExecCommand(true);
    await expect(copyText('# md', { clipboard: { writeText }, document })).resolves.toEqual({
      ok: true,
      method: 'exec-command',
    });
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(execCommand.copied).toBe('# md');
  });

  it('falls back when the Clipboard API is unavailable', async () => {
    stubExecCommand(true);
    await expect(copyText('md', { document })).resolves.toMatchObject({
      ok: true,
      method: 'exec-command',
    });
  });

  it('fails with both reasons when every method fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    stubExecCommand(false);
    await expect(copyText('md', { clipboard: { writeText }, document })).resolves.toEqual({
      ok: false,
      error: 'clipboard API: denied; execCommand: returned false',
    });
  });

  it('fails cleanly when execCommand throws or is missing', async () => {
    stubExecCommand(new Error('boom'));
    await expect(copyText('md', { document })).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('execCommand: boom'),
    });
    // @ts-expect-error -- simulate a browser without execCommand
    delete document.execCommand;
    await expect(copyText('md', { document })).resolves.toMatchObject({ ok: false });
  });

  it('removes the temporary textarea and restores focus', async () => {
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    stubExecCommand(true);
    await copyText('md', { document });
    expect(document.querySelector('textarea')).toBeNull();
    expect(document.activeElement).toBe(input);

    stubExecCommand(new Error('boom'));
    await copyText('md', { document });
    expect(document.querySelector('textarea')).toBeNull();
  });
});
