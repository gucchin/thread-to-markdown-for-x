// Bundles the extension into dist/ with esbuild.
// Content script, popup and options page are IIFE (classic scripts); the service worker is ESM
// because manifest.json declares it with "type": "module".
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderIcons } from './icon.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');

const common = {
  bundle: true,
  target: 'chrome120',
  legalComments: 'none',
  logLevel: 'info',
};

// Files copied to dist/ as-is: [source relative to src/, destination relative to dist/]
const staticFiles = [
  ['manifest.json', 'manifest.json'],
  ['popup/popup.html', 'popup.html'],
  ['popup/popup.css', 'popup.css'],
  ['options/options.html', 'options.html'],
  ['options/options.css', 'options.css'],
];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await Promise.all([
  build({
    ...common,
    entryPoints: {
      content: join(src, 'content/index.ts'),
      popup: join(src, 'popup/popup.ts'),
      options: join(src, 'options/options.ts'),
    },
    outdir: dist,
    format: 'iife',
  }),
  build({
    ...common,
    entryPoints: { sw: join(src, 'background/sw.ts') },
    outdir: dist,
    format: 'esm',
  }),
]);

for (const [from, to] of staticFiles) {
  cpSync(join(src, from), join(dist, to));
}

// PNG icons are rendered from the SVG source on every build, so they cannot drift from it.
mkdirSync(join(dist, 'icons'));
for (const [name, png] of Object.entries(
  renderIcons(readFileSync(join(root, 'assets/icon.svg'), 'utf8')),
)) {
  writeFileSync(join(dist, 'icons', name), png);
}

console.log(`Built extension into ${dist}`);
