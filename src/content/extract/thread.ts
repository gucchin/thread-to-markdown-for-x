// Decides which rendered posts form the thread (PLAN.md §7.5).
// Reading the DOM (readTimeline) is separate from choosing the range (selectThread), so that the
// auto-scroll collector (autoScroll.ts) can merge several readings and apply the same rules.
import type { ExtractErrorCode } from '../../shared/messages';
import type { ImageResolution, ThreadMode } from '../../shared/settings';
import type { ThreadResult, TweetData } from '../../shared/types';
import { parseTweet } from './parseTweet';
import { parsePageUrl } from './permalink';
import { SELECTORS } from './selectors';

export interface ThreadOptions {
  /** Default: author. */
  mode?: ThreadMode;
  resolution?: ImageResolution;
  /** Keep at most this many posts (auto-scroll limit). */
  maxPosts?: number;
  /** Clock for extractedAt (tests). */
  now?: () => Date;
}

export type ThreadOutcome =
  { ok: true; result: ThreadResult } | { ok: false; code: ExtractErrorCode; message: string };

/** A rendered post, or a section heading ("Discover more") separating timeline sections. */
export type TimelineEntry = { kind: 'tweet'; tweet: TweetData } | { kind: 'break' };

/**
 * Collects the thread around the post in the page URL from the posts currently rendered in
 * `root` (virtual scrolling means off-screen posts may be missing). See selectThread for the
 * range. Never throws for missing content; failures are returned as error codes.
 */
export function extractThread(
  root: ParentNode,
  pageUrl: string,
  options: ThreadOptions = {},
): ThreadOutcome {
  const page = parsePageUrl(pageUrl);
  if (!page) return notStatusPage();
  return buildThread(readTimeline(root, page.id, options.resolution), pageUrl, options);
}

/** Posts and section headings in DOM order, first occurrence of each post ID only. */
export function readTimeline(
  root: ParentNode,
  mainId: string,
  resolution?: ImageResolution,
): TimelineEntry[] {
  const seen = new Set<string>();
  const entries: TimelineEntry[] = [];
  // One query keeps posts and headings in DOM order.
  for (const el of root.querySelectorAll(`${SELECTORS.tweet}, ${SELECTORS.sectionHeading}`)) {
    if (!el.matches(SELECTORS.tweet)) {
      entries.push({ kind: 'break' });
      continue;
    }
    const tweet = parseTweet(el, mainId, { resolution });
    if (!tweet || seen.has(tweet.id)) continue;
    seen.add(tweet.id);
    entries.push({ kind: 'tweet', tweet });
  }
  return entries;
}

export interface Selection {
  tweets: TweetData[];
  /**
   * True when the end of the thread is among the entries: a post outside the range (another
   * author, in mode "author") or a section heading follows it. Auto-scroll stops there.
   */
  endReached: boolean;
}

/**
 * The thread within `entries`, or null when the main post is not among them:
 * - upwards: consecutive posts by the main post's author directly above it;
 * - downwards, mode "author": posts by the same author directly below it, until another author
 *   appears; mode "all": every post below it (replies by others included).
 * Only the main post's section counts: posts under a later heading ("Discover more") are
 * recommendations, not part of the conversation, even when they are by the same author.
 */
export function selectThread(
  entries: readonly TimelineEntry[],
  mode: ThreadMode = 'author',
): Selection | null {
  const mainAt = entries.findIndex((e) => e.kind === 'tweet' && e.tweet.isMain);
  const main = entries[mainAt];
  if (main?.kind !== 'tweet') return null;

  // The author is taken from the main post, not the URL: the URL's handle may differ in case or
  // be stale after a rename, while the rendered post is authoritative.
  const handle = main.tweet.author.handle.toLowerCase();
  const inRange = (
    e: TimelineEntry | undefined,
    upwards: boolean,
  ): e is TimelineEntry & {
    kind: 'tweet';
  } =>
    e?.kind === 'tweet' &&
    ((mode === 'all' && !upwards) || e.tweet.author.handle.toLowerCase() === handle);

  let first = mainAt;
  while (inRange(entries[first - 1], true)) first -= 1;
  let last = mainAt;
  while (inRange(entries[last + 1], false)) last += 1;

  const tweets = entries
    .slice(first, last + 1)
    .flatMap((e) => (e.kind === 'tweet' ? [e.tweet] : []));
  return { tweets, endReached: last + 1 < entries.length };
}

/** ThreadResult from timeline entries (one reading, or several merged by auto-scroll). */
export function buildThread(
  entries: readonly TimelineEntry[],
  pageUrl: string,
  options: ThreadOptions = {},
): ThreadOutcome {
  if (!parsePageUrl(pageUrl)) return notStatusPage();
  if (!entries.some((e) => e.kind === 'tweet')) {
    return fail('NO_TWEETS', 'No posts were found on this page.');
  }
  const selection = selectThread(entries, options.mode);
  if (!selection) {
    return fail('MAIN_NOT_FOUND', 'The post from the URL is not rendered on the page yet.');
  }
  const thread = selection.tweets.slice(0, options.maxPosts);
  const main = thread.find((t) => t.isMain) ?? selection.tweets.find((t) => t.isMain)!;

  return {
    ok: true,
    result: {
      sourceUrl: main.url,
      rootAuthor: main.author,
      tweets: thread,
      warnings: truncationWarnings(thread),
      extractedAt: (options.now?.() ?? new Date()).toISOString(),
    },
  };
}

/** Warnings use the post numbers of the Markdown output (1-based, in thread order). */
export function truncationWarnings(thread: TweetData[]): string[] {
  const warnings: string[] = [];
  thread.forEach((tweet, i) => {
    if (tweet.truncated) {
      warnings.push(`Tweet ${i + 1} was truncated ("Show more") and may be incomplete.`);
    }
    if (tweet.quote?.truncated) {
      warnings.push(
        `The quoted post in Tweet ${i + 1} was truncated ("Show more") and may be incomplete.`,
      );
    }
  });
  return warnings;
}

/** Posts in the result that are, or quote, a truncated post. */
export function countTruncated(result: ThreadResult): number {
  return result.tweets.filter((t) => t.truncated || t.quote?.truncated).length;
}

function notStatusPage(): ThreadOutcome {
  return fail('NOT_STATUS_PAGE', 'This is not a post page (x.com/<user>/status/<id>).');
}

function fail(code: ExtractErrorCode, message: string): ThreadOutcome {
  return { ok: false, code, message };
}
