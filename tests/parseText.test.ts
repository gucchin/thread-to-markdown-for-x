import { describe, expect, it } from 'vitest';
import { parseText } from '../src/content/extract/parseText';
import { el } from './helpers/dom';

const text = (html: string) => parseText(el(`<div data-testid="tweetText">${html}</div>`));

describe('parseText', () => {
  it('keeps plain text', () => {
    expect(text('<span>hello world</span>')).toBe('hello world');
  });

  it('restores emoji from img alt', () => {
    expect(
      text('<span>look </span><img alt="👇" src="https://abs.twimg.com/emoji/v2/svg/1f447.svg">'),
    ).toBe('look 👇');
  });

  it('restores a URL split into hidden and visible parts, dropping the trailing ellipsis', () => {
    // Structure observed on x.com: hidden "https://", visible part, hidden rest, "…".
    const link =
      '<a href="https://t.co/abc123"><span aria-hidden="true">https://</span>example.com/path-' +
      '<span aria-hidden="true">rest?q=1</span><span aria-hidden="true">…</span></a>';
    expect(text(`<span>see </span>${link}`)).toBe('see https://example.com/path-rest?q=1');
  });

  it('keeps a URL that is not truncated', () => {
    expect(text('<a href="https://t.co/abc"><span>https://</span>example.com</a>')).toBe(
      'https://example.com',
    );
  });

  it('falls back to the t.co href when the link text is not a URL', () => {
    expect(text('<a href="https://t.co/abc123">pic.example</a>')).toBe('https://t.co/abc123');
  });

  it('restores a URL shown as a plain span (quote cards)', () => {
    const span =
      '<span dir="ltr"><span aria-hidden="true">https://</span>example.com/a-' +
      '<span aria-hidden="true">b</span><span aria-hidden="true">…</span></span>';
    expect(text(`<span>x </span>${span}`)).toBe('x https://example.com/a-b');
  });

  it('keeps mentions and hashtags as text', () => {
    expect(
      text('<a href="/someone">@someone</a><span> and </span><a href="/hashtag/tag">#tag</a>'),
    ).toBe('@someone and #tag');
  });

  it('turns br and block elements into newlines', () => {
    expect(text('<span>a</span><br><span>b</span><div>c</div>')).toBe('a\nb\nc');
  });

  it('keeps literal newlines in text nodes', () => {
    expect(text('<span>line 1\nline 2</span>')).toBe('line 1\nline 2');
  });

  it('collapses runs of blank lines to one and trims', () => {
    expect(text('<span>  \n\na\n\n\n\n \n\nb  \n\n</span>')).toBe('a\n\nb');
  });

  it('strips trailing spaces on each line', () => {
    expect(text('<span>a   \nb</span>')).toBe('a\nb');
  });

  it('keeps a leading # (escaping is markdown.ts’s job)', () => {
    expect(text('<span># not a heading</span>')).toBe('# not a heading');
  });
});
