// Content script entry: wires the pipeline to the extension messages and the UI (PLAN.md §3).
// All extraction happens here; the popup and the service worker only send EXTRACT_AND_COPY.
import { isExtractAndCopyRequest } from '../shared/messages';
import { loadSettings } from '../shared/settings';
import { copyText } from './clipboard';
import { createController, createMessageListener } from './controller';
import { expandPosts } from './expandTruncated';
import { pageScroll } from './extract/autoScroll';
import { SELECTORS } from './extract/selectors';
import { extractAndCopy } from './extractAndCopy';
import { startPageButton } from './ui/button';
import { showProgressToast, showResultToast, type ProgressToast } from './ui/toast';

/** The auto-scroll progress toast of the current run, if any. */
let progress: ProgressToast | null = null;

// Settings are read on every run, so changes in the options page or the popup apply at once.
const controller = createController(
  async () => {
    const settings = await loadSettings(chrome.storage.sync);
    const stop = new AbortController();
    progress = null;
    return extractAndCopy({
      root: document,
      url: location.href,
      copy: (text) => copyText(text),
      expand: (ids) => expandPosts(document, ids),
      settings,
      autoScroll: {
        port: pageScroll(window, document.querySelector(SELECTORS.main) ?? document.body),
        signal: stop.signal,
        // Shown from the first scroll step on; a thread that fits on the screen shows none.
        onProgress: (count) => {
          const text = `Collecting posts… ${count}`;
          if (progress) progress.update(text);
          else progress = showProgressToast(text, () => stop.abort());
        },
      },
    });
  },
  (response, source) => {
    // The result toast replaces the progress toast; when there is none (the popup handles a
    // failed copy itself), the progress toast must still go.
    if (!showResultToast(response, source)) progress?.host.remove();
    progress = null;
  },
);

chrome.runtime.onMessage.addListener(
  createMessageListener(isExtractAndCopyRequest, controller.run),
);

startPageButton({
  doc: document,
  getUrl: () => location.href,
  onClick: () => controller.run('button'),
});
