// Anonymizes a raw X DOM snapshot (copy(document.querySelector('main').outerHTML)) into a test fixture.
//
//   node scripts/anonymize.mjs <raw.html> <out.html> [--url https://x.com/<handle>/status/<id>]
//
// The page URL is read from a leading `<!-- url: ... -->` comment, or given with --url.
// Keeps the DOM structure, data-testid, roles, datetimes and emoji. Replaces handles, display
// names (including the logged-in account's, shown only on the reply box avatar), status/user IDs,
// media and avatar URLs, t.co links, links to other sites, post text, link card and article text
// with consistent dummies, sets engagement counts to 1, drops obfuscated `class` attributes, then
// fails if any original value is still present.
// Deterministic and idempotent: anonymizing an anonymized fixture yields the same file.
import { readFileSync, writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const RESERVED_PATHS = new Set([
  'home',
  'explore',
  'i',
  'search',
  'settings',
  'notifications',
  'messages',
  'compose',
  'hashtag',
  'login',
  'logout',
  'signup',
  'tos',
  'privacy',
  'intent',
  'share',
]);
const HANDLE = '[A-Za-z0-9_]+';
const LOREM = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut ' +
  'labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco'
).split(' ');

// ---------- arguments ----------
const args = process.argv.slice(2);
const urlFlag = args.indexOf('--url');
const urlArg = urlFlag >= 0 ? args.splice(urlFlag, 2)[1] : undefined;
const [input, output] = args;
if (!input || !output) {
  console.error('usage: node scripts/anonymize.mjs <raw.html> <out.html> [--url <page url>]');
  process.exit(2);
}

let html = readFileSync(input, 'utf8');
const urlComment = /^\s*<!--\s*url:\s*(\S+)\s*-->\s*/.exec(html);
if (urlComment) html = html.slice(urlComment[0].length);
html = html.trimEnd();
const pageUrl = urlArg ?? urlComment?.[1];
const pageMatch =
  pageUrl && new RegExp(`^https://(?:x|twitter)\\.com/(${HANDLE})/status/(\\d+)`).exec(pageUrl);
if (!pageMatch) {
  console.error('Page URL unknown: add a leading <!-- url: ... --> comment or pass --url');
  process.exit(2);
}

const { document: doc } = new JSDOM(`<!doctype html><body>${html}</body>`).window;
const root = doc.body;
const elements = () => [root, ...root.querySelectorAll('*')];
const textNodes = (node) => {
  const walker = doc.createTreeWalker(node, 4 /* NodeFilter.SHOW_TEXT */);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
};

// ---------- mapping tables (value -> dummy, in order of first appearance) ----------
function table(make) {
  const map = new Map();
  return {
    map,
    get(key) {
      if (!map.has(key)) map.set(key, make(map.size + 1, key));
      return map.get(key);
    },
  };
}
const handles = table((n) => `user${n}`); // keyed by lower-case handle
const displayNames = new Map(); // original display name -> dummy
const statusIds = table((n) => String(1000000000000000000n + BigInt(n)));
const userIds = table((n) => String(100000 + n));
const mediaIds = table((n) => `MEDIA${String(n).padStart(4, '0')}`);
const videoThumbs = table((n) => `${n}/img/VIDEO${String(n).padStart(4, '0')}`);
const videoFiles = table((n) => `VIDEOFILE${String(n).padStart(4, '0')}`);
const cardImages = table((n) => `CARD${String(n).padStart(4, '0')}/img`);
const avatarIds = table((n) => String(n));
const tcoCodes = table((n) => `link${n}`);
const hashtags = table((n) => `tag${n}`);
const handleOf = (h) => handles.get(h.toLowerCase());

