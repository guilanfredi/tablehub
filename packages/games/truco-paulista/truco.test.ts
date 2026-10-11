import { describe, expect, it } from 'vitest';
import { isActionError } from '@tablehub/game-sdk';
import { makePlayers, runConformance } from '@tablehub/game-sdk/testing';
import { cardStrength, deck, handWinner, manilhaOf, trucoPaulista as truco, type Card, type TrucoState, type TrucoView } from './engine';

const opts = (o: Record<string, unknown> = {}) => ({ pointsToWin: 12, maoDeOnze: true, maoDeFerro: true, ...o }) as any;
const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

function act(s: TrucoState, pid: string, a: any): TrucoState {
  const r = truco.applyAction(structuredClone(s), pid, a);
  if (isActionError(r)) throw new Error(r.error);
  return r;
}

/** Estado controlado: 2 jogadores, p1 é mão (dealer = p2), vira 7♦ → manilha Q. */
function fixture(hands: Card[][], n = 2): TrucoState {
  const s = truco.setup({ players: makePlayers(n), options: opts(), seed: 1 });
  s.dealer = n - 1;
  s.scores = [0, 0];
  s.hand.hands = Object.fromEntries(hands.map((h, i) => [`p${i + 1}`, h]));
  s.hand.vira = c('7', 'ouros');
  s.hand.manilha = 'Q';
  s.hand.turn = 0;
  s.hand.special = 'normal';
  s.hand.onzeTeam = null;
  s.hand.onzeDecided = true;
  return s;
}

describe('Truco Paulista — cartas', () => {
  it('baralho tem 40 cartas sem 8, 9 e 10', () => {
    const d = deck();
    expect(d.length).toBe(40);
    expect(d.some((x) => ['8', '9', '10'].includes(x.rank))).toBe(false);
  });

  it('manilha é a carta seguinte à vira (3 vira → 4)', () => {
    expect(manilhaOf(c('7', 'ouros'))).toBe('Q');
    expect(manilhaOf(c('K', 'paus'))).toBe('A');
    expect(manilhaOf(c('3', 'copas'))).toBe('4');
  });

  it('força: zap > copas > espadas > ouros > 3 > 2 > A ... > 4; encoberta perde para tudo', () => {
    const m = 'Q';
    const order = [c('Q', 'paus'), c('Q', 'copas'), c('Q', 'espadas'), c('Q', 'ouros'), c('3', 'ouros'), c('2', 'paus'), c('A', 'paus'), c('K', 'paus'), c('J', 'paus'), c('7', 'paus'), c('4', 'paus')];
    const str = order.map((x) => cardStrength(x, m));
    expect([...str].sort((a, b) => b - a)).toEqual(str);
    expect(cardStrength(c('4', 'paus'), m, true)).toBeLessThan(cardStrength(c('4', 'ouros'), m));
    expect(cardStrength(c('3', 'paus'), m)).toBe(cardStrength(c('3', 'ouros'), m)); // não-manilhas empatam
  });
});

