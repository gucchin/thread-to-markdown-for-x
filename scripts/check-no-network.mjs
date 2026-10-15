// Fails if any source under src/ uses fetch( or XMLHttpRequest.
// The extension must make zero network requests (PLAN.md §10).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const patterns = [/\bfetch\s*\(/, /\bXMLHttpRequest\b/];
const extensions = /\.(ts|js|mjs|html)$/;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (extensions.test(entry.name)) yield path;
  }
}

const hits = [];
for (const file of walk(src)) {
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (patterns.some((p) => p.test(line))) {
        hits.push(`${relative(root, file)}:${i + 1}: ${line.trim()}`);
      }
    });
}

if (hits.length > 0) {
  console.error('Network APIs are forbidden in src/ (PLAN.md §10):');
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log('check:no-network passed (no fetch( / XMLHttpRequest in src/)');
