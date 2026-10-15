// Output options (PLAN.md §1.2, §8): stored in chrome.storage.sync. Only these values are stored,
// never extracted posts (PLAN.md §10).

/** Which posts make up the thread: the main post's author only, or every post from the main post on. */
export type ThreadMode = 'author' | 'all';
/** Image size requested via the `name` query parameter of pbs.twimg.com/media URLs. */
export type ImageResolution = 'large' | 'orig';
/** How each post's date and URL are written: an HTML comment, or a normal line. */
export type MetaFormat = 'comment' | 'line';

export interface Settings {
  mode: ThreadMode;
  /** Prepend the Obsidian YAML frontmatter (PLAN.md §8.2). */
  frontmatter: boolean;
  resolution: ImageResolution;
  metaFormat: MetaFormat;
  /** Scroll down to collect posts beyond the screen before copying (PLAN.md §7.6). */
  autoScroll: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  mode: 'author',
  frontmatter: false,
  resolution: 'large',
  metaFormat: 'comment',
  autoScroll: false,
});

/** Everything is stored under this one key, so unknown keys from other versions are ignored. */
export const SETTINGS_KEY = 'settings';

/** The part of chrome.storage.StorageArea used here (injected for tests). */
export interface SettingsStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

const CHOICES = {
  mode: ['author', 'all'],
  resolution: ['large', 'orig'],
  metaFormat: ['comment', 'line'],
} as const satisfies Partial<Record<keyof Settings, readonly string[]>>;

/** Keeps each valid field of `raw` and fills the rest with the defaults. Never throws. */
export function normalizeSettings(raw: unknown): Settings {
  const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const flag = (key: 'frontmatter' | 'autoScroll'): boolean => {
    const v = value[key];
    return typeof v === 'boolean' ? v : DEFAULT_SETTINGS[key];
  };
  const pick = <K extends keyof typeof CHOICES>(key: K): Settings[K] => {
    const v = value[key];
    return (CHOICES[key] as readonly unknown[]).includes(v)
      ? (v as Settings[K])
      : DEFAULT_SETTINGS[key];
  };
  return {
    mode: pick('mode'),
    frontmatter: flag('frontmatter'),
    resolution: pick('resolution'),
    metaFormat: pick('metaFormat'),
    autoScroll: flag('autoScroll'),
  };
}

/** The stored settings, or the defaults when storage is unavailable or holds invalid values. */
export async function loadSettings(storage: SettingsStorage): Promise<Settings> {
  try {
    return normalizeSettings((await storage.get(SETTINGS_KEY))[SETTINGS_KEY]);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Merges `patch` into the stored settings and resolves with the saved result. */
export async function saveSettings(
  storage: SettingsStorage,
  patch: Partial<Settings>,
): Promise<Settings> {
  const next = normalizeSettings({ ...(await loadSettings(storage)), ...patch });
  await storage.set({ [SETTINGS_KEY]: next });
  return next;
}
