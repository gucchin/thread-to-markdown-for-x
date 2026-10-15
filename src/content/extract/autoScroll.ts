// Auto-scroll collection (PLAN.md §7.6): X renders only the posts near the viewport (virtual
// scrolling), so a long thread is read while scrolling down step by step, and the readings are
// merged by post ID. The scroll position is restored afterwards.
import type { ThreadMode } from '../../shared/settings';
import { selectThread, type TimelineEntry } from './thread';

/**
 * Why collection stopped. "end" and "idle" are natural ends (the thread ended, or nothing new
 * appeared); the others mean the thread may continue.
 */
export type StopReason = 'end' | 'idle' | 'limit' | 'timeout' | 'aborted';

/** The page's scrolling, injected so that tests can drive it. */
export interface ScrollPort {
  getY(): number;
  scrollBy(dy: number): void;
  scrollTo(y: number): void;
  /** Distance of one step (a little under the viewport height, so that steps overlap). */
  stepHeight(): number;
  /** Resolves once the DOM has stopped changing after a scroll (bounded by a timeout). */
  settle(): Promise<void>;
}

export interface CollectOptions {
  /** Reads the currently rendered timeline (readTimeline bound to the page). */
  read: () => TimelineEntry[];
  scroll: ScrollPort;
  mode?: ThreadMode;
  /** Expands truncated posts ("Show more") while they are rendered; see expandTruncated.ts. */
  expand?: (ids: ReadonlySet<string>) => Promise<number>;
  /** Aborted by the toast's Stop button. */
  signal?: AbortSignal;
  /** Number of thread posts collected so far, after each step. */
  onProgress?: (count: number) => void;
  /** Default 100. */
  maxPosts?: number;
  /** Default 30 s. */
  maxMs?: number;
  /** Steps in a row without a new post before giving up. Default 3. */
  maxIdleSteps?: number;
  now?: () => number;
}

export const AUTO_SCROLL_LIMITS = { maxPosts: 100, maxMs: 30_000, maxIdleSteps: 3 } as const;

export interface Collected {
  /** Every reading merged, in display order. */
  entries: TimelineEntry[];
  reason: StopReason;
}

export async function collectByScrolling(options: CollectOptions): Promise<Collected> {
  const {
    read,
    scroll,
    mode = 'author',
    expand,
    signal,
    onProgress,
    maxPosts = AUTO_SCROLL_LIMITS.maxPosts,
    maxMs = AUTO_SCROLL_LIMITS.maxMs,
    maxIdleSteps = AUTO_SCROLL_LIMITS.maxIdleSteps,
    now = Date.now,
  } = options;

  const timeline = new MergedTimeline();
  const startY = scroll.getY();
  const started = now();
  const tried = new Set<string>(); // posts already expanded once: never waited for again
  let idle = 0;
  try {
    for (;;) {
      const reading = read();
      const added = timeline.merge(reading);

      if (expand) {
        const rendered = new Set(reading.flatMap((e) => (e.kind === 'tweet' ? [e.tweet.id] : [])));
        const ids = new Set(
          (selectThread(timeline.entries, mode)?.tweets ?? [])
            .filter((t) => t.truncated && rendered.has(t.id) && !tried.has(t.id))
            .map((t) => t.id),
        );
        ids.forEach((id) => tried.add(id));
        if (ids.size > 0 && (await expand(ids)) > 0) timeline.merge(read());
      }

      const selection = selectThread(timeline.entries, mode);
      // Without the main post there is nothing to collect; buildThread reports the error.
      if (!selection || selection.endReached) return done('end');
      onProgress?.(selection.tweets.length);
      if (selection.tweets.length >= maxPosts) return done('limit');
      idle = added > 0 ? 0 : idle + 1;
      if (idle >= maxIdleSteps) return done('idle');
      if (signal?.aborted) return done('aborted');
      if (now() - started >= maxMs) return done('timeout');

      scroll.scrollBy(scroll.stepHeight());
      await settleOrAbort(scroll, signal);
    }
  } finally {
    scroll.scrollTo(startY);
  }

  function done(reason: StopReason): Collected {
    return { entries: timeline.entries, reason };
  }
}

/** Waits for the DOM to settle, but returns at once when aborted. */
async function settleOrAbort(scroll: ScrollPort, signal: AbortSignal | undefined): Promise<void> {
  if (!signal) return scroll.settle();
  if (signal.aborted) return;
  let onAbort = () => {};
  const aborted = new Promise<void>((resolve) => (onAbort = resolve));
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    await Promise.race([scroll.settle(), aborted]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

/**
 * Timeline readings merged in display order. Each reading overlaps the previous one (the steps
 * overlap and X keeps some cells above the viewport), so a new entry is placed right after the
 * last known entry before it in the same reading; with none known, it goes to the end (the page
 * only scrolls down).
 */
export class MergedTimeline {
  readonly entries: TimelineEntry[] = [];

  /** Adds one reading and returns the number of new posts. */
  merge(reading: readonly TimelineEntry[]): number {
    // New entries go at anchor + 1. Those before the reading's first known post belong right
    // before that post; with no known post at all, at the end.
    const firstKnown = reading
      .map((e) => (e.kind === 'tweet' ? this.indexOf(e.tweet.id) : -1))
      .find((at) => at >= 0);
    let anchor = (firstKnown ?? this.entries.length) - 1;
    let added = 0;
    for (const entry of reading) {
      if (entry.kind === 'tweet') {
        const at = this.indexOf(entry.tweet.id);
        if (at >= 0) {
          const known = this.entries[at];
          // A post expanded since the earlier reading replaces its truncated version.
          if (known?.kind === 'tweet' && known.tweet.truncated && !entry.tweet.truncated) {
            this.entries[at] = entry;
          }
          anchor = at;
          continue;
        }
        added += 1;
      } else {
        // Headings have no ID. A conversation page has one section heading ("Discover more",
        // tests/fixtures), and collection stops there, so a heading read again is the same one.
        const at = this.entries.findIndex((e) => e.kind === 'break');
        if (at >= 0) {
          anchor = Math.max(anchor, at);
          continue;
        }
      }
      this.entries.splice(anchor + 1, 0, entry);
      anchor += 1;
    }
    return added;
  }

  private indexOf(id: string): number {
    return this.entries.findIndex((e) => e.kind === 'tweet' && e.tweet.id === id);
  }
}

/** ScrollPort for the real page. Waiting uses a MutationObserver, not a fixed sleep. */
export function pageScroll(win: Window, target: Node, quietMs = 400, timeoutMs = 2500): ScrollPort {
  return {
    getY: () => win.scrollY,
    scrollBy: (dy) => win.scrollBy(0, dy),
    scrollTo: (y) => win.scrollTo(0, y),
    stepHeight: () => Math.max(200, Math.round(win.innerHeight * 0.8)),
    settle: () => waitForSettle(target, quietMs, timeoutMs),
  };
}

/**
 * Resolves once `target` has had no DOM changes for `quietMs`, or after `timeoutMs` at most.
 * The observer and both timers are always cleaned up.
 */
export function waitForSettle(target: Node, quietMs: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let quiet = setTimeout(finish, quietMs);
    const cap = setTimeout(finish, timeoutMs);
    const observer = new MutationObserver(() => {
      clearTimeout(quiet);
      quiet = setTimeout(finish, quietMs);
    });
    observer.observe(target, { childList: true, subtree: true, characterData: true });

    function finish() {
      observer.disconnect();
      clearTimeout(quiet);
      clearTimeout(cap);
      resolve();
    }
  });
}
