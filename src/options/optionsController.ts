// Options page behaviour (PLAN.md §1.2), separated from the Chrome APIs so it can be tested.
// Every change is saved at once; there is no Save button.
import type { SettingsStorage } from '../shared/settings';
import { bindSettingsForm } from '../shared/settingsForm';

export const TEXT = {
  saved: 'Saved.',
  saveFailed: 'Could not save the settings.',
} as const;

/** Shows the stored settings in the form and saves every change. Resolves once the form is filled. */
export async function initOptions(doc: Document, storage: SettingsStorage): Promise<void> {
  const form = doc.getElementById('settings');
  const status = doc.getElementById('status');
  if (!(form instanceof HTMLFormElement) || !status) {
    throw new Error('options.html is missing #settings or #status');
  }
  await bindSettingsForm(form, storage, (ok) => {
    status.textContent = ok ? TEXT.saved : TEXT.saveFailed;
    status.dataset.kind = ok ? 'success' : 'error';
  });
}
