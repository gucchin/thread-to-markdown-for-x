// ThreadResult -> Markdown in the default format (PLAN.md §8.1) with line-start escaping (§8.3),
// optionally with the Obsidian frontmatter (§8.2). Pure: no DOM or Chrome APIs.
import type { MetaFormat } from '../shared/settings';
import type { Media, QuotedTweet, ThreadResult, TweetData } from '../shared/types';

export interface MarkdownOptions {
  /** IANA time zone used for every date. Default: the browser's local time zone. */
  timeZone?: string;
  /** Prepend the YAML frontmatter. Default: false. */
  frontmatter?: boolean;
  /** Each post's date and URL as an HTML comment (default) or a normal line. */
  metaFormat?: MetaFormat;
  /** Add "— @handle" to every post heading (reply-all mode, where authors differ). Default: false. */
  authorInHeadings?: boolean;
}

export function toMarkdown(result: ThreadResult, options: MarkdownOptions = {}): string {
  const dates = dateFormatter(options.timeZone);
  const main = result.tweets.find((t) => t.isMain) ?? result.tweets[0];
  const extracted = dates.parts(result.extractedAt);
  const titleDate = dates.parts(main?.datetime ?? null) ?? extracted;
  const warnings = [...result.warnings];

  const blocks = [
    ...(options.frontmatter ? [frontmatter(result, titleDate?.date ?? null)] : []),
    `# X Thread by @${result.rootAuthor.handle}${titleDate ? ` (${titleDate.date})` : ''}`,
    [
      `- Author: ${result.rootAuthor.displayName} (@${result.rootAuthor.handle})`,
      `- Source: ${result.sourceUrl}`,
      `- Posts: ${result.tweets.length}`,
      ...(extracted ? [`- Extracted: ${extracted.dateTime} (${extracted.offset})`] : []),
    ].join('\n'),
    '---',
    ...result.tweets.map((tweet, i) => renderTweet(tweet, i + 1, dates, warnings, options)),
  ];
  if (warnings.length > 0) {
    blocks.push('---', ...warnings.map((w) => `> ⚠️ Warning: ${w}`));
  }
  return `${blocks.join('\n\n')}\n`;
}

/** Obsidian properties (PLAN.md §8.2). Strings are JSON-quoted, which is valid YAML. */
function frontmatter(result: ThreadResult, date: string | null): string {
  const handle = `@${result.rootAuthor.handle}`;
  return [
    '---',
    `title: ${JSON.stringify(`X Thread by ${handle}`)}`,
    `author: ${JSON.stringify(handle)}`,
    `source: ${JSON.stringify(result.sourceUrl)}`,
    ...(date ? [`date: ${date}`] : []),
    `posts: ${result.tweets.length}`,
    'tags: [x-thread, clipping]',
    '---',
  ].join('\n');
}

function renderTweet(
  tweet: TweetData,
  n: number,
  dates: DateFormatter,
  warnings: string[],
  options: MarkdownOptions,
): string {
  const when = dates.parts(tweet.datetime);
  const meta = [when && `${when.dateTime} ${when.offset}`, tweet.url].filter(Boolean).join(' · ');
  const heading = [
    `### Tweet ${n}`,
    options.authorInHeadings ? ` — @${tweet.author.handle}` : '',
    tweet.isMain ? ' (Main)' : '',
  ].join('');
  const parts = [`${heading}\n${options.metaFormat === 'line' ? meta : htmlComment(meta)}`];

  if (tweet.text) {
    const { text, unclosedFence } = escapeText(tweet.text);
    parts.push(text);
    if (unclosedFence) {
      warnings.push(
        `Tweet ${n} contains an unclosed code fence; the rest of the output may render as code.`,
      );
    }
  }
  if (tweet.media.length > 0) {
    parts.push(['- Attached Media:', ...tweet.media.map((m) => `  - ${mediaLabel(m)}`)].join('\n'));
  }
  if (tweet.quote) parts.push(renderQuote(tweet.quote, dates));
  return parts.join('\n\n');
}

function renderQuote(quote: QuotedTweet, dates: DateFormatter): string {
  const when = dates.parts(quote.datetime);
  const lines = [
    `**Quoted post by @${quote.author.handle}**${when ? ` (${when.date})` : ''}`,
    // A fence inside a blockquote is closed by the end of the blockquote, so no warning here.
    ...(quote.text ? escapeText(quote.text).text.split('\n') : []),
    // Blank lines around the media list: otherwise "Source:" would continue the last list item.
    ...(quote.media.length > 0 ? ['', ...quote.media.map((m) => `- ${mediaLabel(m)}`), ''] : []),
    ...(quote.url ? [`Source: ${quote.url}`] : []),
  ];
  while (lines.at(-1) === '') lines.pop();
  return lines.map((line) => (line ? `> ${line}` : '>')).join('\n');
}

function mediaLabel(media: Media): string {
  // Videos/GIFs record their poster image; without one the post URL is recorded instead.
  const poster = media.type !== 'image' && media.url.startsWith('https://pbs.twimg.com/');
  return `[${media.type}]${poster ? ' (poster)' : ''} ${media.url}`;
}

function htmlComment(content: string): string {
  return `<!-- ${content.replaceAll('-->', '--&gt;')} -->`;
}

// ---------- escaping (PLAN.md §8.3) ----------

/** Opening/closing code fence: up to 3 spaces, then ``` or ~~~ (3 or more). */
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
/**
 * Line-start constructs that would break the surrounding format: an ATX heading (1-6 "#" then a
 * space or end of line), a blockquote, a thematic break. "#tag" is not a heading and stays as is:
 * hashtags often start a line, and Obsidian reads them as tags.
 */
const LINE_START_SYNTAX = /^( {0,3})(#{1,6}(?=[ \t]|$)|>|-{3,}|\*{3,})/;

/**
 * Escapes only at line starts ("# x" -> "\# x", > -> \>, --- -> \---, *** -> \***). Everything
 * else (*, _, inline code, #hashtag) is left alone for readability. Lines inside a code fence are
 * not touched; an unclosed fence is reported, not closed.
 */
export function escapeText(text: string): { text: string; unclosedFence: boolean } {
  let fence: string | null = null;
  const lines = text.split('\n').map((line) => {
    const marker = FENCE.exec(line)?.[1];
    if (marker) {
      if (fence === null) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      return line;
    }
    return fence === null ? line.replace(LINE_START_SYNTAX, '$1\\$2') : line;
  });
  return { text: lines.join('\n'), unclosedFence: fence !== null };
}

// ---------- dates ----------

interface DateParts {
  /** YYYY-MM-DD */
  date: string;
  /** YYYY-MM-DD HH:mm */
  dateTime: string;
  /** +09:00 */
  offset: string;
}

interface DateFormatter {
  /** Null for a missing or unparsable ISO string. */
  parts(iso: string | null): DateParts | null;
}

function dateFormatter(timeZone: string | undefined): DateFormatter {
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset', // "GMT+09:00", or "GMT" for UTC
  });
  return {
    parts(iso) {
      if (!iso) return null;
      const time = new Date(iso);
      if (Number.isNaN(time.getTime())) return null;
      const p = Object.fromEntries(format.formatToParts(time).map((x) => [x.type, x.value]));
      const date = `${p.year}-${p.month}-${p.day}`;
      const offset = (p.timeZoneName ?? 'GMT').replace('GMT', '') || '+00:00';
      return { date, dateTime: `${date} ${p.hour}:${p.minute}`, offset };
    },
  };
}
