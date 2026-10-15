import { describe, expect, it } from 'vitest';
import { parseStatusHref, statusUrl } from '../src/content/extract/permalink';

describe('parseStatusHref', () => {
  it.each([
    ['/a/status/1', { handle: 'a', id: '1' }],
    ['/a/status/1/photo/1', { handle: 'a', id: '1' }],
    ['/a/status/1?s=20', { handle: 'a', id: '1' }],
    ['https://x.com/a/status/1', { handle: 'a', id: '1' }],
    ['https://twitter.com/a/status/1#x', { handle: 'a', id: '1' }],
  ])('parses %s', (href, expected) => {
    expect(parseStatusHref(href)).toEqual(expected);
  });

  it.each(['/a', '/home', 'https://t.co/abc', 'https://x.com/a', 'not a url'])(
    'rejects %s',
    (href) => {
      expect(parseStatusHref(href)).toBeNull();
    },
  );
});

describe('statusUrl', () => {
  it('builds an x.com URL', () => {
    expect(statusUrl({ handle: 'a', id: '1' })).toBe('https://x.com/a/status/1');
  });
});
