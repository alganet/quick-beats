// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

/**
 * Script to generate Icons.jsx from SVG files in public/
 * Converts public/logo.svg into an inline SVG symbol for the icon sprite,
 * and rasterizes it into the PWA icon set (192/512/maskable/apple-touch).
 *
 * Usage: node scripts/generate-icons.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/**
 * Convert an SVG file to a <symbol> element for use in an SVG sprite
 */
function svgToSymbol(svgContent, symbolId) {
    // Extract viewBox from the SVG
    const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 64 64';

    // Extract the inner content (everything between <svg> and </svg>)
    const innerMatch = svgContent.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
    if (!innerMatch) {
        throw new Error('Could not parse SVG content');
    }

    let innerContent = innerMatch[1];

    // Remove <defs> section (gradients, etc.) - we'll handle colors directly
    innerContent = innerContent.replace(/<defs>[\s\S]*?<\/defs>/g, '');

    // Convert HTML attributes to JSX (kebab-case to camelCase)
    innerContent = innerContent
        .replace(/stroke-width=/g, 'strokeWidth=')
        .replace(/stroke-linecap=/g, 'strokeLinecap=')
        .replace(/stroke-linejoin=/g, 'strokeLinejoin=')
        .replace(/fill-rule=/g, 'fillRule=')
        .replace(/clip-rule=/g, 'clipRule=')
        .replace(/stop-color=/g, 'stopColor=')
        .replace(/stop-opacity=/g, 'stopOpacity=');

    // Indent the content properly
    const indentedContent = innerContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `            ${line}`)
        .join('\n');

    return `        <symbol id="icon-${symbolId}" viewBox="${viewBox}">\n${indentedContent}\n        </symbol>`;
}

// Read the logo SVG
const logoPath = join(ROOT, 'public', 'logo.svg');
const logoSvg = readFileSync(logoPath, 'utf-8');

// Convert to symbol
const logoSymbol = svgToSymbol(logoSvg, 'logo');

// Read the current Icons.jsx
const iconsPath = join(ROOT, 'src', 'components', 'Icons.jsx');
const iconsContent = readFileSync(iconsPath, 'utf-8');

// Replace the logo symbol
const symbolRegex = /<symbol id="icon-logo"[\s\S]*?<\/symbol>/;
const newIconsContent = iconsContent.replace(symbolRegex, logoSymbol.trim());

// Write the updated file
writeFileSync(iconsPath, newIconsContent);

console.log('✓ Generated Icons.jsx from public/logo.svg');

// --- PWA icon set ---------------------------------------------------------
// Rasterize logo.svg into the PNGs referenced by manifest.webmanifest and the
// apple-touch-icon. Kept here so public/logo.svg stays the single source of
// truth (like Icons.jsx above). The logo's circle background is #141414.
const BG = '#141414'; // logo background / manifest theme_color
const logoBuffer = Buffer.from(logoSvg);

// "any" icons: the SVG already has its own dark circle, so render as-is on a
// transparent canvas at the target size.
async function renderPlain(size, outName) {
    await sharp(logoBuffer, { density: 384 })
        .resize(size, size)
        .png()
        .toFile(join(ROOT, 'public', outName));
}

// Padded icons: shrink the logo onto a solid square so Android's maskable safe
// zone never clips the ring (logo ~80% of the box) and iOS gets an opaque
// background (it ignores transparency and rounds the corners itself).
async function renderPadded(size, outName) {
    const inner = Math.round(size * 0.8);
    const logoPng = await sharp(logoBuffer, { density: 384 })
        .resize(inner, inner)
        .png()
        .toBuffer();
    await sharp({
        create: { width: size, height: size, channels: 4, background: BG },
    })
        .composite([{ input: logoPng, gravity: 'center' }])
        .png()
        .toFile(join(ROOT, 'public', outName));
}

await renderPlain(192, 'icon-192.png');
await renderPlain(512, 'icon-512.png');
await renderPadded(512, 'icon-maskable-512.png');
await renderPadded(180, 'apple-touch-icon.png');

console.log('✓ Generated PWA icons (192, 512, maskable-512, apple-touch) in public/');
