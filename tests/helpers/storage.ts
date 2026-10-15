import type { SettingsStorage } from '../../src/shared/settings';

/** In-memory stand-in for chrome.storage.sync. `data` is the stored state. */
export function memoryStorage(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = structuredClone(initial);
  const storage: SettingsStorage = {
    get: async (key) => (key in data ? { [key]: structuredClone(data[key]) } : {}),
    set: async (items) => {
      Object.assign(data, structuredClone(items));
    },
  };
  return { storage, data };
}
