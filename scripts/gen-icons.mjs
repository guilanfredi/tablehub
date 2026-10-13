#!/usr/bin/env node
// Gera os ícones PNG do PWA a partir do ícone oficial (docs/design-system/logos/tablehub-app-icon.svg).
// Roda à mão: node scripts/gen-icons.mjs (os PNGs gerados são commitados).
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const svg = readFileSync(new URL('../docs/design-system/logos/tablehub-app-icon.svg', import.meta.url), 'utf8').trim();

// Maskable e apple-touch: fundo cheio (sem cantos transparentes) e o leque reduzido para caber na zona segura central.
const bg = /<rect width="64" height="64" rx="14" (fill="#[0-9A-Fa-f]{6}")\/>/;
if (!bg.test(svg)) throw new Error('fundo do ícone não encontrado no SVG');
const fullBleed = svg
  .replace(bg, '<rect width="64" height="64" $1/><g transform="translate(32 32) scale(0.8) translate(-32 -32)">')
  .replace(/<\/svg>$/, '</g></svg>');

function png(source, size) {
  return new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

const out = new URL('../apps/web/public/', import.meta.url);
writeFileSync(new URL('icon-192.png', out), png(svg, 192));
writeFileSync(new URL('icon-512.png', out), png(svg, 512));
writeFileSync(new URL('icon-maskable-512.png', out), png(fullBleed, 512));
writeFileSync(new URL('apple-touch-icon.png', out), png(fullBleed, 180));
console.log('ícones gerados');
