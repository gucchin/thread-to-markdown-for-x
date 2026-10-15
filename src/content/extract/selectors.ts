// Every dependency on X's DOM and URL structure lives in this file (PLAN.md §7.1).
// When X changes its markup, fix it here and refresh tests/fixtures/.
//
// Rules: no obfuscated classes (css-xxxxx / r-xxxxx), no aria-label, no visible text
// (breaks across UI languages), no nth-child. Prefer data-testid, then semantic tags/roles.

export const SELECTORS = {
  /** One post. The base unit of extraction. */
  tweet: 'article[data-testid="tweet"]',
  /** Post body text. Also appears inside quoted posts, so scope it (see quoteContainer). */
  tweetText: 'div[data-testid="tweetText"]',
  /** Author block containing the display name and the @handle. Also appears inside quotes. */
  userName: 'div[data-testid="User-Name"]',
  /** Timestamp; the `datetime` attribute is a UTC ISO 8601 string. */
  time: 'time[datetime]',
  /** Permalink to a post. The <time> element sits inside the post's own permalink. */
  statusLink: 'a[href*="/status/"]',
  /** Attached image; src is pbs.twimg.com/media/... */
  photo: 'div[data-testid="tweetPhoto"] img',
  /** Attached video or GIF player. */
  videoPlayer: 'div[data-testid="videoPlayer"]',
  /** Video element with a poster image. Its src is a blob: URL and must never be output. */
  videoPoster: 'video[poster]',
  /** Present when the text is cut off behind "Show more". */
  showMoreLink: '[data-testid="tweet-text-show-more-link"]',
  /** Timeline cell; reflects display order. */
  cell: 'div[data-testid="cellInnerDiv"]',
  /**
   * Heading of a timeline section, e.g. "Discover more" below the conversation, which lists
   * unrelated (recommended) posts, possibly by the same author. Posts never contain an h2.
   */
  sectionHeading: 'div[data-testid="cellInnerDiv"] h2',
  /** Candidate quote container. It is a quote only if it contains a userName (PLAN.md §7.2). */
  quoteContainer: 'div[role="link"]',
  /** A post's action bar (reply / repost / like ...). The page button is placed near it. */
  actionBar: 'div[role="group"]',
  /** Main column. The MutationObserver watches only this subtree. */
  main: 'main',
} as const;

/**
 * Path of a post URL: /<handle>/status/<id>, optionally followed by /photo/1, /analytics, etc.
 * Groups: 1 = handle, 2 = status ID.
 */
export const STATUS_PATH_PATTERN = /^\/([A-Za-z0-9_]+)\/status\/(\d+)/;

/** href of a profile link: /<handle>. Group 1 = handle. */
export const PROFILE_PATH_PATTERN = /^\/([A-Za-z0-9_]+)$/;

/** A handle as displayed in text ("@handle"). Group 1 = handle. Used when no profile link exists (quotes). */
export const HANDLE_TEXT_PATTERN = /@([A-Za-z0-9_]+)/;

/** Hosts the extension runs on (must match manifest.json). */
export const X_HOSTS = ['x.com', 'twitter.com'] as const;

/** Host of attached-image URLs. Profile images (pbs.twimg.com/profile_images/) are excluded by path. */
export const MEDIA_URL_PREFIX = 'https://pbs.twimg.com/media/';

/**
 * Poster of a GIF. GIFs play as a <video> whose src is a real mp4 (video.twimg.com/tweet_video/…)
 * with this poster; videos use amplify_video_thumb / ext_tw_video_thumb and a blob: src
 * (tests/fixtures/gif.html, thread.html).
 */
export const GIF_POSTER_PREFIX = 'https://pbs.twimg.com/tweet_video_thumb/';
