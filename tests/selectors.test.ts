import { describe, expect, it } from 'vitest';
import manifest from '../src/manifest.json';
import { SELECTORS, STATUS_PATH_PATTERN, X_HOSTS } from '../src/content/extract/selectors';

describe('SELECTORS', () => {
  const values = Object.values(SELECTORS);

  it('are all valid CSS selectors', () => {
    for (const selector of values) {
      expect(() => document.querySelector(selector), selector).not.toThrow();
    }
  });

  // Guards PLAN.md §7.1: these break when X redeploys or switches UI language.
  it.each(values)(
    '%s avoids obfuscated classes, aria-label and structural position',
    (selector) => {
      expect(selector).not.toMatch(/\.(css|r)-[a-z0-9]+/i);
      expect(selector).not.toMatch(/aria-label/i);
      expect(selector).not.toMatch(/:nth-(child|of-type)/);
      expect(selector).not.toMatch(/:contains/);
    },
  );
});

describe('STATUS_PATH_PATTERN', () => {
  it.each([
    ['/someone/status/1234567890', 'someone', '1234567890'],
    ['/some_one_99/status/1234567890/photo/1', 'some_one_99', '1234567890'],
    ['/someone/status/1234567890/analytics', 'someone', '1234567890'],
  ])('matches %s', (path, handle, id) => {
    const match = STATUS_PATH_PATTERN.exec(path);
    expect(match?.[1]).toBe(handle);
    expect(match?.[2]).toBe(id);
  });

  it.each(['/home', '/someone', '/someone/with_replies', '/search?q=status'])(
    'does not match %s',
    (path) => {
      expect(STATUS_PATH_PATTERN.test(path)).toBe(false);
    },
  );
});

describe('X_HOSTS', () => {
  it('matches the hosts in manifest.json', () => {
    expect(X_HOSTS.map((host) => `https://${host}/*`)).toEqual(manifest.host_permissions);
  });
});
