#!/usr/bin/env node
// Gera apps/web/src/design-system/tokens.css a partir de docs/design-system/tokens.json.
// Uso: node scripts/gen-tokens.mjs           (escreve o arquivo)
//      node scripts/gen-tokens.mjs --check   (só confere; falha se o commitado estiver diferente)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const json = fileURLToPath(new URL('../docs/design-system/tokens.json', import.meta.url));
const css = fileURLToPath(new URL('../apps/web/src/design-system/tokens.css', import.meta.url));
const t = JSON.parse(readFileSync(json, 'utf8'));

// estilos de texto em caixa-alta (selos)
const UPPERCASE = new Set(['overline']);

const vars = [
  ...t.color.tokens,
  ...t.spacing.tokens,
  ...t.radius.tokens,
  ...t.shadow.tokens,
].map(({ name, value }) => `  --${name}: ${value};`);
const families = Object.entries(t.type.families).map(([name, value]) => `  --font-${name}: ${value};`);

const styles = t.type.groups.flatMap((g) =>
  g.styles.map((s) => {
    const props = [
      `font-family: var(--font-${g.family})`,
      `font-size: ${s.fontSize}`,
      `line-height: ${s.lineHeight}`,
      `font-weight: ${s.fontWeight}`,
      s.letterSpacing && `letter-spacing: ${s.letterSpacing}`,
      UPPERCASE.has(s.name) && 'text-transform: uppercase',
    ].filter(Boolean);
    return `.text-${s.name} { ${props.join('; ')}; }`;
  }),
);

const out = [
  `/* ${t.name} — gerado de docs/design-system/tokens.json. Não edite à mão: mude o tokens.json e regenere. */`,
  ':root {',
  '  color-scheme: dark;',
  ...vars,
  ...families,
  '}',
  ...styles,
  '',
].join('\n');

if (process.argv.includes('--check')) {
  const current = readFileSync(css, 'utf8').replace(/\r\n/g, '\n');
  if (current !== out) {
    console.error('tokens.css está diferente do tokens.json. Rode: node scripts/gen-tokens.mjs');
    process.exit(1);
  }
  console.log('Tokens ok: tokens.css confere com o tokens.json.');
} else {
  writeFileSync(css, out);
  console.log('tokens.css gerado.');
}
