import { STATUS_PATH_PATTERN, X_HOSTS } from './selectors';

export interface StatusRef {
  handle: string;
  id: string;
}

/** Parses "/<handle>/status/<id>[/...]" or an absolute x.com URL. Returns null for anything else. */
export function parseStatusHref(href: string): StatusRef | null {
  let path = href;
  if (/^https?:\/\//.test(href)) {
    try {
      path = new URL(href).pathname;
    } catch {
      return null;
    }
  }
  const match = STATUS_PATH_PATTERN.exec(path.split(/[?#]/)[0] ?? '');
  return match?.[1] && match[2] ? { handle: match[1], id: match[2] } : null;
}

/** Parses the page URL: an x.com / twitter.com post page, or null. */
export function parsePageUrl(url: string): StatusRef | null {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  return (X_HOSTS as readonly string[]).includes(host) ? parseStatusHref(url) : null;
}

export function statusUrl({ handle, id }: StatusRef): string {
  return `https://x.com/${handle}/status/${id}`;
}
