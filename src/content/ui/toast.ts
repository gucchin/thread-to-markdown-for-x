// Toast in the bottom-right corner, rendered in a Shadow DOM (PLAN.md §9.3).
// All page-derived strings are set with textContent / value, never as HTML.
import { describeResponse, type ResultKind } from '../../shared/labels';
import type { ExtractAndCopyResponse, TriggerSource } from '../../shared/messages';
import { applyStyles } from './styles';

export const TOAST_HOST_ATTR = 'data-xmd-toast';
const AUTO_DISMISS_MS = 3000;
const ERROR_DISMISS_MS = 6000;

export interface ToastOptions {
  kind: ResultKind;
  message: string;
  /** Shown in a read-only textarea for manual copy. The toast then stays until closed. */
  markdown?: string;
}

const CSS = `
:host { all: initial; }
.toast {
  position: fixed; right: 24px; bottom: 24px; z-index: 2147483647;
  box-sizing: border-box; max-width: min(420px, calc(100vw - 48px)); padding: 12px 40px 12px 16px;
  border-radius: 8px; border-left: 4px solid #00ba7c;
  background: #0f1419; color: #fff; box-shadow: 0 4px 16px rgb(0 0 0 / 0.3);
  font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
}
.toast.warning { border-left-color: #ffd400; }
.toast.progress { border-left-color: #1d9bf0; padding-right: 16px; }
.toast.error { border-left-color: #f4212e; }
p { margin: 0; }
textarea {
  display: block; box-sizing: border-box; width: 100%; height: 160px; margin-top: 8px; padding: 8px;
  border: 1px solid #536471; border-radius: 4px; background: #000; color: #e7e9ea;
  font: 12px/1.4 ui-monospace, Consolas, monospace; resize: vertical;
}
button.close {
  position: absolute; top: 6px; right: 6px; width: 28px; height: 28px; padding: 0;
  border: 0; border-radius: 50%; background: transparent; color: #e7e9ea; font-size: 18px; cursor: pointer;
}
button.close:hover, button.close:focus-visible { background: rgb(255 255 255 / 0.1); }
button.stop {
  margin-top: 8px; padding: 4px 14px; border: 1px solid #536471; border-radius: 9999px;
  background: transparent; color: #fff; font: inherit; font-weight: 600; cursor: pointer;
}
button.stop:hover, button.stop:focus-visible { background: rgb(255 255 255 / 0.1); }
button.stop:disabled { opacity: 0.5; cursor: default; }
`;

/** Replaces any previous toast with an empty one. The caller fills `box`, then appends it. */
function mountToast(doc: Document, className: string, message: string) {
  doc.querySelector(`[${TOAST_HOST_ATTR}]`)?.remove();

  const host = doc.createElement('div');
  host.setAttribute(TOAST_HOST_ATTR, '');
  const shadow = host.attachShadow({ mode: 'open' });
  applyStyles(shadow, CSS);

  const box = doc.createElement('div');
  box.className = `toast ${className}`;
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');

  const text = doc.createElement('p');
  text.textContent = message;
  box.append(text);
  shadow.append(box);
  return { host, box, text };
}

/** Shows a toast, replacing any previous one. Returns the host element. */
export function showToast(options: ToastOptions, doc: Document = document): HTMLElement {
  const { host, box } = mountToast(doc, options.kind, options.message);

  if (options.markdown !== undefined) {
    const area = doc.createElement('textarea');
    area.readOnly = true;
    area.value = options.markdown;
    area.setAttribute('aria-label', 'Markdown');
    area.addEventListener('focus', () => area.select());
    box.append(area);
  }

  const close = doc.createElement('button');
  close.type = 'button';
  close.className = 'close';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close');
  close.addEventListener('click', () => host.remove());
  box.append(close);

  (doc.body ?? doc.documentElement).append(host);

  if (options.markdown === undefined) {
    const delay = options.kind === 'error' ? ERROR_DISMISS_MS : AUTO_DISMISS_MS;
    setTimeout(() => host.remove(), delay);
  }
  return host;
}

/**
 * Shows the toast for a pipeline result. A failed copy started from the popup is left to the
 * popup, which retries with focus and offers manual copy itself.
 */
export function showResultToast(
  response: ExtractAndCopyResponse,
  source: TriggerSource,
  doc: Document = document,
): HTMLElement | null {
  if (!response.ok && response.code === 'COPY_FAILED' && source === 'popup') return null;
  const { kind, text } = describeResponse(response);
  return showToast(
    { kind, message: text, markdown: response.ok ? undefined : response.markdown },
    doc,
  );
}

export interface ProgressToast {
  host: HTMLElement;
  update(message: string): void;
}

/**
 * Auto-scroll progress with a Stop button (PLAN.md §7.6). It stays until the result toast
 * replaces it. Stop is pressed once only; the collection ends at the next step.
 */
export function showProgressToast(
  message: string,
  onStop: () => void,
  doc: Document = document,
): ProgressToast {
  const { host, box, text } = mountToast(doc, 'progress', message);
  const stop = doc.createElement('button');
  stop.type = 'button';
  stop.className = 'stop';
  stop.textContent = 'Stop';
  stop.addEventListener('click', (event) => {
    event.stopPropagation(); // keep the click away from X's handlers
    stop.disabled = true;
    stop.textContent = 'Stopping…';
    onStop();
  });
  box.append(stop);
  (doc.body ?? doc.documentElement).append(host);
  return {
    host,
    update: (next) => {
      text.textContent = next;
    },
  };
}
