// Binds form controls named after Settings keys (radio buttons for choices, checkboxes for flags)
// to the stored settings. Shared by the options page and the popup.
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
  type SettingsStorage,
} from './settings';

export interface SettingsForm {
  /** Resolves once every change made so far is stored (or has failed). */
  saved(): Promise<void>;
}

/**
 * Shows the stored settings in the controls under `root` and saves every change at once.
 * `onSave` reports each save's outcome. Resolves once the controls are filled.
 */
export async function bindSettingsForm(
  root: ParentNode,
  storage: SettingsStorage,
  onSave: (ok: boolean) => void = () => {},
): Promise<SettingsForm> {
  const inputs = [...root.querySelectorAll('input')].filter((input) => isField(input.name));
  const settings = await loadSettings(storage);
  for (const input of inputs) {
    const value = settings[input.name as keyof Settings];
    input.checked = input.type === 'checkbox' ? value === true : input.value === value;
  }

  // Saves run one after another: each reads the stored settings and writes them back, so two
  // overlapping saves could otherwise drop one of the changes.
  let queue = Promise.resolve();
  for (const input of inputs) {
    input.addEventListener('change', () => {
      if (input.type === 'radio' && !input.checked) return;
      // Values are checked by saveSettings (normalizeSettings); invalid ones fall back.
      const patch = { [input.name]: input.type === 'checkbox' ? input.checked : input.value };
      queue = queue
        .then(() => saveSettings(storage, patch))
        .then(
          () => onSave(true),
          () => onSave(false),
        );
    });
  }
  return { saved: () => queue };
}

function isField(name: string): boolean {
  return Object.hasOwn(DEFAULT_SETTINGS, name);
}
