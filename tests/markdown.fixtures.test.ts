// Fixture -> extractThread -> Markdown: the whole extraction pipeline without UI (PLAN.md §12).
import { describe, expect, it } from 'vitest';
import { extractThread } from '../src/content/extract/thread';
import { toMarkdown } from '../src/content/markdown';
import { loadFixture } from './helpers/dom';
import englishHtml from './fixtures/english.html?raw';
import gifHtml from './fixtures/gif.html?raw';
import image3Html from './fixtures/image3.html?raw';
import image4Html from './fixtures/image4.html?raw';
import midThreadHtml from './fixtures/mid_thread.html?raw';
import quoteHtml from './fixtures/quote.html?raw';
import singleHtml from './fixtures/single.html?raw';
import specialHtml from './fixtures/special.html?raw';
import showMoreHtml from './fixtures/show_more.html?raw';
import singleTweetHtml from './fixtures/single_tweet.html?raw';
import threadHtml from './fixtures/thread.html?raw';

function markdownFor(html: string) {
  const { document, url } = loadFixture(html);
  const outcome = extractThread(document, url, { now: () => new Date('2026-10-15T00:00:00.000Z') });
  if (!outcome.ok) throw new Error(outcome.message);
  const { tweets } = outcome.result;
  return { tweets, markdown: toMarkdown(outcome.result, { timeZone: 'Asia/Tokyo' }) };
}

describe.each([
  ['single', singleHtml],
  ['thread', threadHtml],
  ['image3', image3Html],
  ['image4', image4Html],
  ['quote', quoteHtml],
  // Replies are by other users, so the thread is the main post alone.
  ['single_tweet', singleTweetHtml],
  // Two thread posts cut off behind "Show more" (not expanded here): warnings at the end.
  ['show_more', showMoreHtml],
  ['mid_thread', midThreadHtml],
  ['special', specialHtml],
  ['english', englishHtml],
  ['gif', gifHtml],
])('%s.html', (_, html) => {
  const { tweets, markdown } = markdownFor(html);

  it('has the §8.1 header', () => {
    // Display names may end in emoji (image4: "User 1⚡️").
    expect(markdown).toMatch(
      /^# X Thread by @user1 \(\d{4}-\d{2}-\d{2}\)\n\n- Author: User 1[\p{Extended_Pictographic}️]* \(@user1\)\n/u,
    );
    expect(markdown).toContain(`- Posts: ${tweets.length}\n`);
    expect(markdown).toContain('- Extracted: 2026-10-15 09:00 (+09:00)\n\n---\n');
  });

  it('has one section per post, with a meta comment', () => {
    expect(markdown.match(/^### Tweet \d+/gm)).toHaveLength(tweets.length);
    expect(
      markdown.match(
        /^### Tweet \d+.*\n<!-- \d{4}-\d{2}-\d{2} \d{2}:\d{2} \+09:00 · https:\/\/x\.com\/\S+ -->$/gm,
      ),
    ).toHaveLength(tweets.length);
    // Exactly one main post; it is not always the first (mid_thread: Tweet 3).
    expect(markdown.match(/^### Tweet \d+ \(Main\)$/gm)).toHaveLength(1);
  });

  it('never contains blob: URLs or truncated-URL ellipses', () => {
    expect(markdown).not.toContain('blob:');
    expect(markdown).not.toMatch(/https?:\/\/\S*…/);
  });

  it('matches the snapshot', () => {
    expect(markdown).toMatchSnapshot();
  });
});

// Every output option at once, on fixtures with replies by others, quotes and media (PLAN.md §8.2).
describe.each([
  ['single_tweet', singleTweetHtml],
  ['show_more', showMoreHtml],
  ['image3', image3Html],
])('%s.html with every option on', (_, html) => {
  const { document, url } = loadFixture(html);
  const outcome = extractThread(document, url, {
    mode: 'all',
    resolution: 'orig',
    now: () => new Date('2026-10-15T00:00:00.000Z'),
  });
  if (!outcome.ok) throw new Error(outcome.message);
  const markdown = toMarkdown(outcome.result, {
    timeZone: 'Asia/Tokyo',
    frontmatter: true,
    metaFormat: 'line',
    authorInHeadings: true,
  });

  it('starts with the frontmatter, then the title', () => {
    expect(markdown).toMatch(
      /^---\ntitle: "X Thread by @user1"\n[\s\S]*?\ntags: \[x-thread, clipping\]\n---\n\n# X Thread by @user1 /,
    );
    expect(markdown).toContain(`\nposts: ${outcome.result.tweets.length}\n`);
  });

  it('names the author in every heading and writes meta lines, not comments', () => {
    const headings = markdown.match(/^### Tweet \d+ — @user\d+( \(Main\))?$/gm) ?? [];
    expect(headings).toHaveLength(outcome.result.tweets.length);
    expect(markdown).not.toContain('<!--');
    expect(markdown).not.toContain('name=large');
  });

  it('matches the snapshot', () => {
    expect(markdown).toMatchSnapshot();
  });
});
