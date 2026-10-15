/**
 * Attaches CSS to a shadow root. Prefers a constructable stylesheet; falls back to a <style>
 * element where that is unsupported (jsdom). Isolated in the shadow root, so X's CSS and ours
 * cannot affect each other.
 */
export function applyStyles(shadow: ShadowRoot, css: string): void {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    shadow.adoptedStyleSheets = [sheet];
    return;
  } catch {
    // Fall through to <style>.
  }
  const style = shadow.ownerDocument.createElement('style');
  style.textContent = css;
  shadow.append(style);
}
