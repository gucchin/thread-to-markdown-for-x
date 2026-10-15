import { describe, expect, it } from 'vitest';

// Only anonymized fixtures may be committed (CLAUDE.md). .gitignore excludes tests/fixtures/raw/,
// but a raw snapshot saved one directory up by mistake would not be ignored; this fails it instead.
// scripts/anonymize.mjs rewrites the page URL to user1, every post ID to 1000000000000000NNN and
// drops the class attributes, none of which holds for a snapshot taken from x.com.
// The other checks pin down values the anonymizer once missed (docs/003): the logged-in account's
// name on the reply box avatar, engagement counts outside the transition container, link card and
// article text, and links to other sites with tracking parameters.
const fixtures = import.meta.glob('./fixtures/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('committed fixtures', () => {
  it('are all present', () => {
    expect(Object.keys(fixtures).length).toBeGreaterThanOrEqual(11);
  });

  for (const [path, html] of Object.entries(fixtures)) {
    describe(path, () => {
      it('starts with the anonymized page URL', () => {
        expect(html).toMatch(
          /^<!-- url: https:\/\/x\.com\/user1\/status\/1000000000000000\d{3} -->\n/,
        );
      });

      it('contains only anonymized post IDs', () => {
        const ids = [...html.matchAll(/\/status\/(\d+)/g)].map((m) => m[1]);
        expect(ids.length).toBeGreaterThan(0);
        expect(ids.filter((id) => !/^1000000000000000\d{3}$/.test(id ?? ''))).toEqual([]);
      });

      it('has no class attributes', () => {
        expect(html).not.toMatch(/\sclass="/);
      });

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const texts = (el: Element) => {
        const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const out: string[] = [];
        while (walker.nextNode()) out.push(walker.currentNode.textContent ?? '');
        return out;
      };

      it('names avatars only with dummy names', () => {
        const labels = [...doc.querySelectorAll('[data-testid^="UserAvatar-Container-"]')].flatMap(
          (avatar) =>
            [...avatar.querySelectorAll('[aria-label], [alt]')].flatMap((el) => [
              el.getAttribute('aria-label') ?? '',
              el.getAttribute('alt') ?? '',
            ]),
        );
        expect(labels.filter((l) => l && !/^User \d+$/.test(l))).toEqual([]);
      });

      it('shows no engagement count other than 1', () => {
        const counts = [...doc.querySelectorAll('[role="group"]')]
          .flatMap(texts)
          .flatMap((t) => t.match(/\d[\d.,]*/g) ?? []);
        expect(counts.filter((n) => n !== '1')).toEqual([]);
      });

      it('replaces link card and article text with dummy words', () => {
        const blocks = [
          ...doc.querySelectorAll('[data-testid="card.wrapper"]'),
          ...[...doc.querySelectorAll('[data-testid="article-cover-image"]')].map(
            (cover) => cover.parentElement!,
          ),
        ];
        const covers = [...doc.querySelectorAll('[data-testid="article-cover-image"]')];
        const words = blocks
          .flatMap(texts)
          .filter((t) => !covers.some((c) => c.textContent?.includes(t)))
          .filter((t) => !/^[a-z\s]*$/.test(t));
        expect(words).toEqual([]);
      });

      it('links to other sites only through dummies', () => {
        const external = [...doc.querySelectorAll('[href]')]
          .map((el) => el.getAttribute('href') ?? '')
          .filter((href) => /^https?:\/\//.test(href))
          .filter(
            (href) =>
              !/^https?:\/\/(?:[a-z0-9-]+\.)*(?:x\.com|twitter\.com|t\.co|twimg\.com)(?:[/?#]|$)/.test(
                href,
              ),
          );
        expect(
          external.filter((href) => !/^https:\/\/example\.com\/external\d+$/.test(href)),
        ).toEqual([]);
        expect(html).not.toMatch(/twclid=/i);
      });
    });
  }
});
