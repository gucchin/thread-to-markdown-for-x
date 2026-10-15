// Rasterizes assets/icon.svg into PNG icons without dependencies (PLAN.md §16.2).
// Only the subset the icon uses is supported — <rect> (x, y, width, height, rx) and <circle>
// (cx, cy, r) filled with #rrggbb, optionally inherited from <g fill> — and anything else
// throws, so the PNGs can never silently differ from the SVG. Edges are antialiased by
// supersampling.
import { crc32, deflateSync } from 'node:zlib';

export const ICON_SIZES = [16, 32, 48, 128];

const SUPERSAMPLE = 8;

/** Parses the supported SVG subset into { viewBox: [w, h], shapes: [...] } in paint order. */
export function parseIcon(svg) {
  const text = svg.replace(/<!--[\s\S]*?-->/g, '');
  const viewBox = /<svg\b[^>]*\bviewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(text);
  if (!viewBox) throw new Error('icon: <svg viewBox="0 0 W H"> is required');
  const fills = [];
  const shapes = [];
  for (const [, closing, tag, attrText] of text.matchAll(/<(\/?)([a-zA-Z]+)\b([^>]*)>/g)) {
    if (tag === 'svg') continue;
    if (tag === 'g') {
      if (closing) fills.pop();
      else fills.push(attrs(attrText).fill ?? fills.at(-1));
      continue;
    }
    if (tag !== 'rect' && tag !== 'circle') throw new Error(`icon: unsupported element <${tag}>`);
    const a = attrs(attrText);
    const fill = color(a.fill ?? fills.at(-1));
    const num = (name, fallback) => {
      const value = a[name] ?? fallback;
      if (value === undefined || !/^-?[\d.]+$/.test(value)) {
        throw new Error(`icon: <${tag}> needs a numeric ${name}`);
      }
      return Number(value);
    };
    shapes.push(
      tag === 'rect'
        ? {
            kind: 'rect',
            x: num('x', '0'),
            y: num('y', '0'),
            w: num('width'),
            h: num('height'),
            rx: num('rx', '0'),
            fill,
          }
        : { kind: 'circle', cx: num('cx'), cy: num('cy'), r: num('r'), fill },
    );
  }
  return { viewBox: [Number(viewBox[1]), Number(viewBox[2])], shapes };
}

function attrs(text) {
  return Object.fromEntries([...text.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
}

function color(value) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value ?? '');
  if (!m) throw new Error(`icon: fill must be #rrggbb (got ${value})`);
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function covers(shape, px, py) {
  if (shape.kind === 'circle') return (px - shape.cx) ** 2 + (py - shape.cy) ** 2 <= shape.r ** 2;
  const { x, y, w, h } = shape;
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const r = Math.min(shape.rx, w / 2, h / 2);
  const dx = Math.max(x + r - px, 0, px - (x + w - r));
  const dy = Math.max(y + r - py, 0, py - (y + h - r));
  return dx * dx + dy * dy <= r * r;
}

/** Renders the icon to straight-alpha RGBA pixels of size × size. */
export function rasterize(icon, size) {
  const [vw, vh] = icon.viewBox;
  const pixels = new Uint8Array(size * size * 4);
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const px = ((x + (sx + 0.5) / SUPERSAMPLE) / size) * vw;
          const py = ((y + (sy + 0.5) / SUPERSAMPLE) / size) * vh;
          let fill = null;
          for (const shape of icon.shapes) if (covers(shape, px, py)) fill = shape.fill;
          if (!fill) continue;
          r += fill[0];
          g += fill[1];
          b += fill[2];
          covered++;
        }
      }
      const i = (y * size + x) * 4;
      if (covered > 0) {
        pixels[i] = Math.round(r / covered);
        pixels[i + 1] = Math.round(g / covered);
        pixels[i + 2] = Math.round(b / covered);
        pixels[i + 3] = Math.round((covered / samples) * 255);
      }
    }
  }
  return pixels;
}

/** Encodes RGBA pixels as a PNG (8-bit RGBA, no filtering). */
export function encodePng(pixels, size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    Buffer.from(pixels.buffer, pixels.byteOffset + y * size * 4, size * 4).copy(
      raw,
      y * (size * 4 + 1) + 1,
    );
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // bit depth 8, RGBA, deflate, no filter method, no interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** Returns { 'icon16.png': Buffer, ... } for every size in ICON_SIZES. */
export function renderIcons(svg) {
  const icon = parseIcon(svg);
  return Object.fromEntries(
    ICON_SIZES.map((size) => [`icon${size}.png`, encodePng(rasterize(icon, size), size)]),
  );
}
