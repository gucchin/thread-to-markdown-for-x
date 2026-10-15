import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import { ICON_SIZES } from '../scripts/icon.mjs';
import manifest from '../src/manifest.json';

// Guards the minimal-permission policy (PLAN.md §4). Adding a permission must be a deliberate change here.
describe('manifest.json', () => {
  it('requests only storage and clipboardWrite', () => {
    expect(manifest.permissions).toEqual(['storage', 'clipboardWrite']);
  });

  it('limits host access to x.com and twitter.com', () => {
    expect(manifest.host_permissions).toEqual(['https://x.com/*', 'https://twitter.com/*']);
    expect(manifest.content_scripts[0]?.matches).toEqual(manifest.host_permissions);
  });

  it('has an options page that the build copies to dist/', () => {
    expect(manifest.options_ui).toEqual({ page: 'options.html', open_in_tab: false });
  });

  it('runs the service worker as a module', () => {
    expect(manifest.background).toEqual({ service_worker: 'sw.js', type: 'module' });
  });

  it('uses the store name and the package version', () => {
    expect(manifest.name).toBe('Thread to Markdown for X');
    expect(manifest.version).toBe(pkg.version);
    // The build targets chrome120 (scripts/build.mjs).
    expect(manifest.minimum_chrome_version).toBe('120');
  });

  it('declares only icons that the build renders', () => {
    const rendered = ICON_SIZES.map((size) => `icons/icon${size}.png`);
    expect(Object.values(manifest.icons)).toEqual(rendered);
    expect(Object.keys(manifest.icons)).toEqual(ICON_SIZES.map(String));
    for (const path of Object.values(manifest.action.default_icon)) {
      expect(rendered).toContain(path);
    }
  });
});

describe('test environment', () => {
  it('provides a jsdom document', () => {
    document.body.textContent = 'ok';
    expect(document.body.textContent).toBe('ok');
  });
});
