import { describe, expect, it } from 'vitest';
import { isActionError } from '@tablehub/game-sdk';
import { makePlayers, runConformance } from '@tablehub/game-sdk/testing';
import { domino, fullSet, type DominoState, type Tile } from './engine';

const opts = (o: Partial<{ mode: string; pointsToWin: number; teams: boolean }> = {}) =>
  ({ mode: 'bloqueio', pointsToWin: 100, teams: false, ...o }) as any;

function act(s: DominoState, pid: string, a: any): DominoState {
  const r = domino.applyAction(structuredClone(s), pid, a);
  if (isActionError(r)) throw new Error(r.error);
  return r;
}

/** Monta um estado controlado para testar regras específicas. */
function fixture(hands: Tile[][], extra: Partial<DominoState> = {}): DominoState {
  const s = domino.setup({ players: makePlayers(hands.length), options: opts(), seed: 1 });
  s.hands = Object.fromEntries(hands.map((h, i) => [`p${i + 1}`, h]));
  s.boneyard = [];
  s.line = [];
  s.turn = 0;
  s.forcedOpening = null;
  return Object.assign(s, extra);
}

describe('Dominó', () => {
  it('tem 28 peças e distribui 7 para cada', () => {
    expect(fullSet().length).toBe(28);
    const s = domino.setup({ players: makePlayers(4), options: opts(), seed: 3 });
    for (const p of s.players) expect(s.hands[p.id].length).toBe(7);
  });

  it('1ª rodada: quem tem o maior duplo começa e é obrigado a jogá-lo', () => {
    const s = domino.setup({ players: makePlayers(4), options: opts(), seed: 11 });
    const starter = s.players[s.turn].id;
    expect(s.hands[starter]).toContainEqual([6, 6]); // com 4 jogadores todas as peças são distribuídas
    expect(s.forcedOpening).toEqual([6, 6]);
    const legal = domino.getLegalActions(s, starter);
    expect(legal).toEqual([{ type: 'play', tile: [6, 6], side: 'left' }]);
  });

  it('encaixa peças nas pontas e orienta os valores', () => {
    let s = fixture([[[3, 5], [1, 1]], [[5, 6], [0, 0]]]);
    s = act(s, 'p1', { type: 'play', tile: [3, 5], side: 'left' });
    s = act(s, 'p2', { type: 'play', tile: [5, 6], side: 'right' });
    expect(s.line.map((l) => l.shown)).toEqual([[3, 5], [5, 6]]);
    expect(domino.getPlayerView(s, 'p1') as any).toMatchObject({ ends: { left: 3, right: 6 } });
  });

  it('recusa jogada que não encaixa e passe com peça disponível', () => {
    let s = fixture([[[3, 5], [1, 1]], [[2, 2], [5, 5]]]);
    s = act(s, 'p1', { type: 'play', tile: [3, 5], side: 'left' });
    expect(isActionError(domino.applyAction(structuredClone(s), 'p2', { type: 'play', tile: [2, 2], side: 'left' }))).toBe(true);
    expect(isActionError(domino.applyAction(structuredClone(s), 'p2', { type: 'pass' }))).toBe(true);
  });

  it('batida: vencedor soma os pontos das mãos adversárias', () => {
    let s = fixture([[[3, 5]], [[6, 6], [1, 2]]]);
    s = act(s, 'p1', { type: 'play', tile: [3, 5], side: 'left' });
    expect(s.lastRound).toMatchObject({ reason: 'batida', winners: ['p1'], points: 15 });
    expect(s.scores.p1).toBe(15);
    expect(s.round).toBe(2);
    expect(s.players[s.turn].id).toBe('p1'); // vencedor começa a próxima
  });

  it('jogo fechado: menor soma vence e leva os pontos dos outros', () => {
    // nenhuma peça encaixa nas pontas 0 e 0 depois da abertura
    let s = fixture([[[0, 0], [6, 6]], [[5, 5], [4, 4]]]);
    s = act(s, 'p1', { type: 'play', tile: [0, 0], side: 'left' });
    s = act(s, 'p2', { type: 'pass' });
    s = act(s, 'p1', { type: 'pass' });
    // p1 fica com [6|6]=12 e p2 com [5|5]+[4|4]=18 → p1 vence e leva 18
    expect(s.lastRound).toMatchObject({ reason: 'fechado', winners: ['p1'], points: 18 });
  });

  it('modo compra: compra até poder jogar', () => {
    let s = fixture([[[3, 3], [0, 1]], [[6, 6], [5, 5]]], { options: opts({ mode: 'compra' }) });
    s.boneyard = [[3, 4], [2, 2]];
    s = act(s, 'p1', { type: 'play', tile: [3, 3], side: 'left' });
    expect(domino.getLegalActions(s, 'p2')).toEqual([{ type: 'draw' }]);
    s = act(s, 'p2', { type: 'draw' }); // pega [2,2]
    s = act(s, 'p2', { type: 'draw' }); // pega [3,4]
    expect(domino.getLegalActions(s, 'p2').every((a) => a.type === 'play')).toBe(true);
  });

  it('duplas: parceiros somam pontos juntos', () => {
    let s = fixture([[[3, 5]], [[1, 1]], [[2, 2]], [[6, 6]]], { options: opts({ teams: true }) });
    s.scores = { p1: 0, p2: 0, p3: 0, p4: 0 };
    s = act(s, 'p1', { type: 'play', tile: [3, 5], side: 'left' });
    expect(s.lastRound?.winners).toEqual(['p1', 'p3']);
    expect(s.lastRound?.points).toBe(2 + 12); // mãos de p2 e p4
    expect(s.scores.p3).toBe(14);
  });

  it('view não revela a mão dos outros', () => {
    const s = domino.setup({ players: makePlayers(3), options: opts(), seed: 5 });
    const v: any = domino.getPlayerView(s, 'p1');
    expect(v.myHand).toEqual(s.hands.p1);
    expect(JSON.stringify(v)).not.toContain(JSON.stringify(s.hands.p2));
  });

  it('histórico registra jogar (peça e ponta), comprar sem revelar a peça, passar e fim de rodada', () => {
    let s = fixture([[[3, 3], [0, 1]], [[6, 6], [5, 5]]], { options: opts({ mode: 'compra' }) });
    s.boneyard = [[3, 4], [2, 2]];
    s = act(s, 'p1', { type: 'play', tile: [3, 3], side: 'left' });
    s = act(s, 'p2', { type: 'draw' });
    s = act(s, 'p2', { type: 'draw' });
    s = act(s, 'p2', { type: 'play', tile: [3, 4], side: 'left' });
    const texts = domino.getLog!(s).entries.map((e) => e.text);
    expect(texts).toEqual(['Jogador 1 abriu com [3|3].', 'Jogador 2 comprou uma peça do monte.', 'Jogador 2 comprou uma peça do monte.', 'Jogador 2 jogou [3|4] na ponta esquerda.']);
    expect(domino.getLog!(s).entries.map((e) => e.by)).toEqual(['p1', 'p2', 'p2', 'p2']);
    expect(texts.join()).not.toContain('[2|2]');

    let f = fixture([[[0, 0], [6, 6]], [[5, 5], [4, 4]]]);
    f = act(f, 'p1', { type: 'play', tile: [0, 0], side: 'left' });
    f = act(f, 'p2', { type: 'pass' });
    f = act(f, 'p1', { type: 'pass' });
    expect(domino.getLog!(f).entries.slice(-3).map((e) => e.text)).toEqual([
      'Jogador 2 passou a vez.',
      'Jogador 1 passou a vez.',
      'Rodada 1: Jogo fechado. Jogador 1 +18 pontos.',
    ]);
  });

  it('histórico registra batida e vencedor da partida', () => {
    let s = fixture([[[3, 5]], [[6, 6], [1, 2]]], { options: opts({ pointsToWin: 15 }) });
    s = act(s, 'p1', { type: 'play', tile: [3, 5], side: 'left' });
    expect(domino.getLog!(s).entries.slice(-2).map((e) => e.text)).toEqual(['Rodada 1: Jogador 1 bateu. Jogador 1 +15 pontos.', 'Jogador 1 venceu a partida com 15 pontos!']);
  });

  it('partida anterior ao histórico (sem log) continua jogável', () => {
    let s = fixture([[[3, 5], [1, 1]], [[5, 6], [0, 0]]]);
    delete s.log;
    expect(domino.getLog!(s)).toEqual({ total: 0, entries: [] });
    s = act(s, 'p1', { type: 'play', tile: [3, 5], side: 'left' });
    expect(domino.getLog!(s).total).toBe(1);
  });

  it('passa na bateria de conformidade', () => {
    const leakCheck = (s: DominoState, viewer: string, view: any) => {
      if (view.lastRound) return null; // mãos reveladas no fim da rodada são públicas
      for (const p of s.players) {
        if (p.id === viewer) continue;
        if (JSON.stringify(view).includes(JSON.stringify(s.hands[p.id]))) return `mão de ${p.id}`;
      }
      return null;
    };
    const r = runConformance(domino, {
      playerCounts: [2, 3, 4],
      optionSets: [opts(), opts({ mode: 'compra', pointsToWin: 50 }), opts({ teams: true, pointsToWin: 50 })],
      seeds: 4,
      maxSteps: 4000,
      requireFinish: true,
      leakCheck,
      // peça só aparece no histórico quando foi jogada na mesa
      logLeakCheck: (_s, log) => log.entries.find((e) => /\[\d\|\d\]/.test(e.text) && !/(jogou|abriu com) \[\d\|\d\]/.test(e.text))?.text ?? null,
    });
    expect(r.finished).toBe(r.games);
  });
});
