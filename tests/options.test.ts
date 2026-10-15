import { beforeEach, describe, expect, it } from 'vitest';
import { initOptions, TEXT } from '../src/options/optionsController';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from '../src/shared/settings';
import { memoryStorage } from './helpers/storage';
import optionsHtml from '../src/options/options.html?raw';

function loadPage(): Document {
  return new DOMParser().parseFromString(optionsHtml, 'text/html');
}

const input = (doc: Document, name: string, value?: string) =>
  doc.querySelector<HTMLInputElement>(
    value === undefined ? `input[name="${name}"]` : `input[name="${name}"][value="${value}"]`,
  )!;

/** Ticks the control as a user would and waits for the save to finish. */
async function choose(doc: Document, control: HTMLInputElement, checked = true) {
  control.checked = checked;
  control.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('options page', () => {
  let doc: Document;
  beforeEach(() => {
    doc = loadPage();
  });

  it('has a control for every setting', () => {
    for (const [name, values] of [
      ['mode', ['author', 'all']],
      ['resolution', ['large', 'orig']],
      ['metaFormat', ['comment', 'line']],
    ] as const) {
      for (const value of values) expect(input(doc, name, value).type).toBe('radio');
    }
    expect(input(doc, 'frontmatter').type).toBe('checkbox');
    expect(input(doc, 'autoScroll').type).toBe('checkbox');
  });

  it('shows the defaults when nothing is stored', async () => {
    await initOptions(doc, memoryStorage().storage);
    expect(input(doc, 'mode', 'author').checked).toBe(true);
    expect(input(doc, 'resolution', 'large').checked).toBe(true);
    expect(input(doc, 'metaFormat', 'comment').checked).toBe(true);
    expect(input(doc, 'frontmatter').checked).toBe(false);
    expect(input(doc, 'autoScroll').checked).toBe(false);
  });

  it('shows the stored settings', async () => {
    const stored = { mode: 'all', frontmatter: true, resolution: 'orig', metaFormat: 'line' };
    await initOptions(doc, memoryStorage({ [SETTINGS_KEY]: stored }).storage);
    expect(input(doc, 'mode', 'all').checked).toBe(true);
    expect(input(doc, 'mode', 'author').checked).toBe(false);
    expect(input(doc, 'resolution', 'orig').checked).toBe(true);
    expect(input(doc, 'metaFormat', 'line').checked).toBe(true);
    expect(input(doc, 'frontmatter').checked).toBe(true);
  });

  it('saves each change at once and survives a reload', async () => {
    const { storage, data } = memoryStorage();
    await initOptions(doc, storage);
    await choose(doc, input(doc, 'mode', 'all'));
    await choose(doc, input(doc, 'frontmatter'));
    expect(data[SETTINGS_KEY]).toEqual({ ...DEFAULT_SETTINGS, mode: 'all', frontmatter: true });
    expect(doc.getElementById('status')?.textContent).toBe(TEXT.saved);

    const reloaded = loadPage();
    await initOptions(reloaded, storage);
    expect(input(reloaded, 'mode', 'all').checked).toBe(true);
    expect(input(reloaded, 'frontmatter').checked).toBe(true);
  });

  it('keeps both of two quick changes', async () => {
    const { storage, data } = memoryStorage();
    await initOptions(doc, storage);
    // No await in between: the second save starts before the first one is written.
    input(doc, 'resolution', 'orig').checked = true;
    input(doc, 'resolution', 'orig').dispatchEvent(new Event('change', { bubbles: true }));
    await choose(doc, input(doc, 'metaFormat', 'line'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(data[SETTINGS_KEY]).toMatchObject({ resolution: 'orig', metaFormat: 'line' });
  });

  it('reports a failed save', async () => {
    const { storage } = memoryStorage();
    storage.set = () => Promise.reject(new Error('quota'));
    await initOptions(doc, storage);
    await choose(doc, input(doc, 'frontmatter'));
    expect(doc.getElementById('status')?.textContent).toBe(TEXT.saveFailed);
    expect(doc.getElementById('status')?.dataset.kind).toBe('error');
  });
});
