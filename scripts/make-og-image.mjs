// Rasterizes the brand SVGs to the PNGs used for social sharing + touch icons.
//
// macOS-only — uses the built-in `qlmanage` (Quick Look) + `sips`, so there are no
// extra npm dependencies. The generated PNGs are committed, so a normal build/deploy
// does NOT need to run this. Re-run it only when the source SVG art changes:
//
//   npm run build:og
//
import { execFileSync } from 'node:child_process';
import { mkdtempSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pub = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'public');

/**
 * Render an SVG to a PNG. qlmanage renders into a square `size`×`size` canvas
 * (named `<file>.png`); pass `crop` to center-crop that square down to an exact
 * width×height (used for the 1200×630 social card).
 */
function rasterize(svgName, outName, size, crop) {
  const svg = join(pub, svgName);
  if (!existsSync(svg)) throw new Error(`missing source: ${svg}`);
  const out = join(pub, outName);
  const dir = mkdtempSync(join(tmpdir(), 'photoduck-og-'));
  try {
    execFileSync('qlmanage', ['-t', '-s', String(size), '-o', dir, svg], { stdio: 'ignore' });
    copyFileSync(join(dir, `${basename(svg)}.png`), out);
    if (crop) execFileSync('sips', ['-c', String(crop.h), String(crop.w), out], { stdio: 'ignore' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(`✓ public/${outName}`);
}

rasterize('og-image.svg', 'og-image.png', 1200, { w: 1200, h: 630 });
rasterize('favicon.svg', 'apple-touch-icon.png', 180); // square source -> 180×180, no crop

console.log('\nDone. Remember to commit the PNGs in public/.');
