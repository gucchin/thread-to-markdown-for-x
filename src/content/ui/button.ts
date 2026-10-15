// "Copy as Markdown" button next to the main post on post pages (PLAN.md §9.2).
import { findQuoteContainer, queryOwn } from '../extract/parseQuote';
import { findPermalink } from '../extract/parseTweet';
import { parsePageUrl } from '../extract/permalink';
import { SELECTORS } from '../extract/selectors';
import { applyStyles } from './styles';

/** Marks the injected host element (and makes injection idempotent). */
export const BUTTON_HOST_ATTR = 'data-xmd-injected';
const DEBOUNCE_MS = 150;

export interface PageButtonEnv {
  doc: Document;
  /** Current page URL (location.href). Read on every sync: X is a single-page app. */
  getUrl: () => string;
  /** Called on click. The button is disabled until the returned promise settles. */
  onClick: () => Promise<unknown>;
}

const CSS = `
:host { all: initial; display: block; }
button {
  margin: 4px 0 8px; padding: 4px 12px; border: 1px solid #1d9bf0; border-radius: 9999px;
  background: transparent; color: #1d9bf0; cursor: pointer;
  font: 600 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
}
button:hover:not(:disabled), button:focus-visible { background: rgb(29 155 240 / 0.1); }
button:disabled { opacity: 0.6; cursor: progress; }
`;

/**
 * Makes the page match the URL: exactly one button right after the main post's action bar on a
 * post page, none anywhere else. Safe to call any number of times.
 */
export function syncButton(env: PageButtonEnv): void {
  const { doc } = env;
  const page = parsePageUrl(env.getUrl());
  const actionBar = page ? findMainActionBar(doc, page.id) : null;

  // Only one element can directly follow the action bar, so at most one host is kept.
  let kept = false;
  for (const host of doc.querySelectorAll(`[${BUTTON_HOST_ATTR}]`)) {
    if (actionBar !== null && host.previousElementSibling === actionBar) kept = true;
    else host.remove();
  }
  if (actionBar && !kept) actionBar.after(createButtonHost(env));
}

/** The action bar of the post whose ID is in the URL, if it is rendered. */
export function findMainActionBar(doc: Document, mainId: string): Element | null {
  const scope = doc.querySelector(SELECTORS.main) ?? doc;
  for (const article of scope.querySelectorAll(SELECTORS.tweet)) {
    const quote = findQuoteContainer(article);
    if (findPermalink(article, quote)?.id === mainId) {
      return queryOwn(article, SELECTORS.actionBar, quote);
    }
  }
  return null;
}

function createButtonHost(env: PageButtonEnv): HTMLElement {
  const { doc } = env;
  const host = doc.createElement('div');
  host.setAttribute(BUTTON_HOST_ATTR, '1');
  const shadow = host.attachShadow({ mode: 'open' });
  applyStyles(shadow, CSS);

  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = 'Copy as Markdown';
  button.addEventListener('click', (event) => {
    // The whole post is a link on X; keep the click from opening it.
    event.preventDefault();
    event.stopPropagation();
    if (button.disabled) return;
    button.disabled = true;
    void env.onClick().finally(() => {
      button.disabled = false;
    });
  });
  shadow.append(button);
  return host;
}

/**
 * Keeps the button in sync while X re-renders and navigates (pushState cannot be hooked from a
 * content script, so URL changes are noticed in the observer callback). Watches only the
 * <main> subtree, plus <main>'s parent in case <main> itself is replaced. Returns a stop function.
 */
export function startPageButton(env: PageButtonEnv): () => void {
  const { doc } = env;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let observedMain: Element | null = null;

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => syncButton(env), DEBOUNCE_MS);
  };

  const observer = new MutationObserver(() => {
    const main = doc.querySelector(SELECTORS.main);
    if (main !== observedMain) observe();
    schedule();
  });

  function observe() {
    observer.disconnect();
    observedMain = doc.querySelector(SELECTORS.main);
    if (observedMain) {
      observer.observe(observedMain, { childList: true, subtree: true });
      if (observedMain.parentNode) observer.observe(observedMain.parentNode, { childList: true });
    } else {
      // X renders <main> after the content script runs: wait for it.
      observer.observe(doc.documentElement, { childList: true, subtree: true });
    }
  }

  observe();
  syncButton(env);
  return () => {
    observer.disconnect();
    clearTimeout(timer);
    for (const host of doc.querySelectorAll(`[${BUTTON_HOST_ATTR}]`)) host.remove();
  };
}
