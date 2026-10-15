// Keyboard shortcut handling (PLAN.md §1.2, §3), separated from the Chrome APIs so it can be
// tested. Stateless: everything needed comes with the command event.
import { X_HOSTS } from '../content/extract/selectors';
import { EXTRACT_AND_COPY, type ExtractAndCopyRequest } from '../shared/messages';

/** The command name in manifest.json. */
export const COPY_THREAD_COMMAND = 'copy-thread';

export interface CommandApi {
  queryActiveTab: () => Promise<{ id?: number; url?: string } | undefined>;
  sendMessage: (tabId: number, message: ExtractAndCopyRequest) => Promise<unknown>;
}

/**
 * Asks the content script of the X tab to extract and copy; it shows the result as a toast.
 * Other tabs are ignored (their URL is not visible without host permissions, and no content
 * script runs there). Never throws.
 */
export async function handleCommand(
  command: string,
  tab: { id?: number; url?: string } | undefined,
  api: CommandApi,
): Promise<void> {
  if (command !== COPY_THREAD_COMMAND) return;
  try {
    const target = tab?.id !== undefined ? tab : await api.queryActiveTab();
    if (target?.id === undefined || !isXUrl(target.url)) return;
    await api.sendMessage(target.id, { type: EXTRACT_AND_COPY, source: 'shortcut' });
  } catch {
    // No content script in the tab (the page was opened before the extension was installed or
    // updated): nothing can be shown there, and the service worker has no UI of its own.
  }
}

function isXUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return (X_HOSTS as readonly string[]).includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
