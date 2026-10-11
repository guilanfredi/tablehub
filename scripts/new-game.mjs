#!/usr/bin/env node
/**
 * Cria o esqueleto de um novo jogo e registra nos dois registros (motor e tabuleiro).
 * Uso: npm run new-game -- <id-kebab-case> "<Nome do jogo>"
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [id, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ').trim();

if (!id || !/^[a-z][a-z0-9-]*$/.test(id) || !name) {
  console.error('Uso: npm run new-game -- <id-kebab-case> "<Nome do jogo>"');
  process.exit(1);
}

const camel = id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const pascal = camel[0].toUpperCase() + camel.slice(1);
const gameDir = join(root, 'packages/games', id);
const boardDir = join(root, 'apps/web/src/games', id);
if (existsSync(gameDir)) {
  console.error(`Já existe packages/games/${id}`);
  process.exit(1);
}

const files = {
  [join(gameDir, 'engine.ts')]: `import { Rng, type GameDefinition, type GameStatus } from '@tablehub/game-sdk';

export interface ${pascal}Options {
  // TODO: parâmetros de regra (devem bater com optionsSchema)
  [k: string]: string | number | boolean;
}

export type ${pascal}Action = { type: 'pass' }; // TODO: todas as ações do jogo

export interface ${pascal}State {
  options: ${pascal}Options;
  players: { id: string; name: string }[];
  rng: number;
  turn: number;
  winners: string[] | null;
  // TODO: restante do estado (100% serializável em JSON)
}

function setup(players: { id: string; name: string }[], options: ${pascal}Options, seed: number): ${pascal}State {
  const rng = new Rng(seed);
  const s: ${pascal}State = { options, players: players.map((p) => ({ id: p.id, name: p.name })), rng: 0, turn: 0, winners: null };
  s.rng = rng.state;
  return s;
}

function legalActions(s: ${pascal}State, pid: string): ${pascal}Action[] {
  if (s.winners || s.players[s.turn].id !== pid) return [];
  return [{ type: 'pass' }];
}

function applyAction(s: ${pascal}State, pid: string, a: ${pascal}Action): ${pascal}State | { error: string } {
  if (s.players[s.turn].id !== pid) return { error: 'Não é a sua vez.' };
  switch (a.type) {
    case 'pass':
      s.turn = (s.turn + 1) % s.players.length;
      return s;
    default:
      return { error: 'Ação inválida.' };
  }
}

function getStatus(s: ${pascal}State): GameStatus {
  if (s.winners) return { phase: 'finished', currentPlayers: [], winners: s.winners };
  const cur = s.players[s.turn];
  return { phase: 'playing', currentPlayers: [cur.id], message: \`Vez de \${cur.name}\` };
}

export const ${camel}: GameDefinition<${pascal}State, ${pascal}Action, ${pascal}Options> = {
  id: '${id}',
  name: '${name.replace(/'/g, "\\'")}',
  description: 'TODO: descrição curta do jogo.',
  minPlayers: 2,
  maxPlayers: 4,
  optionsSchema: [],
  rulesSummary: () => ['TODO: resumo das regras exibido no lobby.'],
  validateConfig: () => null,
  setup: ({ players, options, seed }) => setup(players, options as ${pascal}Options, seed),
  getPlayerView: (s, _pid) => ({ ...s, rng: undefined }), // TODO: esconder informação oculta
  getLegalActions: legalActions,
  applyAction,
  getStatus,
};
`,
  [join(gameDir, 'index.ts')]: `export * from './engine';\nexport { ${camel} as default } from './engine';\n`,
  [join(gameDir, 'RULES.md')]: `# ${name} — especificação

> Escrita a partir do manual. Cada regra aqui deve ter um teste correspondente.

- **Jogadores:**
- **Componentes:**
- **Preparação:**
- **Turno:**
- **Fim de jogo e pontuação:**

## Opções
| chave | valores | padrão |
|---|---|---|

## Dúvidas de interpretação
- (liste aqui pontos ambíguos do manual e a decisão tomada)
`,
  [join(gameDir, `${id}.test.ts`)]: `import { describe, expect, it } from 'vitest';
import { runConformance } from '@tablehub/game-sdk/testing';
import { ${camel} } from './engine';

describe('${name}', () => {
  it.todo('regras específicas (uma por item do RULES.md)');

  it('passa na bateria de conformidade', () => {
    const r = runConformance(${camel}, { maxSteps: 3000, requireFinish: false });
    expect(r.games).toBeGreaterThan(0);
  });
});
`,
  [join(boardDir, `${pascal}Board.tsx`)]: `import type { ${pascal}Action, ${pascal}State } from '@tablehub/games/${id}/engine';
import type { BoardProps } from '../registry';

export default function ${pascal}Board({ game, act }: BoardProps) {
  const v = game.view as ${pascal}State;
  const legal = game.legal as ${pascal}Action[];
  return (
    <div className="card stack">
      <p className="muted">TODO: interface de ${name}. Turno de {v.players[v.turn]?.name}.</p>
      <div className="row">
        {legal.map((a, i) => (
          <button key={i} className="btn" onClick={() => act(a)}>
            {a.type}
          </button>
        ))}
      </div>
    </div>
  );
}
`,
};

mkdirSync(gameDir, { recursive: true });
mkdirSync(boardDir, { recursive: true });
for (const [path, content] of Object.entries(files)) writeFileSync(path, content);

function insert(file, marker, line) {
  const p = join(root, file);
  const src = readFileSync(p, 'utf8');
  if (!src.includes(marker)) throw new Error(`Marcador ${marker} não encontrado em ${file}`);
  const indent = src.split('\n').find((l) => l.includes(marker)).match(/^\s*/)[0];
  writeFileSync(p, src.replace(`${indent}${marker}`, `${indent}${line}\n${indent}${marker}`));
}

insert('packages/games/index.ts', '// @new-game:import', `import { ${camel} } from './${id}/engine';`);
insert('packages/games/index.ts', '// @new-game:entry', `[${camel}.id]: ${camel},`);
insert('apps/web/src/games/registry.ts', '// @new-game:board', `'${id}': lazy(() => import('./${id}/${pascal}Board')),`);

console.log(`Jogo "${name}" criado:
  packages/games/${id}/engine.ts     ← regras
  packages/games/${id}/RULES.md      ← especificação
  packages/games/${id}/${id}.test.ts ← testes
  apps/web/src/games/${id}/${pascal}Board.tsx ← interface
Registrado em packages/games/index.ts e apps/web/src/games/registry.ts.`);
