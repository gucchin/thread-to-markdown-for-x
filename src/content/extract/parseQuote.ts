// Separates a quoted post from the post that quotes it (PLAN.md §7.2).
// A quote is nested inside the same <article> as a second User-Name / tweetText / time, wrapped in
// a div[role="link"] card.
import type { QuotedTweet } from '../../shared/types';
import { parseAuthor } from './parseAuthor';
import { parseMedia, type ImageResolution } from './parseMedia';
import { parseStatusHref, statusUrl } from './permalink';
import { parseText } from './parseText';
import { SELECTORS } from './selectors';

/** The quote card in an article: a div[role="link"] that contains a User-Name. */
export function findQuoteContainer(article: Element): Element | null {
  for (const candidate of article.querySelectorAll(SELECTORS.quoteContainer)) {
    if (candidate.querySelector(SELECTORS.userName)) return candidate;
  }
  return null;
}

/** First element matching `selector` in `scope` that is not inside `quote` (the post's own side). */
export function queryOwn(scope: Element, selector: string, quote: Element | null): Element | null {
  for (const el of scope.querySelectorAll(selector)) {
    if (!quote?.contains(el)) return el;
  }
  return null;
}

export function parseQuote(
  container: Element,
  options: { resolution?: ImageResolution } = {},
): QuotedTweet | null {
  const userName = container.querySelector(SELECTORS.userName);
  const author = userName ? parseAuthor(userName) : null;
  if (!author) return null;

  // The card has no permalink of its own. A /status/ link inside it (e.g. an attached photo,
  // /<handle>/status/<id>/photo/1) identifies the quoted post when it belongs to the quote's author.
  let ref = null;
  for (const link of container.querySelectorAll(SELECTORS.statusLink)) {
    const candidate = parseStatusHref(link.getAttribute('href') ?? '');
    if (candidate && candidate.handle.toLowerCase() === author.handle.toLowerCase()) {
      ref = candidate;
      break;
    }
  }
  const url = ref ? statusUrl(ref) : null;
  const text = container.querySelector(SELECTORS.tweetText);

  return {
    id: ref?.id ?? null,
    url,
    author,
    datetime: container.querySelector(SELECTORS.time)?.getAttribute('datetime') ?? null,
    text: text ? parseText(text) : '',
    truncated: container.querySelector(SELECTORS.showMoreLink) !== null,
    media: parseMedia(container, { resolution: options.resolution, fallbackUrl: url }),
  };
}