describe('Truco Paulista — vazas', () => {
  it.each([
    [[0, 0], 0],
    [[1, 0, 1], 1],
    [[null, 1], 1],
    [[0, null], 0],
    [[0, 1, null], 0],
    [[null, null, 1], 1],
    [[null, null, null], 'none'],
    [[0, 1], undefined],
    [[null, null], undefined],
  ] as const)('resultado %j → %s', (r, expected) => {
    expect(handWinner([...r])).toBe(expected);
  });

  it('mão ganha em 2 vazas vale 1 ponto e passa a vez de dar as cartas', () => {
    let s = fixture([
      [c('3', 'paus'), c('2', 'paus'), c('4', 'ouros')],
      [c('4', 'paus'), c('5', 'paus'), c('6', 'ouros')],
    ]);
    s = act(s, 'p1', { type: 'play', index: 0 });
    s = act(s, 'p2', { type: 'play', index: 0 });
    expect(s.hand.tricks[0].winnerTeam).toBe(0);
    expect(s.hand.turn).toBe(0); // vencedor da vaza começa
    s = act(s, 'p1', { type: 'play', index: 0 });
    s = act(s, 'p2', { type: 'play', index: 0 });
    expect(s.scores).toEqual([1, 0]);
    expect(s.hand.number).toBe(2);
    expect(s.dealer).toBe(0);
  });

  it('carta encoberta só a partir da 2ª vaza', () => {
    const s = fixture([
      [c('3', 'paus'), c('2', 'paus'), c('4', 'ouros')],
      [c('4', 'paus'), c('5', 'paus'), c('6', 'ouros')],
    ]);
    expect(isActionError(truco.applyAction(structuredClone(s), 'p1', { type: 'play', index: 0, faceDown: true }))).toBe(true);
  });

  it('em duplas, cartas iguais do mesmo time não empatam a vaza', () => {
    let s = fixture(
      [
        [c('3', 'paus'), c('4', 'ouros'), c('4', 'copas')],
        [c('2', 'paus'), c('5', 'ouros'), c('5', 'copas')],
        [c('3', 'ouros'), c('6', 'ouros'), c('6', 'copas')],
        [c('A', 'paus'), c('7', 'ouros'), c('7', 'copas')],
      ],
      4,
    );
    for (const p of ['p1', 'p2', 'p3', 'p4']) s = act(s, p, { type: 'play', index: 0 });
    expect(s.hand.tricks[0]).toMatchObject({ winnerTeam: 0, winnerPlayer: 'p1' });
  });
});

describe('Truco Paulista — apostas', () => {
  const hands = () => [
    [c('3', 'paus'), c('2', 'paus'), c('4', 'ouros')],
    [c('4', 'paus'), c('5', 'paus'), c('6', 'ouros')],
  ];

  it('truco aceito vale 3; o mesmo time não pode pedir o próximo aumento', () => {
    let s = fixture(hands());
    s = act(s, 'p1', { type: 'truco' });
    expect(truco.getStatus(s).currentPlayers).toEqual(['p2']);
    s = act(s, 'p2', { type: 'accept' });
    expect(s.hand.value).toBe(3);
    expect(truco.getLegalActions(s, 'p1').some((a) => a.type === 'truco')).toBe(false);
    s = act(s, 'p1', { type: 'play', index: 0 });
    expect(truco.getLegalActions(s, 'p2').some((a) => a.type === 'truco')).toBe(true); // p2 pode pedir seis
  });

  it('correr dá ao pedinte o valor anterior', () => {
    let s = fixture(hands());
    s = act(s, 'p1', { type: 'truco' });
    s = act(s, 'p2', { type: 'run' });
    expect(s.scores).toEqual([1, 0]);
  });

  it('aumentar aceita o pedido anterior; correr do seis dá 3', () => {
    let s = fixture(hands());
    s = act(s, 'p1', { type: 'truco' });
    s = act(s, 'p2', { type: 'raise' });
    expect(s.hand.pending).toMatchObject({ team: 1, to: 6 });
    expect(truco.getStatus(s).currentPlayers).toEqual(['p1']);
    s = act(s, 'p1', { type: 'run' });
    expect(s.scores).toEqual([0, 3]);
  });

  it('não passa de doze', () => {
    let s = fixture(hands());
    s = act(s, 'p1', { type: 'truco' });
    s = act(s, 'p2', { type: 'raise' }); // 6
    s = act(s, 'p1', { type: 'raise' }); // 9
    s = act(s, 'p2', { type: 'raise' }); // 12
    expect(s.hand.pending?.to).toBe(12);
    expect(truco.getLegalActions(s, 'p1').map((a) => a.type)).toEqual(['accept', 'run']);
  });
});

