// Expands long posts that X shows cut off behind "Show more" (PLAN.md §7.5).
// In the conversation view X's "Show more" is an in-place <button>; pressing it makes X load and
// render the full text with its own code (the extension itself still makes no network requests).
import { findQuoteContainer, queryOwn } from './extract/parseQuote';
import { findPermalink } from './extract/parseTweet';
import { SELECTORS } from './extract/selectors';

export interface ExpandOptions {
  /** Give up waiting after this long; still-truncated posts keep their warning. */
  timeoutMs?: number;
}

/**
 * Presses the post's own "Show more" button on each rendered post whose ID is in `ids`, then
 * waits until each pressed post has expanded (button gone or text changed) or the timeout passes.
 * Quotes are not expanded: their card is a link to the quoted post. Returns how many buttons
 * were pressed.
 */
export async function expandPosts(
  root: ParentNode,
  ids: ReadonlySet<string>,
  { timeoutMs = 3000 }: ExpandOptions = {},
): Promise<number> {
  const targets: { button: HTMLElement; text: Element | null; before: string }[] = [];
  for (const article of root.querySelectorAll(SELECTORS.tweet)) {
    const quote = findQuoteContainer(article);
    const ref = findPermalink(article, quote);
    if (!ref || !ids.has(ref.id)) continue;
    const button = queryOwn(article, SELECTORS.showMoreLink, quote);
    // Only an in-place expander: a link would navigate away from the page.
    if (!button || button.tagName !== 'BUTTON') continue;
    const text = queryOwn(article, SELECTORS.tweetText, quote);
    targets.push({ button: button as HTMLElement, text, before: text?.textContent ?? '' });
  }
  if (targets.length === 0) return 0;

  const expanded = (t: (typeof targets)[number]) =>
    !t.button.isConnected || !t.text?.isConnected || t.text.textContent !== t.before;
  const doc = targets[0]!.button.ownerDocument;

  await new Promise<void>((resolve) => {
    const finish = () => {
      observer.disconnect();
      clearTimeout(timer);
      resolve();
    };
    const observer = new MutationObserver(() => {
      if (targets.every(expanded)) finish();
    });
    observer.observe(doc, { childList: true, subtree: true, characterData: true });
    const timer = setTimeout(finish, timeoutMs);
    for (const { button } of targets) button.click();
    if (targets.every(expanded)) finish(); // expanded synchronously
  });
  return targets.length;
}
