/**
 * Generates the PWA icons referenced by the manifest.
 *   node scripts/generateIcons.js
 *
 * Kept as a script (rather than committing only the binaries) so the icons can
 * be regenerated if the brand colour or mark changes.
 *
 * The maskable variant needs its artwork inside the safe zone - Android crops
 * maskable icons to a circle on many launchers, so the mark is drawn smaller
 * with generous padding while the standard icons fill more of the canvas.
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public');

const BRAND = '#22c55e';
const DARK = '#101828';

// Shop front: awning stripes over a storefront, readable at 48px
const mark = (scale) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <path d="M118 196h276v186a16 16 0 0 1-16 16H134a16 16 0 0 1-16-16z" fill="#ffffff"/>
    <path d="M104 128h304l26 68H78z" fill="#ffffff"/>
    <path d="M170 196h58v68h-58zm114 0h58v68h-58z" fill="${BRAND}"/>
    <path d="M222 300h68v98h-68z" fill="${BRAND}"/>
  </g>
`;

const svg = (scale, rounded) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rounded ? 96 : 0}" fill="${DARK}"/>
  ${mark(scale)}
</svg>`;

const targets = [
  { file: 'pwa-192x192.png', size: 192, scale: 1, rounded: true },
  { file: 'pwa-512x512.png', size: 512, scale: 1, rounded: true },
  // Maskable: mark shrunk to ~72% so a circular crop never clips it
  { file: 'pwa-maskable-512x512.png', size: 512, scale: 0.72, rounded: false },
  { file: 'apple-touch-icon.png', size: 180, scale: 1, rounded: true },
];

mkdirSync(publicDir, { recursive: true });

const run = async () => {
  for (const t of targets) {
    const out = resolve(publicDir, t.file);
    await sharp(Buffer.from(svg(t.scale, t.rounded))).resize(t.size, t.size).png().toFile(out);
    console.log(`generated ${t.file} (${t.size}x${t.size})`);
  }

  // favicon.svg shares the same mark so the browser tab matches the installed app
  writeFileSync(resolve(publicDir, 'favicon.svg'), svg(1, true).trim());
  console.log('generated favicon.svg');
};

run().catch((err) => {
  console.error(`Icon generation failed: ${err.message}`);
  process.exit(1);
});
