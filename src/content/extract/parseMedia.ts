// Extracts attached images and videos as Media[] (PLAN.md §7.4).
import type { ImageResolution } from '../../shared/settings';
import type { Media } from '../../shared/types';
import { GIF_POSTER_PREFIX, MEDIA_URL_PREFIX, SELECTORS } from './selectors';

export type { ImageResolution };

export interface MediaOptions {
  /** Image size requested via the `name` query parameter. Default: large. */
  resolution?: ImageResolution;
  /** Media inside this element is skipped (used to keep a quote's media out of the main post). */
  exclude?: Element | null;
  /** URL recorded for a video without a poster image (normally the post URL). */
  fallbackUrl?: string | null;
}

export function parseMedia(scope: Element, options: MediaOptions = {}): Media[] {
  const { resolution = 'large', exclude = null, fallbackUrl = null } = options;
  const media: Media[] = [];
  // One query keeps images and videos in DOM order.
  for (const el of scope.querySelectorAll(`${SELECTORS.photo}, ${SELECTORS.videoPlayer}`)) {
    if (exclude?.contains(el)) continue;
    if (el.tagName === 'IMG') {
      const url = normalizeImageUrl(el.getAttribute('src') ?? '', resolution);
      if (!url) continue; // profile images, card thumbnails, emoji
      const alt = el.getAttribute('alt');
      media.push(alt ? { type: 'image', url, alt } : { type: 'image', url });
    } else {
      // A video's src is a blob: URL and is never recorded; the poster image is used instead
      // (for GIFs too, for consistency). The poster's path tells GIFs from videos.
      const poster = el.querySelector(SELECTORS.videoPoster)?.getAttribute('poster');
      const url = poster && !poster.startsWith('blob:') ? poster : fallbackUrl;
      const type = poster?.startsWith(GIF_POSTER_PREFIX) ? 'gif' : 'video';
      if (url) media.push({ type, url });
    }
  }
  return media;
}

/** pbs.twimg.com/media/<id>?format=jpg&name=small -> ...&name=<resolution>. Null for non-media URLs. */
export function normalizeImageUrl(src: string, resolution: ImageResolution): string | null {
  if (!src.startsWith(MEDIA_URL_PREFIX)) return null;
  const url = new URL(src);
  url.searchParams.set('name', resolution);
  return url.toString();
}
