import { describe, expect, it } from 'vitest';
import svg from '../assets/icon.svg?raw';
import { ICON_SIZES, encodePng, parseIcon, rasterize, renderIcons } from '../scripts/icon.mjs';

const BACKGROUND = [0x43, 0x38, 0xca];
const WHITE = [255, 255, 255];

function pixel(pixels: Uint8Array, size: number, x: number, y: number): number[] {
  const i = (y * size + x) * 4;
  return [...pixels.subarray(i, i + 4)];
}

describe('parseIcon', () => {
  it('reads the shapes of the icon in paint order, inheriting the group fill', () => {
    const icon = parseIcon(svg);
    expect(icon.viewBox).toEqual([128, 128]);
    expect(icon.shapes).toHaveLength(8);
    expect(icon.shapes[0]).toEqual({
      kind: 'rect',
      x: 0,
      y: 0,
      w: 128,
      h: 128,
      rx: 28,
      fill: BACKGROUND,
    });
    expect(icon.shapes.slice(1).every((s) => s.fill.join() === WHITE.join())).toBe(true);
  });

  it('rejects elements it cannot render, so the PNGs never silently differ from the SVG', () => {
    expect(() => parseIcon('<svg viewBox="0 0 8 8"><path d="M0 0h8"/></svg>')).toThrow(/<path>/);
    expect(() =>
      parseIcon('<svg viewBox="0 0 8 8"><rect width="8" height="8" fill="red"/></svg>'),
    ).toThrow(/#rrggbb/);
    expect(() =>
      parseIcon('<svg viewBox="0 0 8 8"><circle cx="4" cy="4" fill="#000000"/></svg>'),
    ).toThrow(/numeric r/);
    expect(() => parseIcon('<svg><rect width="8" height="8" fill="#000000"/></svg>')).toThrow(
      /viewBox/,
    );
  });

  it('ignores comments', () => {
    const icon = parseIcon(
      '<svg viewBox="0 0 8 8"><!-- <path/> --><rect width="8" height="8" fill="#000000"/></svg>',
    );
    expect(icon.shapes).toHaveLength(1);
  });
});

describe('rasterize', () => {
  const size = 128;
  const pixels = rasterize(parseIcon(svg), size);

  it('leaves the rounded corners transparent', () => {
    expect(pixel(pixels, size, 0, 0)[3]).toBe(0);
    expect(pixel(pixels, size, 127, 127)[3]).toBe(0);
  });

  it('paints the background and the thread dots', () => {
    expect(pixel(pixels, size, 64, 4)).toEqual([...BACKGROUND, 255]); // top edge, between the corners
    expect(pixel(pixels, size, 40, 64)).toEqual([...WHITE, 255]); // middle dot
    expect(pixel(pixels, size, 40, 49)).toEqual([...WHITE, 255]); // line between the dots
    expect(pixel(pixels, size, 80, 64)).toEqual([...WHITE, 255]); // middle text line
    expect(pixel(pixels, size, 80, 50)).toEqual([...BACKGROUND, 255]); // gap between text lines
  });

  it('antialiases edges with partial alpha', () => {
    const edge = rasterize(
      parseIcon('<svg viewBox="0 0 2 2"><rect width="1" height="2" fill="#000000"/></svg>'),
      3,
    );
    expect(pixel(edge, 3, 0, 1)[3]).toBe(255);
    expect(pixel(edge, 3, 1, 1)[3]).toBe(128); // the pixel straddles x = 1
    expect(pixel(edge, 3, 2, 1)[3]).toBe(0);
  });
});

describe('encodePng / renderIcons', () => {
  it('writes a PNG of the requested size', () => {
    const png = encodePng(new Uint8Array(4 * 4 * 4), 4);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect(png.readUInt32BE(16)).toBe(4);
    expect(png.readUInt32BE(20)).toBe(4);
    expect(png.subarray(-8, -4).toString('ascii')).toBe('IEND');
  });

  it('renders every size the manifest uses', () => {
    const icons = renderIcons(svg);
    expect(Object.keys(icons)).toEqual(ICON_SIZES.map((s) => `icon${s}.png`));
    for (const size of ICON_SIZES) {
      expect(icons[`icon${size}.png`]?.readUInt32BE(16)).toBe(size);
    }
  });
});
