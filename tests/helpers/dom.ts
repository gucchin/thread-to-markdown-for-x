import { parseStatusHref } from '../../src/content/extract/permalink';
import { SELECTORS } from '../../src/content/extract/selectors';

/** Parses an HTML snippet and returns its first element. */
export function el(html: string): Element {
  const element = new DOMParser().parseFromString(html, 'text/html').body.firstElementChild;
  if (!element) throw new Error(`No element in: ${html}`);
  return element;
}

export interface ArticleSpec {
  handle: string;
  id: string;
  text?: string;
  /** Adds the "Show more" link. */
  truncated?: boolean;
  /** Adds a quote card by `quote`; with `quoteTruncated` the card has a "Show more" link. */
  quote?: string;
  quoteTruncated?: boolean;
}

/** Minimal article markup with the structure observed on x.com (see tests/fixtures). */
export function articleHtml(spec: ArticleSpec): string {
  const { handle, id, text = `text ${id}` } = spec;
  const quote = spec.quote
    ? `<div role="link"><div data-testid="User-Name"><div><span>${spec.quote}</span></div><div><span>@${spec.quote}</span></div></div>` +
      `<div data-testid="tweetText"><span>quoted</span></div>` +
      (spec.quoteTruncated ? '<span data-testid="tweet-text-show-more-link">more</span>' : '') +
      '</div>'
    : '';
  return (
    `<div data-testid="cellInnerDiv"><article data-testid="tweet">` +
    `<div data-testid="User-Name"><a href="/${handle}"><span>${handle} name</span></a><a href="/${handle}"><span>@${handle}</span></a>` +
    `<a href="/${handle}/status/${id}"><time datetime="2026-10-14T00:00:00.000Z">x</time></a></div>` +
    `<div data-testid="tweetText"><span>${text}</span></div>` +
    // On x.com a post's "Show more" is an in-place <button> (see tests/fixtures/show_more.html).
    (spec.truncated
      ? '<button type="button" data-testid="tweet-text-show-more-link">more</button>'
      : '') +
    quote +
    `<div role="group"><button data-testid="reply"></button></div>` +
    `</article></div>`
  );
}

/** A section heading cell, like "Discover more" below the conversation (tests/fixtures/image3.html). */
export const HEADING = 'heading';
const headingHtml =
  '<div data-testid="cellInnerDiv"><div><h2 aria-level="2" role="heading"><span>Discover more</span></h2></div></div>';

/** A <main> containing the given articles and section headings, as a Document. */
export function timeline(specs: (ArticleSpec | typeof HEADING)[]): Document {
  const cells = specs.map((spec) => (spec === HEADING ? headingHtml : articleHtml(spec)));
  return new DOMParser().parseFromString(`<main role="main">${cells.join('')}</main>`, 'text/html');
}

export interface Fixture {
  document: Document;
  /** Page URL from the leading `<!-- url: ... -->` comment written by scripts/anonymize.mjs. */
  url: string;
  mainId: string;
  articles: Element[];
}

/** Loads an anonymized fixture (tests/fixtures/*.html, imported with ?raw). */
export function loadFixture(html: string): Fixture {
  const url = /^<!-- url: (\S+) -->/.exec(html)?.[1];
  const mainId = url ? parseStatusHref(url)?.id : undefined;
  if (!url || !mainId) throw new Error('Fixture is missing its <!-- url: ... --> header');
  const document = new DOMParser().parseFromString(html, 'text/html');
  return { document, url, mainId, articles: [...document.querySelectorAll(SELECTORS.tweet)] };
}
