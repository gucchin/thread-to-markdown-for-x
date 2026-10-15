// User-facing texts shared by the toast and the popup (PLAN.md §9.3, §9.4).
import type { ExtractAndCopyResponse, ExtractErrorCode, ScrollStop } from './messages';

export type ResultKind = 'success' | 'warning' | 'error';

const posts = (n: number) => `${n} post${n === 1 ? '' : 's'}`;

const ERROR_TEXT: Record<ExtractErrorCode, string> = {
  NOT_STATUS_PAGE: 'Open a post (x.com/<user>/status/<id>) to copy its thread.',
  MAIN_NOT_FOUND: 'The post is not loaded yet. Wait for the page to finish loading and try again.',
  NO_TWEETS: 'No posts were found on this page.',
  COPY_FAILED: 'Could not copy to the clipboard. Copy the Markdown below manually.',
  UNKNOWN: 'Something went wrong.',
};

const STOP_TEXT: Record<ScrollStop, string> = {
  limit: 'post limit reached',
  timeout: 'time limit reached',
  aborted: 'stopped',
};

export function describeResponse(response: ExtractAndCopyResponse): {
  kind: ResultKind;
  text: string;
} {
  if (response.ok) {
    const notes = [
      ...(response.truncated > 0 ? [`${response.truncated} truncated`] : []),
      ...(response.stopped ? [STOP_TEXT[response.stopped]] : []),
    ];
    return notes.length > 0
      ? { kind: 'warning', text: `⚠️ ${posts(response.count)} copied (${notes.join('; ')})` }
      : { kind: 'success', text: `✅ ${posts(response.count)} copied as Markdown` };
  }
  const text = ERROR_TEXT[response.code];
  return {
    kind: 'error',
    // UNKNOWN carries the only useful detail in its message.
    text: response.code === 'UNKNOWN' ? `${text} ${response.message}` : text,
  };
}
