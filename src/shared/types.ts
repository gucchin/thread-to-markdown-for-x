// Data extracted from the X DOM (PLAN.md §6).

export interface Author {
  displayName: string;
  /** Without the leading "@". */
  handle: string;
}

export interface Media {
  type: 'image' | 'video' | 'gif';
  /** Image: normalized pbs.twimg.com URL. Video/GIF: poster URL, or the post URL if no poster. Never a blob: URL. */
  url: string;
  alt?: string;
}

export interface TweetData {
  /** Status ID; the de-duplication key. */
  id: string;
  /** https://x.com/<handle>/status/<id> */
  url: string;
  author: Author;
  /** ISO 8601 from <time datetime>, or null if absent. */
  datetime: string | null;
  text: string;
  /** True when the text is cut off behind "Show more". */
  truncated: boolean;
  media: Media[];
  /** Quoted post, one level deep only. */
  quote: QuotedTweet | null;
  /** True when the ID matches the status ID in the page URL. */
  isMain: boolean;
}

/**
 * A quoted post. The quote card has no permalink of its own; its ID and URL are only known when
 * the card contains a /status/ link (e.g. an attached photo), hence `string | null`.
 */
export type QuotedTweet = Omit<TweetData, 'quote' | 'id' | 'url' | 'isMain'> & {
  id: string | null;
  url: string | null;
};

export interface ThreadResult {
  sourceUrl: string;
  rootAuthor: Author;
  /** In display order. */
  tweets: TweetData[];
  /** e.g. "Tweet 3 was truncated ("Show more") and may be incomplete." */
  warnings: string[];
  /** ISO 8601. */
  extractedAt: string;
}
