#!/usr/bin/env node
// Falha se houver cor literal (hex, rgb, hsl) no código do app fora do design system.
// Uso: node scripts/check-design-system.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'apps/web/src');
const IGNORE = [/^design-system\//, /^games\/[^/]+\/art\.tsx$/, /^components\/avatars\/art\.ts$/, /\.test\.tsx?$/];
const COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(css|tsx?|jsx?)$/.test(name)) yield p;
  }
}

const problems = [];
for (const file of walk(SRC)) {
  const rel = relative(SRC, file).split(sep).join('/');
  if (IGNORE.some((re) => re.test(rel))) continue;
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (/design-system-ignore/.test(line)) return;
    const hits = line.match(COLOR);
    if (hits) problems.push(`apps/web/src/${rel}:${i + 1}  ${hits.join(', ')}`);
  });
}

if (problems.length) {
  console.error(`Cores fora do design system (${problems.length}). Use as variáveis de apps/web/src/design-system/tokens.css:\n`);
  console.error(problems.join('\n'));
  console.error('\nSe uma linha for exceção de verdade, acrescente o comentário design-system-ignore nela.');
  process.exit(1);
}
console.log('Design system ok: nenhuma cor literal fora dos tokens.');
