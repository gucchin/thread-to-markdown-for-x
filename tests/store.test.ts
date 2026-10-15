import { describe, expect, it } from 'vitest';
import listingEn from '../docs/store/listing.en.md?raw';
import listingJa from '../docs/store/listing.ja.md?raw';
import practices from '../docs/store/privacy-practices.md?raw';
import privacy from '../PRIVACY.md?raw';
import manifest from '../src/manifest.json';

// The store texts are pasted into the Developer Dashboard by hand; these checks keep them in line
// with the manifest so that the listing never contradicts the package (PLAN.md §16.3–16.5).
const textBlocks = (md: string) => [...md.matchAll(/```text\n([\s\S]*?)\n```/g)].map((m) => m[1]!);
const shortcut = manifest.commands['copy-thread'].suggested_key.default;
const hosts = manifest.host_permissions.map((h) => h.replace(/^https:\/\/|\/\*$/g, ''));

describe('store listing', () => {
  it('uses the manifest description as the summary, within 132 characters', () => {
    expect(textBlocks(listingEn)[0]).toBe(manifest.description);
    expect(manifest.description.length).toBeLessThanOrEqual(132);
  });

  it.each([
    ['en', listingEn],
    ['ja', listingJa],
  ])('(%s) names the shortcut, the hosts and the source code', (_lang, md) => {
    const description = textBlocks(md).at(-1)!;
    expect(description).toContain(shortcut);
    for (const host of hosts) expect(description).toContain(host);
    expect(description).toContain('https://github.com/gucchin/thread-to-markdown-for-x');
  });
});

describe('privacy practices and policy', () => {
  it('justify every permission the manifest requests, and no other', () => {
    const justified = [...practices.matchAll(/^`(\w+)`$/gm)].map((m) => m[1]);
    expect(justified).toEqual(manifest.permissions);
    for (const permission of manifest.permissions) expect(privacy).toContain(`\`${permission}\``);
    for (const host of manifest.host_permissions) expect(practices).toContain(host);
    for (const host of hosts) expect(privacy).toContain(host);
  });

  it('point to the published policy', () => {
    expect(practices).toContain('https://gucchin.github.io/thread-to-markdown-for-x/PRIVACY.html');
  });
});
