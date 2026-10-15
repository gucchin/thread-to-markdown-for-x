// Popup behaviour (PLAN.md §9.4), separated from the Chrome APIs so it can be tested.
import { parsePageUrl } from '../content/extract/permalink';
import { X_HOSTS } from '../content/extract/selectors';
import { describeResponse, type ResultKind } from '../shared/labels';
import { EXTRACT_AND_COPY, type ExtractAndCopyRequest } from '../shared/messages';
import type { ExtractAndCopyResponse } from '../shared/messages';
import type { SettingsStorage } from '../shared/settings';
import { bindSettingsForm, type SettingsForm } from '../shared/settingsForm';

export interface PopupApi {
  /** The active tab. Its url is only visible for x.com / twitter.com (host permissions). */
  queryActiveTab: () => Promise<{ id?: number; url?: string } | undefined>;
  sendMessage: (tabId: number, message: ExtractAndCopyRequest) => Promise<ExtractAndCopyResponse>;
  writeClipboard: (text: string) => Promise<void>;
  /** chrome.storage.sync: the options chosen here are settings, read by the content script. */
  storage: SettingsStorage;
  openOptions: () => void;
}

export type PageState = { enabled: true } | { enabled: false; reason: string };

export const TEXT = {
  notX: 'Open a post on x.com to copy its thread.',
  notStatus: 'Open a single post (x.com/<user>/status/<id>) to copy its thread.',
  copying: 'Copying…',
  reload:
    'Reload the page and try again (the extension was installed or updated after the page was opened).',
  copiedByPopup: '✅ Copied as Markdown',
  manualCopy: 'Could not copy to the clipboard. Copy the Markdown below manually.',
} as const;

export function pageState(url: string | undefined): PageState {
  const host = hostOf(url);
  if (!url || !host || !(X_HOSTS as readonly string[]).includes(host)) {
    return { enabled: false, reason: TEXT.notX };
  }
  return parsePageUrl(url) ? { enabled: true } : { enabled: false, reason: TEXT.notStatus };
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** Chrome's error when no content script listens in the tab (not injected yet). */
export function isMissingReceiver(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Receiving end does not exist|Could not establish connection/i.test(message);
}

interface PopupElements {
  button: HTMLButtonElement;
  status: HTMLElement;
  manual: HTMLTextAreaElement;
  settings: HTMLElement;
  options: HTMLElement;
}

function elements(doc: Document): PopupElements {
  const button = doc.getElementById('copy');
  const status = doc.getElementById('status');
  const manual = doc.getElementById('manual');
  const settings = doc.getElementById('settings');
  const options = doc.getElementById('options');
  if (
    !(button instanceof HTMLButtonElement) ||
    !status ||
    !(manual instanceof HTMLTextAreaElement) ||
    !settings ||
    !options
  ) {
    throw new Error('popup.html is missing #copy, #status, #manual, #settings or #options');
  }
  return { button, status, manual, settings, options };
}

function show(ui: PopupElements, kind: ResultKind | 'info', text: string, markdown?: string) {
  ui.status.textContent = text;
  ui.status.dataset.kind = kind;
  ui.manual.hidden = markdown === undefined;
  ui.manual.value = markdown ?? '';
}

/** Sets up the popup. Resolves once the initial state is shown. */
export async function initPopup(doc: Document, api: PopupApi): Promise<void> {
  const ui = elements(doc);
  ui.manual.addEventListener('focus', () => ui.manual.select());
  ui.options.addEventListener('click', (event) => {
    event.preventDefault();
    api.openOptions();
  });
  const form = await bindSettingsForm(ui.settings, api.storage);

  const tab = await api.queryActiveTab().catch(() => undefined);
  const state = pageState(tab?.url);
  if (!state.enabled || tab?.id === undefined) {
    ui.button.disabled = true;
    show(ui, 'info', state.enabled ? TEXT.notX : state.reason);
    return;
  }
  const tabId = tab.id;
  ui.button.disabled = false;
  show(ui, 'info', '');

  ui.button.addEventListener('click', () => {
    void copyThread(ui, api, tabId, form);
  });
}

async function copyThread(
  ui: PopupElements,
  api: PopupApi,
  tabId: number,
  form: SettingsForm,
): Promise<void> {
  ui.button.disabled = true;
  show(ui, 'info', TEXT.copying);
  try {
    // A copy started right after a settings change must use the new settings.
    await form.saved();
    const response = await api
      .sendMessage(tabId, { type: EXTRACT_AND_COPY, source: 'popup' })
      .catch((error: unknown) => {
        if (isMissingReceiver(error)) return null;
        throw error;
      });
    if (response === null) {
      show(ui, 'error', TEXT.reload);
    } else if (!response.ok && response.code === 'COPY_FAILED' && response.markdown) {
      // The page could not copy (it has no focus while the popup is open); the popup can.
      await retryCopy(ui, api, response.markdown);
    } else {
      const { kind, text } = describeResponse(response);
      show(ui, kind, text);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    show(ui, 'error', `Something went wrong. ${detail}`);
  } finally {
    ui.button.disabled = false;
  }
}

async function retryCopy(ui: PopupElements, api: PopupApi, markdown: string): Promise<void> {
  try {
    await api.writeClipboard(markdown);
    show(ui, 'success', TEXT.copiedByPopup);
  } catch {
    show(ui, 'error', TEXT.manualCopy, markdown);
  }
}
