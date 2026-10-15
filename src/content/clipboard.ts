// Copies text to the clipboard with fallbacks (PLAN.md §9.1).
// 1. navigator.clipboard.writeText — fails when the page has no focus (e.g. started from the popup).
// 2. a temporary <textarea> + document.execCommand('copy').
// A third step (offscreen document) was found unnecessary in ticket 019: steps 1-2 work from all three entry points.

export type CopyResult =
  { ok: true; method: 'clipboard-api' | 'exec-command' } | { ok: false; error: string };

export interface ClipboardEnv {
  clipboard?: Pick<Clipboard, 'writeText'>;
  document: Document;
}

export async function copyText(
  text: string,
  env: ClipboardEnv = { clipboard: navigator.clipboard, document },
): Promise<CopyResult> {
  const errors: string[] = [];
  if (env.clipboard) {
    try {
      await env.clipboard.writeText(text);
      return { ok: true, method: 'clipboard-api' };
    } catch (error) {
      errors.push(`clipboard API: ${describe(error)}`);
    }
  } else {
    errors.push('clipboard API: unavailable');
  }

  try {
    if (copyWithTextarea(text, env.document)) return { ok: true, method: 'exec-command' };
    errors.push('execCommand: returned false');
  } catch (error) {
    errors.push(`execCommand: ${describe(error)}`);
  }
  return { ok: false, error: errors.join('; ') };
}

/** Copies via a hidden, temporary <textarea>. Restores focus and always removes the element. */
function copyWithTextarea(text: string, doc: Document): boolean {
  const previousFocus = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
  const textarea = doc.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  Object.assign(textarea.style, { position: 'fixed', top: '0', left: '-9999px', opacity: '0' });
  (doc.body ?? doc.documentElement).append(textarea);
  try {
    textarea.focus();
    textarea.select();
    // Deprecated but still the only synchronous fallback in content scripts.
    return typeof doc.execCommand === 'function' && doc.execCommand('copy');
  } finally {
    textarea.remove();
    previousFocus?.focus();
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
