// Popup entry: binds the popup controller to the Chrome APIs. The work happens in the content
// script; the popup only sends EXTRACT_AND_COPY and shows the result (PLAN.md §3, §9.4).
import type { ExtractAndCopyResponse } from '../shared/messages';
import { initPopup } from './popupController';

void initPopup(document, {
  queryActiveTab: async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0],
  sendMessage: (tabId, message) =>
    chrome.tabs.sendMessage<typeof message, ExtractAndCopyResponse>(tabId, message),
  writeClipboard: (text) => navigator.clipboard.writeText(text),
  storage: chrome.storage.sync,
  openOptions: () => void chrome.runtime.openOptionsPage(),
});
