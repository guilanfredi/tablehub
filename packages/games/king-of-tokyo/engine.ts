import { Rng, type GameDefinition, type GameStatus } from '@tablehub/game-sdk';

export interface KingOfTokyoOptions {
  // TODO: parâmetros de regra (devem bater com optionsSchema)
  [k: string]: string | number | boolean;
}

export type KingOfTokyoAction = { type: 'pass' }; // TODO: todas as ações do jogo

export interface KingOfTokyoState {
  options: KingOfTokyoOptions;
  players: { id: string; name: string }[];
  rng: number;
  turn: number;
  winners: string[] | null;
  // TODO: restante do estado (100% serializável em JSON)
}

function setup(players: { id: string; name: string }[], options: KingOfTokyoOptions, seed: number): KingOfTokyoState {
  const rng = new Rng(seed);
  const s: KingOfTokyoState = { options, players: players.map((p) => ({ id: p.id, name: p.name })), rng: 0, turn: 0, winners: null };
  s.rng = rng.state;
  return s;
}

function legalActions(s: KingOfTokyoState, pid: string): KingOfTokyoAction[] {
  if (s.winners || s.players[s.turn].id !== pid) return [];
  return [{ type: 'pass' }];
}

function applyAction(s: KingOfTokyoState, pid: string, a: KingOfTokyoAction): KingOfTokyoState | { error: string } {
  if (s.players[s.turn].id !== pid) return { error: 'Não é a sua vez.' };
  switch (a.type) {
    case 'pass':
      s.turn = (s.turn + 1) % s.players.length;
      return s;
    default:
      return { error: 'Ação inválida.' };
  }
}

function getStatus(s: KingOfTokyoState): GameStatus {
  if (s.winners) return { phase: 'finished', currentPlayers: [], winners: s.winners };
  const cur = s.players[s.turn];
  return { phase: 'playing', currentPlayers: [cur.id], message: `Vez de ${cur.name}` };
}

export const kingOfTokyo: GameDefinition<KingOfTokyoState, KingOfTokyoAction, KingOfTokyoOptions> = {
  id: 'king-of-tokyo',
  name: 'King of Tokyo',
  description: 'TODO: descrição curta do jogo.',
  minPlayers: 2,
  maxPlayers: 4,
  optionsSchema: [],
  rulesSummary: () => ['TODO: resumo das regras exibido no lobby.'],
  validateConfig: () => null,
  setup: ({ players, options, seed }) => setup(players, options as KingOfTokyoOptions, seed),
  getPlayerView: (s, _pid) => ({ ...s, rng: undefined }), // TODO: esconder informação oculta
  getLegalActions: legalActions,
  applyAction,
  getStatus,
};