// ---------- 1. collect handles (page author first, then document order) ----------
handleOf(pageMatch[1]);
for (const el of elements()) {
  const href = el.getAttribute('href');
  const path = href && new RegExp(`^/(${HANDLE})(?:/|$)`).exec(href);
  if (path && !RESERVED_PATHS.has(path[1].toLowerCase())) handleOf(path[1]);
  const testid = el.getAttribute('data-testid');
  const avatar = testid && new RegExp(`^UserAvatar-Container-(${HANDLE})$`).exec(testid);
  if (avatar) handleOf(avatar[1]);
}
for (const userName of root.querySelectorAll('[data-testid="User-Name"]')) {
  for (const node of textNodes(userName)) {
    const at = new RegExp(`^@(${HANDLE})$`).exec(node.data.trim());
    if (at) handleOf(at[1]);
  }
}

// ---------- 2. display names: text in User-Name before the "@handle" node ----------
for (const userName of root.querySelectorAll('[data-testid="User-Name"]')) {
  const nodes = textNodes(userName);
  const atIndex = nodes.findIndex((n) => new RegExp(`^@${HANDLE}$`).test(n.data.trim()));
  if (atIndex <= 0) continue;
  const handle = nodes[atIndex].data.trim().slice(1);
  const dummyIndex = handleOf(handle).slice('user'.length);
  const before = nodes.slice(0, atIndex);
  const original = before
    .map((n) => n.data)
    .join('')
    .trim();
  const dummy = `User ${dummyIndex}`;
  if (original && original !== dummy) displayNames.set(original, dummy);
  before.forEach((n, i) => (n.data = i === 0 ? dummy : ''));
  nodes[atIndex].data = `@user${dummyIndex}`;
}
// Avatars carry the display name as aria-label/alt. The logged-in account appears only here (the
// avatar of the reply box), never in a User-Name, so its name is collected from the avatar itself.
for (const avatar of root.querySelectorAll('[data-testid^="UserAvatar-Container-"]')) {
  const handle = new RegExp(`^UserAvatar-Container-(${HANDLE})$`).exec(
    avatar.getAttribute('data-testid'),
  );
  if (!handle) continue;
  const dummy = `User ${handleOf(handle[1]).slice('user'.length)}`;
  for (const el of avatar.querySelectorAll('[aria-label], [alt]')) {
    for (const attr of ['aria-label', 'alt']) {
      const original = el.getAttribute(attr)?.trim();
      if (!original) continue;
      if (original !== dummy) displayNames.set(original, dummy);
      el.setAttribute(attr, dummy);
    }
  }
}

