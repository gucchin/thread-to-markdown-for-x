import { describe, expect, it } from 'vitest';
import { parseAuthor } from '../src/content/extract/parseAuthor';
import { el } from './helpers/dom';

describe('parseAuthor', () => {
  it('reads the handle from the profile link and the name before @handle', () => {
    const userName = el(
      '<div data-testid="User-Name"><a href="/some_one"><div><span>Some One</span></div><div><svg></svg></div></a>' +
        '<a href="/some_one"><div><span>@some_one</span></div></a><div><span>·</span></div>' +
        '<a href="/some_one/status/1"><time datetime="2026-01-01T00:00:00.000Z">Jan 1</time></a></div>',
    );
    expect(parseAuthor(userName)).toEqual({ displayName: 'Some One', handle: 'some_one' });
  });

  it('falls back to the @handle text when there are no links (quote cards)', () => {
    const userName = el(
      '<div data-testid="User-Name"><div><span>Quoted</span></div><div><span>@quoted</span></div></div>',
    );
    expect(parseAuthor(userName)).toEqual({ displayName: 'Quoted', handle: 'quoted' });
  });

  it('restores emoji in display names', () => {
    const userName = el(
      '<div data-testid="User-Name"><a href="/a"><span>Name </span><img alt="🚀"></a><a href="/a">@a</a></div>',
    );
    expect(parseAuthor(userName)?.displayName).toBe('Name 🚀');
  });

  it('uses the handle as the name when no name is shown', () => {
    expect(parseAuthor(el('<div data-testid="User-Name"><a href="/a">@a</a></div>'))).toEqual({
      displayName: 'a',
      handle: 'a',
    });
  });

  it('returns null without a handle', () => {
    expect(parseAuthor(el('<div data-testid="User-Name"><span>nobody</span></div>'))).toBeNull();
  });
});
