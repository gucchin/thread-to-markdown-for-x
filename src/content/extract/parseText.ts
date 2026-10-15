// Rebuilds plain text from a tweetText element (PLAN.md §7.3). Pure: depends on the DOM only.

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;
const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'BLOCKQUOTE']);
const URL_SHAPED = /^https?:\/\/\S+$/;
const ELLIPSIS = '…';

export function parseText(root: Element): string {
  return normalize(renderChildren(root));
}

function renderChildren(node: Node): string {
  let text = '';
  for (const child of node.childNodes) text += renderNode(child);
  return text;
}

function renderNode(node: Node): string {
  if (node.nodeType === TEXT_NODE) return node.textContent ?? '';
  if (node.nodeType !== ELEMENT_NODE) return '';
  const el = node as Element;
  switch (el.tagName) {
    case 'IMG': // emoji
      return el.getAttribute('alt') ?? '';
    case 'BR':
      return '\n';
    case 'A':
      return renderLink(el);
  }
  const inner = renderChildren(el);
  // Quoted posts show URLs as a plain <span> split into parts, like links (see displayedUrl).
  if (el.tagName === 'SPAN' && el.children.length > 0) {
    const url = displayedUrl(inner);
    if (url) return url;
  }
  return BLOCK_TAGS.has(el.tagName) ? `\n${inner}\n` : inner;
}

function renderLink(a: Element): string {
  const inner = renderChildren(a);
  const href = a.getAttribute('href') ?? '';
  // Mentions (/handle), hashtags (/hashtag/...) and other internal links keep their text.
  if (!/^https?:\/\//.test(href)) return inner;
  // External links point at t.co; the text holds the real URL when it is URL-shaped.
  return displayedUrl(inner) ?? href;
}

/**
 * X renders a URL as hidden "https://" + visible part + hidden rest + "…", so the full text is
 * the complete URL followed by an ellipsis. Returns the URL without the ellipsis, or null.
 */
function displayedUrl(text: string): string | null {
  const url = text.endsWith(ELLIPSIS) ? text.slice(0, -ELLIPSIS.length) : text;
  return URL_SHAPED.test(url) ? url : null;
}

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
