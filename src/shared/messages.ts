// Messages between the popup / service worker and the content script (PLAN.md §3).

export const EXTRACT_AND_COPY = 'EXTRACT_AND_COPY';

/** What started the copy. The popup handles COPY_FAILED itself (it retries with focus). */
export type TriggerSource = 'button' | 'popup' | 'shortcut';

export interface ExtractAndCopyRequest {
  type: typeof EXTRACT_AND_COPY;
  source?: TriggerSource;
}

/** Why extract-and-copy failed. The popup and toast map these to user-facing text. */
export type ExtractErrorCode =
  | 'NOT_STATUS_PAGE' // URL is not /<user>/status/<id>
  | 'MAIN_NOT_FOUND' // the post from the URL is not rendered on the page
  | 'NO_TWEETS' // nothing could be extracted
  | 'COPY_FAILED' // every clipboard fallback failed
  | 'UNKNOWN';

/** Why auto-scroll stopped before the end of the thread (PLAN.md §7.6). */
export type ScrollStop = 'limit' | 'timeout' | 'aborted';

export type ExtractAndCopyResponse =
  | {
      ok: true;
      /** Number of posts copied. */
      count: number;
      /** Posts (or their quotes) cut off behind "Show more". */
      truncated: number;
      warnings: string[];
      /** Set when auto-scroll stopped before the end: the thread may continue. */
      stopped?: ScrollStop;
    }
  | {
      ok: false;
      code: ExtractErrorCode;
      message: string;
      /**
       * Set with COPY_FAILED: the Markdown that could not be copied, so the caller can retry from
       * a context that has focus (the popup) or offer manual copy.
       */
      markdown?: string;
    };

export function isExtractAndCopyRequest(message: unknown): message is ExtractAndCopyRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === EXTRACT_AND_COPY
  );
}
