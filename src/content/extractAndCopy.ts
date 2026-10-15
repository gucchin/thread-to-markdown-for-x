// The extract -> Markdown -> clipboard pipeline shared by the page button, the popup and the
// keyboard shortcut. Never throws: every failure becomes an error response (PLAN.md §7.5).
import type { ExtractAndCopyResponse, ScrollStop } from '../shared/messages';
import { DEFAULT_SETTINGS, type Settings } from '../shared/settings';
import type { CopyResult } from './clipboard';
import {
  AUTO_SCROLL_LIMITS,
  collectByScrolling,
  type CollectOptions,
  type ScrollPort,
} from './extract/autoScroll';
import { parsePageUrl } from './extract/permalink';
import {
  buildThread,
  countTruncated,
  readTimeline,
  selectThread,
  type TimelineEntry,
} from './extract/thread';
import { toMarkdown } from './markdown';

export interface AutoScrollEnv {
  port: ScrollPort;
  /** Aborted by the toast's Stop button: the posts collected so far are copied. */
  signal?: AbortSignal;
  onProgress?: (count: number) => void;
  /** Overrides of AUTO_SCROLL_LIMITS (tests). */
  limits?: Pick<CollectOptions, 'maxPosts' | 'maxMs' | 'maxIdleSteps' | 'now'>;
}

export interface ExtractAndCopyEnv {
  /** Where the posts are rendered (the page document). */
  root: ParentNode;
  /** The page URL (location.href). */
  url: string;
  copy: (text: string) => Promise<CopyResult>;
  /**
   * Expands the truncated posts with these IDs in the page ("Show more") and resolves with the
   * number of posts it tried to expand. Omitted: truncated posts are copied as shown.
   */
  expand?: (ids: ReadonlySet<string>) => Promise<number>;
  /** Output options (options page / popup). Missing fields use the defaults. */
  settings?: Partial<Settings>;
  /** Used when the autoScroll setting is on. Omitted: the rendered posts are read once. */
  autoScroll?: AutoScrollEnv;
  timeZone?: string;
  now?: () => Date;
}

export async function extractAndCopy(env: ExtractAndCopyEnv): Promise<ExtractAndCopyResponse> {
  try {
    const settings = { ...DEFAULT_SETTINGS, ...env.settings };
    const page = parsePageUrl(env.url);
    const read = () => (page ? readTimeline(env.root, page.id, settings.resolution) : []);

    let entries: TimelineEntry[];
    let stopped: ScrollStop | undefined;
    const scrolling = settings.autoScroll && page ? env.autoScroll : undefined;
    const maxPosts = scrolling?.limits?.maxPosts ?? AUTO_SCROLL_LIMITS.maxPosts;
    if (scrolling) {
      const collected = await collectByScrolling({
        read,
        scroll: scrolling.port,
        mode: settings.mode,
        expand: env.expand,
        signal: scrolling.signal,
        onProgress: scrolling.onProgress,
        ...scrolling.limits,
      });
      entries = collected.entries;
      if (collected.reason !== 'end' && collected.reason !== 'idle') stopped = collected.reason;
    } else {
      entries = read();
      // Long posts in a thread are often cut off behind X's "Show more": expand them and read
      // again. Posts that stay truncated (e.g. timeout) keep their warning.
      const truncated = new Set(
        (selectThread(entries, settings.mode)?.tweets ?? [])
          .filter((t) => t.truncated)
          .map((t) => t.id),
      );
      if (env.expand && truncated.size > 0 && (await env.expand(truncated)) > 0) entries = read();
    }

    const outcome = buildThread(entries, env.url, {
      mode: settings.mode,
      maxPosts: scrolling ? maxPosts : undefined,
      now: env.now,
    });
    if (!outcome.ok) return { ok: false, code: outcome.code, message: outcome.message };

    const { result } = outcome;
    if (stopped) result.warnings.push(scrollWarning(stopped, maxPosts));
    const markdown = toMarkdown(result, {
      timeZone: env.timeZone,
      frontmatter: settings.frontmatter,
      metaFormat: settings.metaFormat,
      authorInHeadings: settings.mode === 'all',
    });
    const copied = await env.copy(markdown);
    if (!copied.ok) {
      return {
        ok: false,
        code: 'COPY_FAILED',
        message: `Could not copy to the clipboard (${copied.error}).`,
        markdown,
      };
    }
    return {
      ok: true,
      count: result.tweets.length,
      truncated: countTruncated(result),
      warnings: result.warnings,
      ...(stopped ? { stopped } : {}),
    };
  } catch (error) {
    // Unexpected DOM shapes must not leak exceptions into the UI.
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, code: 'UNKNOWN', message: `Unexpected error: ${detail}` };
  }
}

function scrollWarning(stopped: ScrollStop, maxPosts: number): string {
  switch (stopped) {
    case 'limit':
      return `Auto-scroll stopped at ${maxPosts} posts; the thread may continue.`;
    case 'timeout':
      return 'Auto-scroll stopped at its time limit; the thread may continue.';
    case 'aborted':
      return 'Auto-scroll was stopped by the user; the thread may continue.';
  }
}