describe('Truco Paulista — mão de onze e de ferro', () => {
  it('ao chegar a 11, a próxima mão é de onze: o time vê as cartas do parceiro e decide; correr dá 1', () => {
    let s = fixture(
      [
        [c('3', 'paus'), c('4', 'ouros'), c('4', 'copas')],
        [c('2', 'paus'), c('5', 'ouros'), c('5', 'copas')],
        [c('3', 'ouros'), c('6', 'ouros'), c('6', 'copas')],
        [c('A', 'paus'), c('7', 'ouros'), c('7', 'copas')],
      ],
      4,
    );
    s.scores = [10, 5];
    s = act(s, 'p1', { type: 'truco' });
    s = act(s, 'p2', { type: 'run' }); // time 0 vai a 11
    expect(s.scores).toEqual([11, 5]);
    expect(s.hand.special).toBe('maoDeOnze');
    expect(truco.getStatus(s).currentPlayers.sort()).toEqual(['p1', 'p3']);
    const v = truco.getPlayerView(s, 'p1') as TrucoView;
    expect(v.partnerHand?.playerId).toBe('p3');
    expect(v.partnerHand?.cards).toEqual(s.hand.hands.p3);
    expect((truco.getPlayerView(s, 'p2') as TrucoView).partnerHand).toBeNull();
    const after = act(s, 'p3', { type: 'onze', play: false });
    expect(after.scores).toEqual([11, 6]);
  });

  it('com 11 a 11 a mão é de ferro', () => {
    let s = fixture([
      [c('3', 'paus'), c('2', 'paus'), c('4', 'ouros')],
      [c('4', 'paus'), c('5', 'paus'), c('6', 'ouros')],
    ]);
    s.scores = [11, 10];
    s = act(s, 'p1', { type: 'truco' });
    s = act(s, 'p2', { type: 'run' }); // vira 12 x 10 → fim de jogo
    expect(s.winnerTeam).toBe(0);
    let f = fixture([
      [c('3', 'paus'), c('2', 'paus'), c('4', 'ouros')],
      [c('4', 'paus'), c('5', 'paus'), c('6', 'ouros')],
    ]);
    f.scores = [10, 11];
    f.hand.special = 'normal';
    f = act(f, 'p1', { type: 'play', index: 0 });
    f = act(f, 'p2', { type: 'play', index: 0 });
    f = act(f, 'p1', { type: 'play', index: 0 });
    f = act(f, 'p2', { type: 'play', index: 0 });
    expect(f.scores).toEqual([11, 11]);
    expect(f.hand.special).toBe('maoDeFerro');
  });

  it('mão de onze aceita vale 3 e não permite truco', () => {
    const s = truco.setup({ players: makePlayers(2), options: opts(), seed: 2 });
    s.scores = [11, 3];
    s.hand.special = 'maoDeOnze';
    s.hand.onzeTeam = 0;
    s.hand.onzeDecided = false;
    const s2 = act(s, 'p1', { type: 'onze', play: true });
    expect(s2.hand.value).toBe(3);
    const cur = truco.getStatus(s2).currentPlayers[0];
    expect(truco.getLegalActions(s2, cur).some((a) => a.type === 'truco')).toBe(false);
  });

  it('mão de ferro esconde as próprias cartas', () => {
    const s = truco.setup({ players: makePlayers(2), options: opts(), seed: 2 });
    s.hand.special = 'maoDeFerro';
    const v = truco.getPlayerView(s, 'p1') as TrucoView;
    expect(v.myHand).toBeNull();
    expect(v.players[0].cards).toBe(3);
  });
});

describe('Truco Paulista — conformidade', () => {
  it('passa na bateria (2 e 4 jogadores)', () => {
    const leakCheck = (s: TrucoState, viewer: string, view: TrucoView) => {
      const json = JSON.stringify({ ...view, partnerHand: null });
      for (const p of s.players) {
        if (p.id === viewer || s.hand.hands[p.id].length === 0) continue;
        if (json.includes(JSON.stringify(s.hand.hands[p.id]))) return `mão de ${p.id}`;
      }
      for (const t of s.hand.tricks) for (const pl of t.plays) if (pl.faceDown && view.tricks.some((vt) => vt.plays.some((vp) => vp.faceDown && vp.card))) return 'carta encoberta';
      return null;
    };
    const r = runConformance(truco, {
      playerCounts: [2, 4],
      optionSets: [opts(), opts({ maoDeOnze: false, maoDeFerro: false }), opts({ pointsToWin: 24 })],
      seeds: 5,
      maxSteps: 5000,
      requireFinish: true,
      leakCheck,
    });
    expect(r.finished).toBe(r.games);
  });
});