// ---------- 3. post text: dummy words of the same length; URLs and hashtags get dummies ----------
let wordCursor = 0;
function dummyText(length) {
  let out = '';
  while (out.length < length) {
    out += (out ? ' ' : '') + LOREM[wordCursor % LOREM.length];
    wordCursor += 1;
  }
  // Never end on a space: it would be read as trailing whitespace on a re-run (breaks idempotence).
  out = out.slice(0, length);
  return out.endsWith(' ') ? `${out.slice(0, -1)}x` : out;
}
function replaceSegment(text) {
  // Keep newlines, surrounding whitespace and leading Markdown-significant characters
  // (#, >, -, *, `) so escape-related cases survive anonymization.
  return text
    .split('\n')
    .map((line) => {
      const [, lead, body, trail] = /^(\s*[#>\-*`]*\s*)(.*?)(\s*)$/s.exec(line);
      return lead + (body ? dummyText([...body].length) : '') + trail;
    })
    .join('\n');
}
// A displayed URL is split into "https://", a visible part, a hidden part and "…". It is either an
// external link (<a href="https://t.co/...">) or, inside quoted posts, a plain <span> with the same parts.
const URL_MARKER = /^(https?:\/\/|…)$/;
const urlTexts = table((n) => `text${n}`);
function urlGroupOf(node, tweetText) {
  for (let el = node.parentElement; el && el !== tweetText; el = el.parentElement) {
    if (el.tagName === 'A' && /^https?:\/\//.test(el.getAttribute('href') ?? '')) return el;
    if (
      el.tagName === 'SPAN' &&
      el.children.length > 0 &&
      /^https?:\/\/\S+$/.test(el.textContent)
    ) {
      return el;
    }
  }
  return null;
}
function anonymizeUrlPart(node, group) {
  if (URL_MARKER.test(node.data)) return;
  const parts = textNodes(group).filter((n) => !URL_MARKER.test(n.data));
  const index = parts.indexOf(node);
  if (index > 0) {
    node.data = `part${index}`;
    return;
  }
  // Only the first part looks up the code, while group.textContent is still the original URL.
  const href = group.getAttribute('href');
  const code = href
    ? tcoCodes.get(/^https:\/\/t\.co\/([A-Za-z0-9]+)/.exec(href)?.[1] ?? href)
    : urlTexts.get(group.textContent);
  node.data = `example.com/${code}/`;
}
for (const tweetText of root.querySelectorAll('[data-testid="tweetText"]')) {
  for (const node of textNodes(tweetText)) {
    const link = node.parentElement?.closest('a');
    const href = link?.getAttribute('href') ?? '';
    const urlGroup = urlGroupOf(node, tweetText);
    if (urlGroup) {
      anonymizeUrlPart(node, urlGroup);
    } else if (href.startsWith('/hashtag/')) {
      node.data = node.data.replace(/^#(.+)$/, (_, tag) => `#${hashtags.get(tag)}`);
    } else if (!link) {
      node.data = replaceSegment(node.data);
    }
    // Mention links (href="/<handle>") are rewritten by the global handle pass below.
  }
}

// ---------- 3b. engagement counts ----------
// Reply / repost / like / bookmark / view counts, together with the timestamp, could identify the
// original post. They appear as visible numbers (app-text-transition-container, e.g. "1,964.4万",
// "2.1K") and in the aria-labels of the action bar and its buttons. Every number there becomes "1"
// (the extractor never reads them).
const COUNT_RE = /\d[\d.,]*/g;
const engagementCounts = new Set();
const blankCounts = (value) =>
  value.replace(COUNT_RE, (n) => {
    if (n !== '1') engagementCounts.add(n);
    return '1';
  });
for (const container of root.querySelectorAll('[data-testid="app-text-transition-container"]')) {
  for (const node of textNodes(container)) node.data = blankCounts(node.data);
}
for (const group of root.querySelectorAll('[role="group"]')) {
  for (const el of [group, ...group.querySelectorAll('[aria-label]')]) {
    const label = el.getAttribute('aria-label');
    if (label) el.setAttribute('aria-label', blankCounts(label));
  }
  // Some counts are rendered next to the transition container instead of inside it.
  for (const node of textNodes(group)) node.data = blankCounts(node.data);
}

// ---------- 3c. link cards and X articles ----------
// Their titles, descriptions and domains are the linked page's or the article's own text, so they
// are replaced like post text (the extractor reads neither).
const cardTexts = new Map(); // original line -> dummy, for the leak check
function replaceCardText(value) {
  const out = replaceSegment(value);
  const dummies = out.split('\n');
  value.split('\n').forEach((line, i) => {
    if (line.trim() && line.trim() !== dummies[i]?.trim()) cardTexts.set(line.trim(), dummies[i]);
  });
  return out;
}
const cardBlocks = [
  ...root.querySelectorAll('[data-testid="card.wrapper"]'),
  // An article preview: the cover image and, next to it, the title and the opening text.
  ...[...root.querySelectorAll('[data-testid="article-cover-image"]')].map((c) => c.parentElement),
];
for (const block of cardBlocks) {
  const cover = block.querySelector('[data-testid="article-cover-image"]');
  for (const node of textNodes(block)) {
    if (!cover?.contains(node)) node.data = replaceCardText(node.data);
  }
  if (cover) continue;
  for (const el of block.querySelectorAll('[aria-label], [alt]')) {
    for (const attr of ['aria-label', 'alt']) {
      const value = el.getAttribute(attr);
      if (value?.trim()) el.setAttribute(attr, replaceCardText(value));
    }
  }
}

// ---------- 3d. links to other sites ----------
// Ads and cards can link straight to the advertiser with tracking parameters (e.g. twclid), which
// may be tied to the session that took the snapshot. Every link outside X becomes a dummy.
const X_HOSTS = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:x\.com|twitter\.com|t\.co|twimg\.com)(?:[/?#]|$)/i;
const DUMMY_LINK = /^https:\/\/example\.com\/external\d+$/;
const externalLinks = table((n) => `https://example.com/external${n}`);
for (const el of root.querySelectorAll('[href]')) {
  const href = el.getAttribute('href');
  if (/^https?:\/\//i.test(href) && !X_HOSTS.test(href) && !DUMMY_LINK.test(href)) {
    el.setAttribute('href', externalLinks.get(href));
  }
}

// ---------- 4. global rewrite of attributes and remaining text ----------
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const handleRe = new RegExp(
  `(?<![A-Za-z0-9_])(${[...handles.map.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escapeRe)
    .join('|')})(?![A-Za-z0-9_])`,
  'gi',
);
// Short names (e.g. "Bo") would hit unrelated substrings; they are only replaced inside User-Name.
const nameEntries = [...displayNames]
  .filter(([name]) => name.length >= 4)
  .sort((a, b) => b[0].length - a[0].length);

// Attributes that hold human-readable text, where display names may appear.
const TEXT_ATTRIBUTES = new Set(['aria-label', 'alt', 'title']);

// Handles are replaced before display names: a name can be a substring of a handle
// (e.g. the name "Abc" in the handle "xyzAbc"), and replacing it first would leave part of the
// handle behind.
// Display names are only replaced in text, never in href/src/data-testid.
function rewrite(value, { text }) {
  let v = value
    .replace(/(\/status\/)(\d+)/g, (_, p, id) => p + statusIds.get(id))
    .replace(/(pbs\.twimg\.com\/media\/)([A-Za-z0-9_-]+)/g, (_, p, id) => p + mediaIds.get(id))
    // Video/GIF posters: <kind>_thumb/<id>/[pu/]img/<hash>.jpg or tweet_video_thumb/<id>.jpg.
    // The directory name is kept (it may tell GIFs from videos); the ID and hash are replaced.
    .replace(
      /(pbs\.twimg\.com\/(?:amplify_video_thumb|ext_tw_video_thumb|tweet_video_thumb)\/)([^"?\s]+?)(\.[a-z]+)/g,
      (_, p, path, ext) => p + videoThumbs.get(path) + ext,
    )
    // Video files (GIFs are served as real mp4 URLs, not blob:): video.twimg.com/<kind>/<path>.mp4
    .replace(
      /(video\.twimg\.com\/(?:tweet_video|ext_tw_video|amplify_video)\/)([^"?\s]+?)(\.[a-z0-9]+)/g,
      (_, p, path, ext) => p + videoFiles.get(path) + ext,
    )
    // Link-card thumbnails: card_img/<id>/<hash> (the ID can identify the linked card).
    .replace(
      /(pbs\.twimg\.com\/card_img\/)(\d+\/[A-Za-z0-9_-]+)/g,
      (_, p, path) => p + cardImages.get(path),
    )
    .replace(
      /(\/profile_images\/)(\d+)\/[^/?"\s]+?(_(?:normal|mini|bigger|x96|200x200|400x400))?(\.[a-z]+)/g,
      (_, p, id, size = '', ext) => `${p}${avatarIds.get(id)}/avatar${size}${ext}`,
    )
    // Random per page load (reply box focus target); fixed so that every leftover number means
    // something to the leak check.
    .replace(/typeaheadFocus-0\.\d+/g, () => 'typeaheadFocus-0.0')
    .replace(
      /^https:\/\/t\.co\/([A-Za-z0-9]+)(\?.*)?$/,
      (_, code) => `https://t.co/${tcoCodes.get(code)}`,
    )
    .replace(
      /^\/hashtag\/([^?]+)(\?.*)?$/,
      (_, tag, q = '') => `/hashtag/${hashtags.get(decodeURIComponent(tag))}${q}`,
    );
  v = v.replace(handleRe, (h) => handleOf(h));
  if (text) for (const [name, dummy] of nameEntries) v = v.split(name).join(dummy);
  return v;
}

for (const el of elements()) {
  el.removeAttribute('class');
  for (const attr of [...el.attributes]) {
    let value = rewrite(attr.value, { text: TEXT_ATTRIBUTES.has(attr.name) });
    if (attr.name === 'data-testid')
      value = value.replace(/^(\d+)-/, (_, id) => `${userIds.get(id)}-`);
    if (value !== attr.value) el.setAttribute(attr.name, value);
  }
}
for (const node of textNodes(root)) {
  const value = rewrite(node.data, { text: true });
  if (value !== node.data) node.data = value;
}

// ---------- 5. write and verify ----------
const newUrl = `https://x.com/${handleOf(pageMatch[1])}/status/${statusIds.get(pageMatch[2])}`;
const result = `<!-- url: ${newUrl} -->\n${root.innerHTML}\n`;

const leaks = [];
const check = (kind, map, { caseInsensitive = false, minLength = 3 } = {}) => {
  const haystack = caseInsensitive ? result.toLowerCase() : result;
  for (const [original, dummy] of map) {
    const key = caseInsensitive ? original.toLowerCase() : original;
    if (original === dummy || key.length < minLength) continue;
    const re = new RegExp(`(?<![A-Za-z0-9_])${escapeRe(key)}(?![A-Za-z0-9_])`);
    if (re.test(haystack)) leaks.push(`${kind}: ${original}`);
  }
};
check('handle', handles.map, { caseInsensitive: true });
check('display name', displayNames, { minLength: 4 });
check('status id', statusIds.map);
check('user id', userIds.map);
check('media id', mediaIds.map);
check('video thumbnail', videoThumbs.map);
check('video file', videoFiles.map);
check('card image', cardImages.map);
// Counts of 4+ characters: shorter ones ("5", "36") are too common to search for.
check('engagement count', new Map([...engagementCounts].map((n) => [n, '1'])), { minLength: 4 });
check('avatar id', avatarIds.map, { minLength: 6 });
check('t.co code', tcoCodes.map);
check('url text', urlTexts.map);
check('hashtag', hashtags.map);
check('card or article text', cardTexts, { minLength: 4 });
check('external link', externalLinks.map);
if (/twclid=/i.test(result)) leaks.push('tracking parameter: twclid');
// Structural check: every place that holds a handle must now hold a userN dummy
// (catches partial leaks such as "xyzUser 5").
for (const [, handle] of result.matchAll(/UserAvatar-Container-([^"]*)"/g)) {
  if (!/^user\d+$/.test(handle)) leaks.push(`avatar container: ${handle}`);
}
for (const avatar of root.querySelectorAll('[data-testid^="UserAvatar-Container-"]')) {
  for (const el of avatar.querySelectorAll('[aria-label], [alt]')) {
    for (const value of [el.getAttribute('aria-label'), el.getAttribute('alt')]) {
      if (value && !/^User \d+$/.test(value)) leaks.push(`avatar label: ${value}`);
    }
  }
}
for (const [, handle] of result.matchAll(/href="\/([^/"?]+)/g)) {
  if (!RESERVED_PATHS.has(handle.toLowerCase()) && !/^user\d+$/.test(handle)) {
    leaks.push(`profile link: ${handle}`);
  }
}
if (leaks.length > 0) {
  console.error('Anonymization incomplete; original values remain:');
  for (const leak of leaks) console.error(`  ${leak}`);
  process.exit(1);
}

writeFileSync(output, result);
console.log(
  `Anonymized ${input} -> ${output}\n` +
    `  url: ${newUrl}\n` +
    `  handles: ${handles.map.size}, display names: ${displayNames.size}, status ids: ${statusIds.map.size}, ` +
    `media: ${mediaIds.map.size}, links: ${tcoCodes.map.size}`,
);
