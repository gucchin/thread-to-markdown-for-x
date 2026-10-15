import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  normalizeSettings,
  saveSettings,
  SETTINGS_KEY,
} from '../src/shared/settings';
import { memoryStorage } from './helpers/storage';

describe('normalizeSettings', () => {
  it('uses the defaults for missing or non-object input', () => {
    for (const raw of [undefined, null, 'x', 1, []]) {
      expect(normalizeSettings(raw)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('has the documented defaults', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      mode: 'author',
      frontmatter: false,
      resolution: 'large',
      metaFormat: 'comment',
      autoScroll: false,
    });
  });

  it('keeps every valid value', () => {
    const all = {
      mode: 'all',
      frontmatter: true,
      resolution: 'orig',
      metaFormat: 'line',
      autoScroll: true,
    };
    expect(normalizeSettings(all)).toEqual(all);
  });

  it('replaces each invalid field with its default and drops unknown keys', () => {
    expect(
      normalizeSettings({
        mode: 'everyone',
        frontmatter: 'yes',
        resolution: 'orig',
        metaFormat: 42,
        autoScroll: 1,
        extra: 1,
      }),
    ).toEqual({ ...DEFAULT_SETTINGS, resolution: 'orig' });
  });
});

describe('loadSettings / saveSettings', () => {
  it('loads the defaults from empty storage', async () => {
    expect(await loadSettings(memoryStorage().storage)).toEqual(DEFAULT_SETTINGS);
  });

  it('loads the defaults when storage fails', async () => {
    const storage = {
      get: () => Promise.reject(new Error('quota')),
      set: () => Promise.resolve(),
    };
    expect(await loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });

  it('merges a change into the stored settings under one key', async () => {
    const { storage, data } = memoryStorage({ [SETTINGS_KEY]: { mode: 'all' } });
    const saved = await saveSettings(storage, { frontmatter: true });
    expect(saved).toEqual({ ...DEFAULT_SETTINGS, mode: 'all', frontmatter: true });
    expect(data).toEqual({ [SETTINGS_KEY]: saved });
    expect(await loadSettings(storage)).toEqual(saved);
  });

  it('does not store invalid values', async () => {
    const { storage, data } = memoryStorage();
    // @ts-expect-error: values from the form are strings, checked at runtime
    await saveSettings(storage, { resolution: 'huge' });
    expect(data[SETTINGS_KEY]).toEqual(DEFAULT_SETTINGS);
  });
});
