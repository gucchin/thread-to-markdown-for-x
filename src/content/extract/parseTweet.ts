// Turns one <article data-testid="tweet"> into TweetData (PLAN.md §6, §7).
import type { TweetData } from '../../shared/types';
import { parseAuthor } from './parseAuthor';
import { parseMedia, type ImageResolution } from './parseMedia';
import { parseStatusHref, statusUrl, type StatusRef } from './permalink';
import { findQuoteContainer, parseQuote, queryOwn } from './parseQuote';
import { parseText } from './parseText';
import { SELECTORS } from './selectors';

export interface ParseOptions {
  resolution?: ImageResolution;
}

/**
 * The post's own permalink: the link around its own <time> (not the quote's). Other /status/
 * links (photo/1, analytics, quotes) are not used: they are not guaranteed to exist.
 */
export function findPermalink(
  article: Element,
  quoteContainer: Element | null = findQuoteContainer(article),
): StatusRef | null {
  const permalink = queryOwn(article, SELECTORS.time, quoteContainer)?.closest(
    SELECTORS.statusLink,
  );
  return permalink ? parseStatusHref(permalink.getAttribute('href') ?? '') : null;
}

/**
 * Returns null for articles without a permalink (ads and recommendation cells without a
 * timestamp link) or without an author.
 */
export function parseTweet(
  article: Element,
  mainId: string | null,
  options: ParseOptions = {},
): TweetData | null {
  const quoteContainer = findQuoteContainer(article);
  const own = (selector: string) => queryOwn(article, selector, quoteContainer);

  const ref = findPermalink(article, quoteContainer);
  if (!ref) return null;

  const userName = own(SELECTORS.userName);
  const author = userName ? parseAuthor(userName) : null;
  if (!author) return null;

  const url = statusUrl(ref);
  const text = own(SELECTORS.tweetText);
  return {
    id: ref.id,
    url,
    author,
    datetime: own(SELECTORS.time)?.getAttribute('datetime') ?? null,
    text: text ? parseText(text) : '',
    truncated: own(SELECTORS.showMoreLink) !== null,
    media: parseMedia(article, {
      resolution: options.resolution,
      exclude: quoteContainer,
      fallbackUrl: url,
    }),
    quote: quoteContainer ? parseQuote(quoteContainer, { resolution: options.resolution }) : null,
    isMain: ref.id === mainId,
  };
}
