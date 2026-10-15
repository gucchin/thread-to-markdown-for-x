import { describe, expect, it } from 'vitest';
import { normalizeImageUrl, parseMedia } from '../src/content/extract/parseMedia';
import { el } from './helpers/dom';

const photo = (id: string, alt = '') =>
  `<div data-testid="tweetPhoto"><img alt="${alt}" src="https://pbs.twimg.com/media/${id}?format=jpg&amp;name=small"></div>`;

describe('normalizeImageUrl', () => {
  it.each([
    ['large', 'https://pbs.twimg.com/media/ABC?format=jpg&name=large'],
    ['orig', 'https://pbs.twimg.com/media/ABC?format=jpg&name=orig'],
  ] as const)('sets name=%s', (resolution, expected) => {
    expect(
      normalizeImageUrl('https://pbs.twimg.com/media/ABC?format=jpg&name=small', resolution),
    ).toBe(expected);
  });

  it('adds name when missing', () => {
    expect(normalizeImageUrl('https://pbs.twimg.com/media/ABC?format=png', 'large')).toBe(
      'https://pbs.twimg.com/media/ABC?format=png&name=large',
    );
  });

  it.each([
    'https://pbs.twimg.com/profile_images/1/avatar_normal.jpg',
    'https://pbs.twimg.com/card_img/1/abc?format=jpg&name=small',
    'https://abs.twimg.com/emoji/v2/svg/1f447.svg',
    'blob:https://x.com/1234',
  ])('rejects non-media URL %s', (src) => {
    expect(normalizeImageUrl(src, 'large')).toBeNull();
  });
});

describe('parseMedia', () => {
  it('returns four images in DOM order', () => {
    const scope = el(`<div>${['A', 'B', 'C', 'D'].map((id) => photo(id)).join('')}</div>`);
    expect(parseMedia(scope).map((m) => m.url)).toEqual(
      ['A', 'B', 'C', 'D'].map((id) => `https://pbs.twimg.com/media/${id}?format=jpg&name=large`),
    );
  });

  it('honours the orig resolution', () => {
    expect(parseMedia(el(`<div>${photo('A')}</div>`), { resolution: 'orig' })[0]?.url).toBe(
      'https://pbs.twimg.com/media/A?format=jpg&name=orig',
    );
  });

  it('records alt text when present', () => {
    expect(parseMedia(el(`<div>${photo('A', 'a cat')}</div>`))[0]).toEqual({
      type: 'image',
      url: 'https://pbs.twimg.com/media/A?format=jpg&name=large',
      alt: 'a cat',
    });
  });

  it('ignores avatars and emoji outside tweetPhoto', () => {
    const scope = el(
      '<div><div data-testid="Tweet-User-Avatar"><img src="https://pbs.twimg.com/profile_images/1/a_normal.jpg"></div>' +
        '<img alt="👇" src="https://abs.twimg.com/emoji/v2/svg/1f447.svg"></div>',
    );
    expect(parseMedia(scope)).toEqual([]);
  });

  it('records a video by its poster and never outputs the blob: src', () => {
    const scope = el(
      '<div><div data-testid="videoPlayer"><video poster="https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/x.jpg" src="blob:https://x.com/abc"></video></div></div>',
    );
    const media = parseMedia(scope);
    expect(media).toEqual([
      { type: 'video', url: 'https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/x.jpg' },
    ]);
    expect(JSON.stringify(media)).not.toContain('blob:');
  });

  it('records a GIF (real mp4 src, tweet_video_thumb poster) as gif, by its poster', () => {
    const scope = el(
      '<div><div data-testid="videoPlayer"><video poster="https://pbs.twimg.com/tweet_video_thumb/G.jpg" src="https://video.twimg.com/tweet_video/G.mp4"></video></div></div>',
    );
    expect(parseMedia(scope)).toEqual([
      { type: 'gif', url: 'https://pbs.twimg.com/tweet_video_thumb/G.jpg' },
    ]);
  });

  it('falls back to the post URL for a video without a usable poster', () => {
    const scope = el(
      '<div><div data-testid="videoPlayer"><video poster="blob:https://x.com/p" src="blob:https://x.com/abc"></video></div></div>',
    );
    expect(parseMedia(scope, { fallbackUrl: 'https://x.com/a/status/1' })).toEqual([
      { type: 'video', url: 'https://x.com/a/status/1' },
    ]);
  });

  it('skips media inside the excluded element', () => {
    const scope = el(`<div>${photo('OWN')}<div id="quote">${photo('QUOTED')}</div></div>`);
    const urls = parseMedia(scope, { exclude: scope.querySelector('#quote') }).map((m) => m.url);
    expect(urls).toEqual(['https://pbs.twimg.com/media/OWN?format=jpg&name=large']);
  });
});
