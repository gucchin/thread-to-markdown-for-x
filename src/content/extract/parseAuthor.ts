import type { Author } from '../../shared/types';
import { parseText } from './parseText';
import { HANDLE_TEXT_PATTERN, PROFILE_PATH_PATTERN } from './selectors';

/**
 * Reads the display name and handle from a User-Name element.
 * Posts link the name to /<handle>; quote cards have no links, so the "@handle" text is used.
 */
export function parseAuthor(userName: Element): Author | null {
  const text = parseText(userName);
  let handle: string | undefined;
  for (const link of userName.querySelectorAll('a[href]')) {
    handle = PROFILE_PATH_PATTERN.exec(link.getAttribute('href') ?? '')?.[1];
    if (handle) break;
  }
  handle ??= HANDLE_TEXT_PATTERN.exec(text)?.[1];
  if (!handle) return null;

  // The display name is everything before "@handle" (emoji are restored from their alt text).
  const at = text.indexOf(`@${handle}`);
  const displayName = (at >= 0 ? text.slice(0, at) : '').replace(/\s+/g, ' ').trim();
  return { displayName: displayName || handle, handle };
}
