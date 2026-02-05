// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

/**
 * Script to generate Icons.jsx from SVG files in public/
 * Converts public/logo.svg into an inline SVG symbol for the icon sprite.
 * 
 * Usage: node scripts/generate-icons.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

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
