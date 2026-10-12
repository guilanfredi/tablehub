import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isActionError, runAction } from '@tablehub/game-sdk';
import { makePlayers, runConformance } from '@tablehub/game-sdk/testing';
import { CARDS, CARD_BY_ID, MONSTERS, _test, kingOfTokyo, type Face, type KingOfTokyoAction, type KingOfTokyoState, type KingOfTokyoView, type OwnedCard } from './engine';

const def = kingOfTokyo;

function game(n = 2, powerCards = true, seed = 1): KingOfTokyoState {
  const s = def.setup({ players: makePlayers(n), options: { powerCards }, seed });
  s.turn = 0;
  _test.startTurn(s, 0);
  return s;
}

function play(s: KingOfTokyoState, pid: string, a: KingOfTokyoAction): KingOfTokyoState {
  const r = runAction(def, s, pid, a);
  if (isActionError(r)) throw new Error(r.error);
  return r;
}

function fails(s: KingOfTokyoState, pid: string, a: KingOfTokyoAction): string {
  const r = runAction(def, s, pid, a);
  if (!isActionError(r)) throw new Error('ação deveria ter sido rejeitada');
  return r.error;
}

/** Fixa os dados do jogador da vez (como se tivesse rolado) e resolve. */
function resolveWith(s: KingOfTokyoState, faces: Face[]): KingOfTokyoState {
  s.dice = faces.map((face) => ({ face, kept: false }));
  s.ts.rollsUsed = 1;
  return play(s, s.players[s.turn].id, { type: 'resolve' });
}

function give(s: KingOfTokyoState, pid: string, ...cards: (string | OwnedCard)[]) {
  for (const c of cards) s.monsters[pid].cards.push(typeof c === 'string' ? { id: c } : c);
}

const M = (s: KingOfTokyoState, id: string) => s.monsters[id];
const turnOf = (s: KingOfTokyoState) => s.players[s.turn].id;
const status = (s: KingOfTokyoState) => def.getStatus(s);
const toBuy = (s: KingOfTokyoState, faces: Face[] = ['1', '2', '3', '1', '2', '3']) => resolveWith(s, faces);
const endTurn = (s: KingOfTokyoState) => play(s, turnOf(s), { type: 'endTurn' });
const blank: Face[] = ['1', '2', '3', '1', '2', '3'];

describe('King of Tokyo — preparação (critério 1)', () => {
  it('2 a 6 jogadores com 10 Vida, 0 PV, 0 energia, vitrine com 3 cartas e ninguém em Tóquio', () => {
    for (let n = 2; n <= 6; n++) {
      const s = def.setup({ players: makePlayers(n), options: { powerCards: true }, seed: 3 });
      expect(Object.values(s.monsters).every((m) => m.hp === 10 && m.vp === 0 && m.energy === 0 && m.place === 'out')).toBe(true);
      expect(s.market.filter(Boolean)).toHaveLength(3);
      expect(s.deck).toHaveLength(63);
      expect(s.players.map((p) => s.monsters[p.id].monster)).toEqual(MONSTERS.slice(0, n));
    }
    expect(def.minPlayers).toBe(2);
    expect(def.maxPlayers).toBe(6);
  });

  it('sem cartas de Poder não há vitrine nem baralho', () => {
    const s = def.setup({ players: makePlayers(3), options: { powerCards: false }, seed: 3 });
    expect(s.market).toEqual([]);
    expect(s.deck).toEqual([]);
  });

  it('primeiro jogador sorteado por garras, determinístico pela semente e registrado no log', () => {
    const a = def.setup({ players: makePlayers(4), options: { powerCards: true }, seed: 99 });
    const b = def.setup({ players: makePlayers(4), options: { powerCards: true }, seed: 99 });
    expect(a.turn).toBe(b.turn);
    expect(a.log[0]).toMatch(/Sorteio do 1º jogador/);
    const firsts = new Set(Array.from({ length: 30 }, (_, i) => def.setup({ players: makePlayers(4), options: { powerCards: true }, seed: i }).turn));
    expect(firsts.size).toBeGreaterThan(1);
  });
});

describe('rolagens (critério 2)', () => {
  it('até 3 rolagens; dados guardados não mudam; 6 dados', () => {
    let s = game();
    s = play(s, 'p1', { type: 'roll' });
    expect(s.dice).toHaveLength(6);
    const kept = s.dice[0].face;
    for (let i = 0; i < 2; i++) {
      s = play(s, 'p1', { type: 'roll', keep: [0] });
      expect(s.dice[0].face).toBe(kept);
      expect(s.dice[0].kept).toBe(true);
    }
    expect(fails(s, 'p1', { type: 'roll', keep: [] })).toMatch(/rolagens/);
    expect(def.getLegalActions(s, 'p1').some((a) => a.type === 'roll')).toBe(false);
  });

  it('resolve antes da 3ª rolagem encerra as rolagens', () => {
    let s = game();
    s = play(s, 'p1', { type: 'roll' });
    s = play(s, 'p1', { type: 'resolve' });
    expect(s.phase).toBe('buy');
    expect(fails(s, 'p1', { type: 'roll' })).toBeTruthy();
  });

  it('resolve exige ao menos uma rolagem', () => {
    expect(fails(game(), 'p1', { type: 'resolve' })).toMatch(/Role/);
  });

  it('Cabeça Extra +1 dado verde; Encolhido −1 dado', () => {
    let s = game();
    give(s, 'p1', 'cabeca-extra', 'cabeca-extra');
    M(s, 'p1').shrink = 1;
    s = play(s, 'p1', { type: 'roll' });
    expect(s.dice).toHaveLength(7);
    expect(s.dice.filter((d) => d.green)).toHaveLength(2);
  });
});

describe('resolução dos dados (critérios 3–6)', () => {
  it.each([
    [['1', '1', '1', 'energy', 'claw', 'heart'], 1],
    [['1', '1', '1', '1', 'claw', 'heart'], 2],
    [['2', '2', '2', 'energy', 'claw', 'heart'], 2],
    [['3', '3', '3', '3', '3', 'heart'], 5],
    [['2', '2', '3', '3', '1', '1'], 0],
  ] as [Face[], number][])('números %j = %i PV', (faces, vp) => {
    const s = resolveWith(game(), faces);
    expect(M(s, 'p1').vp).toBe(vp + 1); // +1 ao entrar em Tóquio vazia
  });

  it('+1 energia por dado de energia', () => {
    const s = resolveWith(game(), ['energy', 'energy', 'energy', '1', '2', '3']);
    expect(M(s, 'p1').energy).toBe(3);
  });

  it('corações curam fora de Tóquio até 10, e não curam em Tóquio', () => {
    let s = game();
    M(s, 'p1').hp = 8;
    s = resolveWith(s, ['heart', 'heart', 'heart', '1', '2', '3']);
    expect(M(s, 'p1').hp).toBe(10);
    s = game();
    M(s, 'p1').hp = 5;
    M(s, 'p1').place = 'city';
    s = resolveWith(s, ['heart', 'heart', '1', '1', '2', '3']);
    expect(M(s, 'p1').hp).toBe(5);
  });

  it('garras de fora atingem só Tóquio (Cidade e Baía); de dentro atingem todos de fora', () => {
    let s = game(5);
    M(s, 'p2').place = 'city';
    M(s, 'p3').place = 'bay';
    s = resolveWith(s, ['claw', 'claw', '1', '2', '3', '1']);
    expect([M(s, 'p2').hp, M(s, 'p3').hp, M(s, 'p4').hp, M(s, 'p5').hp]).toEqual([8, 8, 10, 10]);

    s = game(4);
    M(s, 'p1').place = 'city';
    s = resolveWith(s, ['claw', '1', '2', '3', '1', '2']);
    expect([M(s, 'p2').hp, M(s, 'p3').hp, M(s, 'p4').hp]).toEqual([9, 9, 9]);
  });

  it('ninguém em Tóquio: garras não causam dano', () => {
    const s = resolveWith(game(3), ['claw', 'claw', 'claw', '1', '2', '3']);
    expect([M(s, 'p2').hp, M(s, 'p3').hp]).toEqual([10, 10]);
    expect(M(s, 'p1').place).toBe('city');
  });
});

describe('eliminação, ceder e entrar (critérios 7–11)', () => {
  it('Vida 0 elimina na hora: perde Constantes e energia, sai de Tóquio, assento pulado', () => {
    let s = game(3);
    M(s, 'p2').place = 'city';
    M(s, 'p2').hp = 2;
    M(s, 'p2').energy = 5;
    give(s, 'p2', 'gourmet');
    s = resolveWith(s, ['claw', 'claw', '1', '2', '3', '1']);
    const p2 = M(s, 'p2');
    expect([p2.alive, p2.cards.length, p2.energy, p2.place]).toEqual([false, 0, 0, 'out']);
    expect(s.discard).toContain('gourmet');
    expect(M(s, 'p1').place).toBe('city');
    s = endTurn(s);
    expect(turnOf(s)).toBe('p3');
  });

  it('só quem sofreu dano de garras pode ceder; atacante entra no lugar e ganha +1 PV', () => {
    let s = game(3);
    M(s, 'p2').place = 'city';
    s = resolveWith(s, ['claw', '1', '2', '3', '1', '2']);
    expect(status(s).currentPlayers).toEqual(['p2']);
    expect(fails(s, 'p1', { type: 'endTurn' })).toBeTruthy();
    s = play(s, 'p2', { type: 'yield', leave: true });
    expect(M(s, 'p2').place).toBe('out');
    expect(M(s, 'p1').place).toBe('city');
    expect(M(s, 'p1').vp).toBe(1);

    // dano de carta não abre janela de ceder
    s = game(3);
    M(s, 'p2').place = 'city';
    M(s, 'p1').energy = 3;
    s.market = ['rajada-de-fogo', null, null];
    s = toBuy(s);
    s = play(s, 'p1', { type: 'buy', cardId: 'rajada-de-fogo' });
    expect(s.pending).toBeNull();
    expect(M(s, 'p2').hp).toBe(8);
  });

  it('ficar em Tóquio: atacante não entra', () => {
    let s = game(3);
    M(s, 'p2').place = 'city';
    s = resolveWith(s, ['claw', '1', '2', '3', '1', '2']);
    s = play(s, 'p2', { type: 'yield', leave: false });
    expect(M(s, 'p2').place).toBe('city');
    expect(M(s, 'p1').place).toBe('out');
  });

  it('ambos cedendo: atacante vai para a Cidade e a Baía fica vazia', () => {
    let s = game(5);
    M(s, 'p2').place = 'city';
    M(s, 'p3').place = 'bay';
    s = resolveWith(s, ['claw', '1', '2', '3', '1', '2']);
    expect(status(s).currentPlayers.sort()).toEqual(['p2', 'p3']);
    s = play(s, 'p3', { type: 'yield', leave: true });
    s = play(s, 'p2', { type: 'yield', leave: true });
    expect(M(s, 'p1').place).toBe('city');
    expect(Object.values(s.monsters).filter((m) => m.place === 'bay')).toHaveLength(0);
    s = endTurn(s);
    s = resolveWith(s, blank);
    expect(M(s, 'p2').place).toBe('bay');
  });

  it('entrada obrigatória: Cidade vazia; com 5–6 vivos, Baía vazia', () => {
    let s = game(5);
    s = resolveWith(s, blank);
    expect(M(s, 'p1').place).toBe('city');
    s = endTurn(s);
    s = resolveWith(s, blank);
    expect(M(s, 'p2').place).toBe('bay');
    s = endTurn(s);
    s = resolveWith(s, blank);
    expect(M(s, 'p3').place).toBe('out');

    s = game(4);
    M(s, 'p2').place = 'city';
    s = resolveWith(s, blank);
    expect(M(s, 'p1').place).toBe('out');
  });

  it('+2 PV ao começar o turno em Tóquio', () => {
    let s = game(2);
    s = resolveWith(s, blank);
    s = endTurn(s);
    s = resolveWith(s, blank);
    s = endTurn(s);
    expect(M(s, 'p1').vp).toBe(3);
  });

  it('cair para 4 vivos: Baía sai e vai para a Cidade se vazia', () => {
    let s = game(5);
    M(s, 'p2').place = 'city';
    M(s, 'p3').place = 'bay';
    M(s, 'p2').hp = 1;
    s = resolveWith(s, ['claw', '1', '2', '3', '1', '2']);
    // p2 morreu; com 4 vivos p3 sai da Baía para a Cidade e ainda pode ceder
    expect(M(s, 'p2').alive).toBe(false);
    expect(M(s, 'p3').place).toBe('city');
    s = play(s, 'p3', { type: 'yield', leave: false });
    expect(M(s, 'p1').place).toBe('out');

    s = game(5);
    M(s, 'p2').place = 'city';
    M(s, 'p3').place = 'bay';
    M(s, 'p4').hp = 0;
    _test.checkDeaths(s);
    expect(M(s, 'p3').place).toBe('out');
  });
});

describe('compra (critérios 12–13)', () => {
  it('custo debitado, vaga reposta na hora; limpar custa 2; energia insuficiente → erro', () => {
    let s = game();
    s.market = ['cura', 'energizar', 'furor'];
    s.deck = ['tanques', 'arranha-ceu', 'trem-metropolitano', 'gourmet'];
    M(s, 'p1').energy = 5;
    s = toBuy(s);
    expect(fails(s, 'p1', { type: 'buy', cardId: 'energizar' })).toMatch(/Energia insuficiente/);
    s = play(s, 'p1', { type: 'buy', cardId: 'cura' });
    expect(M(s, 'p1').energy).toBe(2);
    expect(s.market).toEqual(['tanques', 'energizar', 'furor']);
    s = play(s, 'p1', { type: 'sweep' });
    expect(M(s, 'p1').energy).toBe(0);
    expect(s.market.sort()).toEqual(['arranha-ceu', 'gourmet', 'trem-metropolitano']);
    expect(s.discard).toEqual(expect.arrayContaining(['cura', 'tanques', 'energizar', 'furor']));
    expect(fails(s, 'p1', { type: 'sweep' })).toMatch(/limpar/);
  });

  it('baralho vazio: descarte embaralhado (determinístico); ambos vazios: vitrine com menos cartas', () => {
    const mk = () => {
      const s = game();
      s.market = ['cura', null, null];
      s.deck = [];
      s.discard = ['gourmet', 'tanques', 'furor'];
      M(s, 'p1').energy = 3;
      return play(toBuy(s), 'p1', { type: 'buy', cardId: 'cura' });
    };
    const a = mk();
    expect(a.market[0]).toBeTruthy();
    // a carta comprada já está no descarte quando ele é embaralhado
    expect(a.deck).toHaveLength(3);
    expect(a.discard).toEqual([]);
    expect(mk().market).toEqual(a.market);

    let s = game();
    s.market = ['gourmet', null, null];
    s.deck = [];
    s.discard = [];
    M(s, 'p1').energy = 4;
    s = play(toBuy(s), 'p1', { type: 'buy', cardId: 'gourmet' });
    expect(s.market).toEqual([null, null, null]);
  });
});

describe('fim de jogo (critério 14)', () => {
  it('20+ PV no fim do turno vence; dois com 20+ dividem a vitória', () => {
    let s = game(3);
    M(s, 'p1').vp = 19;
    s = resolveWith(s, ['1', '1', '1', '2', '3', 'heart']);
    expect(s.winners).toBeNull();
    s = endTurn(s);
    expect(status(s).winners).toEqual(['p1']);

    s = game(3);
    M(s, 'p1').vp = 18;
    M(s, 'p2').vp = 19;
    M(s, 'p3').vp = 25;
    M(s, 'p3').hp = 0;
    _test.checkDeaths(s);
    s = toBuy(s, ['2', '2', '2', '1', '3', 'heart']);
    s = endTurn(s);
    expect(status(s).winners).toEqual(['p1']);
  });

  it('dois vivos com 20+ no mesmo fim de turno: vitória compartilhada', () => {
    let s = game(3);
    M(s, 'p1').vp = 19;
    M(s, 'p2').vp = 20;
    s = toBuy(s);
    s = endTurn(s);
    expect(status(s).winners?.sort()).toEqual(['p1', 'p2']);
  });

  it('último sobrevivente vence; 20 PV com 0 Vida é eliminado; todos eliminados → ninguém vence', () => {
    let s = game(2);
    M(s, 'p2').place = 'city';
    M(s, 'p2').hp = 1;
    M(s, 'p2').vp = 22;
    s = resolveWith(s, ['claw', '1', '2', '3', '1', '2']);
    expect(status(s).winners).toEqual(['p1']);

    s = game(2);
    M(s, 'p1').hp = 3;
    M(s, 'p2').hp = 3;
    M(s, 'p1').energy = 4;
    s.market = ['bombardeio-das-alturas', null, null];
    s = play(toBuy(s), 'p1', { type: 'buy', cardId: 'bombardeio-das-alturas' });
    expect(status(s).phase).toBe('finished');
    expect(status(s).winners).toEqual([]);
  });
});

describe('catálogo (critério 15)', () => {
  it('66 cartas: 48 Constantes, 18 de Descarte, Ordens de Evacuação e Cabeça Extra em dobro', () => {
    const total = (k: string) => CARDS.filter((c) => c.kind === k).reduce((a, c) => a + (c.count ?? 1), 0);
    expect(total('keep')).toBe(48);
    expect(total('discard')).toBe(18);
    expect(CARD_BY_ID['ordens-de-evacuacao'].count).toBe(2);
    expect(CARD_BY_ID['cabeca-extra'].count).toBe(2);
    expect(CARDS).toHaveLength(64);
  });

  it('nome e custo batem com o RULES.md', async () => {
    const { readFileSync } = await import('node:fs');
    const md = readFileSync(join(__dirname, 'RULES.md'), 'utf8');
    const rows = [...md.matchAll(/^\| `([a-z-]+)`(?: \(×2\))? \| (.+?) \| (\d+) \|/gm)];
    expect(rows).toHaveLength(64);
    for (const [, id, name, cost] of rows) {
      expect(CARD_BY_ID[id], id).toBeDefined();
      expect(CARD_BY_ID[id].name).toBe(name);
      expect(CARD_BY_ID[id].cost).toBe(Number(cost));
    }
  });

  it('existe imagem para cada carta (critério 19)', () => {
    const dir = join(__dirname, '../../../apps/web/public/games/king-of-tokyo/cards');
    for (const c of CARDS) expect(existsSync(join(dir, `${c.id}.webp`)), c.id).toBe(true);
  });
});

/** Compra a carta (posta na vitrine) com energia suficiente, a partir da fase de compra. */
function buy(s: KingOfTokyoState, id: string, pid = 'p1', extraEnergy = 0): KingOfTokyoState {
  s.market = [id, null, null];
  s.deck = ['lojinha-da-esquina', 'lojinha-da-esquina', 'lojinha-da-esquina'];
  M(s, pid).energy += CARD_BY_ID[id].cost + extraEnergy;
  if (s.phase === 'roll') s = toBuy(s);
  return play(s, pid, { type: 'buy', cardId: id });
}

describe('cartas de Descarte', () => {
  it.each([
    ['lojinha-da-esquina', 1],
    ['trem-metropolitano', 2],
    ['predio-residencial', 3],
    ['arranha-ceu', 4],
  ])('%s dá %i PV', (id, vp) => {
    const s = buy(game(), id);
    expect(M(s, 'p1').vp).toBe(1 + vp);
    expect(s.discard).toContain(id);
  });

  it('Vindo do Alto: +2 PV e assume a Cidade sem o +1 de entrada', () => {
    let s = game(3);
    s = toBuy(s);
    // p1 já entrou na Cidade; passa a vez e p2 compra
    s = endTurn(s);
    s = toBuy(s);
    s = buy(s, 'vindo-do-alto', 'p2');
    expect(M(s, 'p2').place).toBe('city');
    expect(M(s, 'p2').vp).toBe(2);
    expect(M(s, 'p1').place).toBe('out');
    expect(M(s, 'p1').hp).toBe(10);
  });

  it('Energizar: +9 energia', () => {
    expect(M(buy(game(), 'energizar'), 'p1').energy).toBe(9);
  });

  it('Ordens de Evacuação: os outros perdem 5 PV (mínimo 0)', () => {
    let s = game(3);
    M(s, 'p2').vp = 7;
    M(s, 'p3').vp = 2;
    s = buy(s, 'ordens-de-evacuacao');
    expect([M(s, 'p2').vp, M(s, 'p3').vp]).toEqual([2, 0]);
  });

  it('Rajada de Fogo: 2 de dano nos outros', () => {
    const s = buy(game(3), 'rajada-de-fogo');
    expect([M(s, 'p1').hp, M(s, 'p2').hp, M(s, 'p3').hp]).toEqual([10, 8, 8]);
  });

  it('Furor: turno extra logo depois', () => {
    let s = buy(game(3), 'furor');
    s = endTurn(s);
    expect(turnOf(s)).toBe('p1');
    s = toBuy(s);
    s = endTurn(s);
    expect(turnOf(s)).toBe('p2');
  });

  it('Refinaria de Gás: +2 PV e 3 de dano nos outros', () => {
    const s = buy(game(3), 'refinaria-de-gas');
    expect([M(s, 'p1').vp, M(s, 'p2').hp, M(s, 'p3').hp]).toEqual([3, 7, 7]);
  });

  it('Cura: +2 Vida (limitada ao máximo)', () => {
    let s = game();
    M(s, 'p1').hp = 5;
    s = buy(s, 'cura');
    expect(M(s, 'p1').hp).toBe(7);
  });

  it('Bombardeio das Alturas: 3 em todos, inclusive o comprador', () => {
    const s = buy(game(3), 'bombardeio-das-alturas');
    expect([M(s, 'p1').hp, M(s, 'p2').hp, M(s, 'p3').hp]).toEqual([7, 7, 7]);
  });

  it.each([
    ['avioes-de-combate', 5, 4],
    ['guarda-nacional', 2, 2],
    ['tanques', 4, 3],
  ])('%s: +%i PV e o comprador sofre %i', (id, vp, dmg) => {
    const s = buy(game(), id);
    expect(M(s, 'p1').vp).toBe(1 + vp);
    expect(M(s, 'p1').hp).toBe(10 - dmg);
  });

  it('Usina de Energia Nuclear: +2 PV e +3 Vida', () => {
    let s = game();
    M(s, 'p1').hp = 4;
    s = buy(s, 'usina-de-energia-nuclear');
    expect([M(s, 'p1').vp, M(s, 'p1').hp]).toEqual([3, 7]);
  });

  it('Tempestade Gigante: +2 PV; os outros perdem 1 energia a cada 2', () => {
    let s = game(3);
    M(s, 'p2').energy = 5;
    M(s, 'p3').energy = 1;
    s = buy(s, 'tempestade-gigante');
    expect([M(s, 'p1').vp, M(s, 'p2').energy, M(s, 'p3').energy]).toEqual([3, 3, 1]);
  });

  it('comprador eliminado pela própria carta encerra o turno', () => {
    let s = game(3);
    M(s, 'p1').hp = 2;
    s = buy(s, 'guarda-nacional');
    expect(M(s, 'p1').alive).toBe(false);
    expect(turnOf(s)).toBe('p2');
  });
});

describe('cartas Constantes', () => {
  it('Acumulador de Energia: +1 PV por 6 energia no fim do turno', () => {
    let s = game();
    give(s, 'p1', 'acumulador-de-energia');
    M(s, 'p1').energy = 13;
    s = endTurn(toBuy(s));
    expect(M(s, 'p1').vp).toBe(1 + 2);
  });

  it('Ainda Maior: Vida máxima 12, +2 ao comprar; perder a carta corta o excesso', () => {
    let s = buy(game(), 'ainda-maior');
    expect(M(s, 'p1').hp).toBe(12);
    s = resolveWith(endTurn(s), ['heart', 'heart', 'heart', '1', '2', '3']);
    give(s, 'p2', 'metamorfose');
    expect((def.getPlayerView(s, 'p1') as KingOfTokyoView).monsters.p1.maxHp).toBe(12);
    // Tentáculos do p2 levam a carta
    give(s, 'p2', 'tentaculos-parasiticos');
    M(s, 'p2').energy = 4;
    s = play(s, 'p2', { type: 'buy', cardId: 'ainda-maior', from: 'p1' });
    expect(M(s, 'p1').hp).toBe(10);
    expect(M(s, 'p1').energy).toBe(4);
  });

  it('Alongado: paga 2 para mudar um dado', () => {
    let s = game();
    give(s, 'p1', 'alongado');
    M(s, 'p1').energy = 2;
    s = play(s, 'p1', { type: 'roll' });
    s = play(s, 'p1', { type: 'stretch', die: 0, face: 'claw' });
    expect(s.dice[0].face).toBe('claw');
    expect(M(s, 'p1').energy).toBe(0);
    expect(fails(s, 'p1', { type: 'stretch', die: 1, face: 'claw' })).toMatch(/Energia/);
  });

  it('Amigo das Crianças: +1 a cada ganho de energia', () => {
    let s = game();
    give(s, 'p1', 'amigo-das-criancas');
    s = resolveWith(s, ['energy', 'energy', '1', '2', '3', '1']);
    expect(M(s, 'p1').energy).toBe(3);
  });

  it('Armadura Blindada: ignora dano exatamente 1', () => {
    let s = game(3);
    M(s, 'p2').place = 'city';
    give(s, 'p2', 'armadura-blindada');
    s = resolveWith(s, ['claw', '1', '2', '3', '1', '2']);
    expect(M(s, 'p2').hp).toBe(10);
    expect(s.pending).toBeNull();
    s = game(3);
    M(s, 'p2').place = 'city';
    give(s, 'p2', 'armadura-blindada');
    s = resolveWith(s, ['claw', 'claw', '1', '2', '3', '1']);
    expect(M(s, 'p2').hp).toBe(8);
  });

  it('Asas: janela para quem tem 2+ energia; protege até o fim do turno (critério 16)', () => {
    let s = game(3);
    M(s, 'p2').place = 'city';
    give(s, 'p2', 'asas');
    M(s, 'p2').energy = 2;
    s = resolveWith(s, ['claw', 'claw', '1', '2', '3', '1']);
    expect(status(s).currentPlayers).toEqual(['p2']);
    expect(s.pending?.type).toBe('wings');
    s = play(s, 'p2', { type: 'wings', use: true });
    expect(M(s, 'p2').hp).toBe(10);
    expect(M(s, 'p2').energy).toBe(0);
    // o mesmo turno: Rajada de Fogo também não fere
    M(s, 'p1').energy = 3;
    s.market = ['rajada-de-fogo', null, null];
    s = play(s, 'p1', { type: 'buy', cardId: 'rajada-de-fogo' });
    expect(M(s, 'p2').hp).toBe(10);
    expect(M(s, 'p3').hp).toBe(8);
    s = endTurn(s);
    expect(M(s, 'p2').shielded).toBe(false);

    // sem energia, não abre janela
    s = game(3);
    M(s, 'p2').place = 'city';
    give(s, 'p2', 'asas');
    s = resolveWith(s, ['claw', '1', '2', '3', '1', '2']);
    expect(s.pending?.type).toBe('yield');
  });

  it('Ataque de Ácido: +1 de dano mesmo sem garras', () => {
    let s = game(3);
    M(s, 'p2').place = 'city';
    give(s, 'p1', 'ataque-de-acido');
    s = resolveWith(s, blank);
    expect(M(s, 'p2').hp).toBe(9);
  });

  it('Bateria de Monstros: o banco dobra a energia colocada; devolve 2 por turno; vazia é descartada', () => {
    let s = game(2);
    s = buy(s, 'bateria-de-monstros', 'p1', 3);
    expect(status(s).currentPlayers).toEqual(['p1']);
    s = play(s, 'p1', { type: 'battery', amount: 2 });
    const card = M(s, 'p1').cards.find((c) => c.id === 'bateria-de-monstros')!;
    expect(card.energy).toBe(4);
    expect(M(s, 'p1').energy).toBe(1);
    s = endTurn(s);
    s = endTurn(toBuy(s));
    expect(M(s, 'p1').energy).toBe(3);
    s = endTurn(toBuy(s));
    s = endTurn(toBuy(s));
    expect(M(s, 'p1').energy).toBe(5);
    expect(M(s, 'p1').cards.some((c) => c.id === 'bateria-de-monstros')).toBe(false);
  });

  it('Camuflagem: cada coração rolado anula 1 ponto de dano', () => {
    let s = game(3);
    M(s, 'p2').place = 'city';
    give(s, 'p2', 'camuflagem');
    s = resolveWith(s, ['claw', 'claw', 'claw', 'claw', 'claw', 'claw']);
    const line = s.log.find((l) => l.startsWith('Camuflagem'))!;
    const saved = Number(line.match(/anulou (\d+)/)![1]);
    expect(M(s, 'p2').hp).toBe(10 - 6 + saved);
  });

  it('Cauda com Pontas: +1 ao atacar', () => {
    let s = game(3);
    M(s, 'p2').place = 'city';
    give(s, 'p1', 'cauda-com-pontas');
    s = resolveWith(s, ['claw', '1', '2', '3', '1', '2']);
    expect(M(s, 'p2').hp).toBe(8);
    s = game(3);
    M(s, 'p2').place = 'city';
    give(s, 'p1', 'cauda-com-pontas');
    s = resolveWith(s, blank);
    expect(M(s, 'p2').hp).toBe(10);
  });

  it('Cerdas Envenenadas: 2 2 2 também causa 2 de dano', () => {
    let s = game(3);
    M(s, 'p2').place = 'city';
    give(s, 'p1', 'cerdas-envenenadas');
    s = resolveWith(s, ['2', '2', '2', '1', '3', 'heart']);
    expect(M(s, 'p2').hp).toBe(8);
  });

  it('Cérebro Gigante: 4 rolagens', () => {
    let s = game();
    give(s, 'p1', 'cerebro-gigante');
    _test.startTurn(s, 0);
    for (let i = 0; i < 4; i++) s = play(s, 'p1', { type: 'roll', keep: [] });
    expect(fails(s, 'p1', { type: 'roll', keep: [] })).toBeTruthy();
  });

  it('Chefe do Rebanho: muda um dado para 1, uma vez por turno', () => {
    let s = game();
    give(s, 'p1', 'chefe-do-rebanho');
    s = play(s, 'p1', { type: 'roll' });
    s = play(s, 'p1', { type: 'herd', die: 2 });
    expect(s.dice[2].face).toBe('1');
    expect(fails(s, 'p1', { type: 'herd', die: 3 })).toMatch(/já foi usado/);
  });

  it('Congelar o Tempo: 1 1 1 dá turno extra com 1 dado a menos, cumulativo', () => {
    let s = game(3);
    give(s, 'p1', 'congelar-o-tempo');
    s = endTurn(resolveWith(s, ['1', '1', '1', '2', '3', 'heart']));
    expect(turnOf(s)).toBe('p1');
    s = play(s, 'p1', { type: 'roll' });
    expect(s.dice).toHaveLength(5);
    s.dice = (['1', '1', '1', '2', '3'] as Face[]).map((face) => ({ face, kept: false }));
    s = endTurn(play(s, 'p1', { type: 'resolve' }));
    s = play(s, 'p1', { type: 'roll' });
    expect(s.dice).toHaveLength(4);
    s = endTurn(play(s, 'p1', { type: 'resolve' }));
    expect(turnOf(s)).toBe('p2');
  });

  it('Criado no Laboratório: só o dono vê o topo durante a compra e pode comprá-lo (critério 17)', () => {
    let s = game(3);
    give(s, 'p1', 'criado-no-laboratorio');
    s.deck = ['energizar', 'cura'];
    M(s, 'p1').energy = 8;
    expect((def.getPlayerView(s, 'p1') as KingOfTokyoView).deckTop).toBeNull();
    s = toBuy(s);
    expect((def.getPlayerView(s, 'p1') as KingOfTokyoView).deckTop).toBe('energizar');
    expect((def.getPlayerView(s, 'p2') as KingOfTokyoView).deckTop).toBeNull();
    expect(JSON.stringify(def.getPlayerView(s, 'p2'))).not.toContain('"deck"');
    s = play(s, 'p1', { type: 'buyTop' });
    expect(M(s, 'p1').energy).toBe(9);
    expect((def.getPlayerView(s, 'p1') as KingOfTokyoView).deckTop).toBe('cura');
  });

  it('Cura Rápida: aceita na vez e em janela; recusada fora (critério 16)', () => {
    let s = game(3);
    give(s, 'p2', 'cura-rapida');
    M(s, 'p2').energy = 4;
    M(s, 'p2').hp = 5;
    M(s, 'p2').place = 'city';
    expect(fails(s, 'p2', { type: 'quickHeal' })).toBeTruthy();
    s = resolveWith(s, ['claw', '1', '2', '3', '1', '2']);
    s = play(s, 'p2', { type: 'quickHeal' });
    expect([M(s, 'p2').hp, M(s, 'p2').energy]).toEqual([5, 2]);
    s = play(s, 'p2', { type: 'yield', leave: false });
    s = endTurn(s);
    s = play(s, 'p2', { type: 'quickHeal' });
    expect(M(s, 'p2').hp).toBe(6);
  });

  it('Cuspe Envenenado e Raio de Encolhimento dão fichas; Envenenado fere no fim do turno; corações removem fichas', () => {
    let s = game(3);
    M(s, 'p2').place = 'city';
    give(s, 'p1', 'cuspe-envenenado', 'raio-de-encolhimento');
    s = resolveWith(s, ['claw', '1', '2', '3', '1', '2']);
    expect([M(s, 'p2').poison, M(s, 'p2').shrink]).toEqual([1, 1]);
    s = play(s, 'p2', { type: 'yield', leave: true });
    s = endTurn(s);
    s = play(s, 'p2', { type: 'roll' });
    expect(s.dice).toHaveLength(5);
    s.dice = (['heart', '1', '2', '3', '1'] as Face[]).map((face) => ({ face, kept: false }));
    s = play(s, 'p2', { type: 'resolve' });
    expect([M(s, 'p2').poison, M(s, 'p2').shrink, M(s, 'p2').hp]).toEqual([0, 1, 9]);
    M(s, 'p2').poison = 2;
    s = endTurn(s);
    expect(M(s, 'p2').hp).toBe(7);
  });

  it('Destruição Total: uma face de cada dá +9 PV', () => {
    let s = game();
    give(s, 'p1', 'destruicao-total');
    s = resolveWith(s, ['1', '2', '3', 'energy', 'claw', 'heart']);
    expect(M(s, 'p1').vp).toBe(10);
  });

  it('Devorador de Mortos: +3 PV quando um monstro chega a 0', () => {
    let s = game(3);
    give(s, 'p3', 'devorador-de-mortos');
    M(s, 'p2').place = 'city';
    M(s, 'p2').hp = 1;
    s = resolveWith(s, ['claw', '1', '2', '3', '1', '2']);
    expect(M(s, 'p3').vp).toBe(3);
  });

  it('Ele Só Está Ficando Mais Forte: perder 2+ de uma vez dá +1 energia', () => {
    let s = game(3);
    M(s, 'p2').place = 'city';
    give(s, 'p2', 'ele-so-esta-ficando-mais-forte');
    s = resolveWith(s, ['claw', 'claw', '1', '2', '3', '1']);
    expect(M(s, 'p2').energy).toBe(1);
  });

  it('Ele Tem um Filho!: volta com 10 de Vida sem cartas, PV e energia', () => {
    let s = game(3);
    give(s, 'p3', 'devorador-de-mortos');
    M(s, 'p2').place = 'city';
    M(s, 'p2').hp = 1;
    M(s, 'p2').vp = 12;
    M(s, 'p2').energy = 6;
    give(s, 'p2', 'ele-tem-um-filho', 'gourmet');
    s = resolveWith(s, ['claw', '1', '2', '3', '1', '2']);
    const p2 = M(s, 'p2');
    expect([p2.alive, p2.hp, p2.vp, p2.energy, p2.cards.length, p2.place]).toEqual([true, 10, 0, 0, 0, 'out']);
    expect(M(s, 'p3').vp).toBe(3);
    expect(M(s, 'p1').place).toBe('city');
  });

  it('Equipe Exclusiva de Jornalismo: +1 PV por carta comprada depois', () => {
    let s = game();
    give(s, 'p1', 'equipe-exclusiva-de-jornalismo');
    s = buy(s, 'energizar');
    expect(M(s, 'p1').vp).toBe(2);
  });

  it('Escavando: +1 em Tóquio; ao ceder, 1 de dano em quem entra', () => {
    let s = game(3);
    M(s, 'p1').place = 'city';
    give(s, 'p1', 'escavando');
    s = resolveWith(s, ['claw', '1', '2', '3', '1', '2']);
    expect(M(s, 'p2').hp).toBe(8);
    s = game(3);
    M(s, 'p2').place = 'city';
    give(s, 'p2', 'escavando');
    s = resolveWith(s, ['claw', '1', '2', '3', '1', '2']);
    s = play(s, 'p2', { type: 'yield', leave: true });
    expect(M(s, 'p1').place).toBe('city');
    expect(M(s, 'p1').hp).toBe(9);
  });

  it('Espreitador: rerrola os 3 mesmo após a última rolagem', () => {
    let s = game();
    give(s, 'p1', 'espreitador');
    s.dice = (['3', '3', '1', '1', '1', '1'] as Face[]).map((face) => ({ face, kept: false }));
    s.ts.rollsUsed = 3;
    const rng = s.rng;
    s = play(s, 'p1', { type: 'stalk' });
    expect(s.rng).not.toBe(rng);
    expect(s.dice.slice(2).every((d) => d.face === '1')).toBe(true);
  });

  it('Energia Solar: +1 no fim do turno se tiver 0 energia', () => {
    let s = game();
    give(s, 'p1', 'energia-solar');
    s = endTurn(toBuy(s));
    expect(M(s, 'p1').energy).toBe(1);
  });

  it('Gourmet: 1 1 1 dá +2 PV extras', () => {
    let s = game();
    give(s, 'p1', 'gourmet');
    s = resolveWith(s, ['1', '1', '1', '2', '3', 'heart']);
    expect(M(s, 'p1').vp).toBe(1 + 3);
  });

  it('Hálito de Supernova: garras atingem todos os outros', () => {
    let s = game(4);
    M(s, 'p2').place = 'city';
    give(s, 'p1', 'halito-de-supernova');
    s = resolveWith(s, ['claw', '1', '2', '3', '1', '2']);
    expect([M(s, 'p2').hp, M(s, 'p3').hp, M(s, 'p4').hp]).toEqual([9, 9, 9]);
  });

  it('Herbívoro: +1 PV se não causou dano', () => {
    let s = game();
    give(s, 'p1', 'herbivoro');
    s = endTurn(toBuy(s));
    expect(M(s, 'p1').vp).toBe(2);
    s = game(3);
    M(s, 'p2').place = 'city';
    give(s, 'p1', 'herbivoro');
    s = play(resolveWith(s, ['claw', '1', '2', '3', '1', '2']), 'p2', { type: 'yield', leave: false });
    s = endTurn(s);
    expect(M(s, 'p1').vp).toBe(0);
  });

  it('Imitador: copia uma Constante; perde a cópia quando a original sai; muda pagando 1 no início do turno', () => {
    let s = game(3);
    give(s, 'p2', 'cauda-com-pontas', 'gourmet');
    s = buy(s, 'imitador');
    expect(s.pending?.type).toBe('mimic');
    s = play(s, 'p1', { type: 'mimic', cardId: 'gourmet' });
    s = endTurn(s);
    s = endTurn(toBuy(s));
    s = endTurn(toBuy(s));
    // início do turno: muda para Cauda com Pontas pagando 1
    M(s, 'p1').energy = 1;
    s = play(s, 'p1', { type: 'mimic', cardId: 'cauda-com-pontas' });
    expect(M(s, 'p1').energy).toBe(0);
    M(s, 'p2').place = 'city';
    M(s, 'p1').place = 'out';
    s = resolveWith(s, ['claw', '1', '2', '3', '1', '2']);
    expect(M(s, 'p2').hp).toBe(8);
    // a original sai de jogo (p2 eliminado): a cópia volta ao dono
    M(s, 'p2').hp = 0;
    _test.checkDeaths(s);
    expect(M(s, 'p1').cards.find((c) => c.id === 'imitador')!.copy).toBeNull();
  });

  it('Jatos: ao ceder, não sofre o dano das garras', () => {
    let s = game(3);
    M(s, 'p2').place = 'city';
    give(s, 'p2', 'jatos');
    s = resolveWith(s, ['claw', 'claw', '1', '2', '3', '1']);
    expect(M(s, 'p2').hp).toBe(8);
    s = play(s, 'p2', { type: 'yield', leave: true });
    expect(M(s, 'p2').hp).toBe(10);
  });

  // [QA] achado do PR #21: o dano letal elimina o dono dos Jatos antes da decisão de ceder
  it.fails('Jatos: ceder Tóquio evita também o dano que seria letal', () => {
    let s = game(3);
    M(s, 'p2').place = 'city';
    M(s, 'p2').hp = 2;
    give(s, 'p2', 'jatos');
    s = resolveWith(s, ['claw', 'claw', 'claw', '1', '2', '3']);
    expect(status(s).currentPlayers).toEqual(['p2']);
    s = play(s, 'p2', { type: 'yield', leave: true });
    expect(M(s, 'p2').alive).toBe(true);
    expect(M(s, 'p2').hp).toBe(2);
  });

  it('Metabolismo Alienígena: cartas custam 1 a menos', () => {
    let s = game();
    give(s, 'p1', 'metabolismo-alienigena');
    s.market = ['cura', null, null];
    M(s, 'p1').energy = 2;
    s = play(toBuy(s), 'p1', { type: 'buy', cardId: 'cura' });
    expect(M(s, 'p1').energy).toBe(0);
  });

  it('Metamorfose: descarta Constante e recebe o custo em energia', () => {
    let s = game();
    give(s, 'p1', 'metamorfose', 'gourmet');
    s = play(toBuy(s), 'p1', { type: 'metamorph', cardId: 'gourmet' });
    expect(M(s, 'p1').energy).toBe(4);
    expect(s.discard).toContain('gourmet');
  });

  it('Monstro Alfa: +1 PV ao atacar', () => {
    let s = game(3);
    give(s, 'p1', 'monstro-alfa');
    s = resolveWith(s, ['claw', '1', '2', '3', '1', '2']);
    expect(M(s, 'p1').vp).toBe(2);
  });

  it('Nuvem de Fumaça: 3 cargas de rolagem extra; sem cargas é descartada', () => {
    let s = buy(game(), 'nuvem-de-fumaca');
    s = endTurn(s);
    s = endTurn(toBuy(s));
    for (let i = 0; i < 3; i++) s = play(s, 'p1', { type: 'roll', keep: [] });
    for (let i = 0; i < 3; i++) {
      s = play(s, 'p1', { type: 'smoke' });
      s = play(s, 'p1', { type: 'roll', keep: [] });
    }
    expect(M(s, 'p1').cards.some((c) => c.id === 'nuvem-de-fumaca')).toBe(false);
    expect(fails(s, 'p1', { type: 'smoke' })).toBeTruthy();
  });

  it('Onívoro: 1 2 3 vale 2 PV', () => {
    let s = game();
    give(s, 'p1', 'onivoro');
    s = resolveWith(s, ['1', '2', '3', 'heart', 'heart', 'energy']);
    expect(M(s, 'p1').vp).toBe(3);
  });

  it('Oportunista: compra a carta revelada no turno de outro; abre só para quem pode pagar (critério 16)', () => {
    let s = game(3);
    give(s, 'p2', 'oportunista');
    give(s, 'p3', 'oportunista');
    M(s, 'p2').energy = 5;
    M(s, 'p3').energy = 1;
    s.market = ['cura', null, null];
    s.deck = ['tanques', 'energizar'];
    M(s, 'p1').energy = 3;
    s = play(toBuy(s), 'p1', { type: 'buy', cardId: 'cura' });
    expect(status(s).currentPlayers).toEqual(['p2']);
    s = play(s, 'p2', { type: 'opportunist', buy: true });
    expect(M(s, 'p2').vp).toBe(4);
    expect(s.market[0]).toBe('energizar');
    // p2 com 1 energia não pode pagar Energizar; p3 também não
    expect(s.pending).toBeNull();
    expect(status(s).currentPlayers).toEqual(['p1']);
  });

  it('Raio de Cura: cura outros, que pagam 2 energia por Vida (critério 16)', () => {
    let s = game(3);
    give(s, 'p1', 'raio-de-cura');
    M(s, 'p2').hp = 6;
    M(s, 'p2').energy = 3;
    M(s, 'p1').hp = 8;
    s = resolveWith(s, ['heart', 'heart', 'heart', '1', '2', '3']);
    expect(status(s).currentPlayers).toEqual(['p1']);
    s = play(s, 'p1', { type: 'healRay', target: 'p2', amount: 2 });
    expect([M(s, 'p2').hp, M(s, 'p2').energy, M(s, 'p1').energy]).toEqual([8, 0, 3]);
    s = play(s, 'p1', { type: 'healRay', target: null });
    expect(M(s, 'p1').hp).toBe(9);
  });

  it('Regeneração: +1 extra ao se curar', () => {
    let s = game();
    give(s, 'p1', 'regeneracao');
    M(s, 'p1').hp = 5;
    s = resolveWith(s, ['heart', '1', '2', '3', '1', '2']);
    expect(M(s, 'p1').hp).toBe(7);
  });

  it('Reviravolta: muda um dado e é descartada', () => {
    let s = game();
    give(s, 'p1', 'reviravolta');
    s = play(s, 'p1', { type: 'roll' });
    s = play(s, 'p1', { type: 'twist', die: 0, face: 'heart' });
    expect(s.dice[0].face).toBe('heart');
    expect(M(s, 'p1').cards).toHaveLength(0);
    expect(s.discard).toContain('reviravolta');
  });

  it('Sonda Psíquica: depois da rolagem do outro, rerrola 1 dado dele, uma vez por turno (critério 16)', () => {
    let s = game(3);
    give(s, 'p2', 'sonda-psiquica');
    s = play(s, 'p1', { type: 'roll' });
    expect(status(s).currentPlayers).toEqual(['p2']);
    s = play(s, 'p2', { type: 'probe', die: null });
    s = play(s, 'p1', { type: 'roll', keep: [] });
    expect(s.pending?.type).toBe('probe');
    const rng = s.rng;
    s = play(s, 'p2', { type: 'probe', die: 0 });
    expect(s.rng).not.toBe(rng);
    if (M(s, 'p2').cards.length) {
      s = play(s, 'p1', { type: 'roll', keep: [] });
      expect(s.pending).toBeNull();
    }
  });

  it('Sonda Psíquica: coração na rerrolagem descarta a carta', () => {
    for (let seed = 1; seed < 60; seed++) {
      let s = game(2, true, seed);
      give(s, 'p2', 'sonda-psiquica');
      s = play(s, 'p1', { type: 'roll' });
      s = play(s, 'p2', { type: 'probe', die: 0 });
      if (s.dice[0].face === 'heart') {
        expect(M(s, 'p2').cards).toHaveLength(0);
        return;
      }
    }
    throw new Error('nenhuma semente tirou coração');
  });

  it('Sopro de Fogo: vizinhos sofrem 1 extra ao causar dano', () => {
    let s = game(4);
    M(s, 'p3').place = 'city';
    give(s, 'p1', 'sopro-de-fogo');
    s = resolveWith(s, ['claw', '1', '2', '3', '1', '2']);
    expect([M(s, 'p2').hp, M(s, 'p3').hp, M(s, 'p4').hp]).toEqual([9, 9, 9]);
  });

  it('Telepata: paga 1 por rolagem extra', () => {
    let s = game();
    give(s, 'p1', 'telepata');
    M(s, 'p1').energy = 1;
    for (let i = 0; i < 3; i++) s = play(s, 'p1', { type: 'roll', keep: [] });
    s = play(s, 'p1', { type: 'telepath' });
    s = play(s, 'p1', { type: 'roll', keep: [] });
    expect(s.ts.rollsUsed).toBe(4);
    expect(M(s, 'p1').energy).toBe(0);
  });

  it('Tentáculos Parasíticos: compra Constante de outro pagando a ele', () => {
    let s = game();
    give(s, 'p1', 'tentaculos-parasiticos');
    give(s, 'p2', 'gourmet');
    M(s, 'p1').energy = 4;
    s = play(toBuy(s), 'p1', { type: 'buy', cardId: 'gourmet', from: 'p2' });
    expect(M(s, 'p1').cards.map((c) => c.id)).toContain('gourmet');
    expect([M(s, 'p1').energy, M(s, 'p2').energy, M(s, 'p2').cards.length]).toEqual([0, 4, 0]);
  });

  it('Torcendo pelo Azarão: +1 PV no fim de qualquer turno com menos PV que todos', () => {
    let s = game(3);
    give(s, 'p3', 'torcendo-pelo-azarao');
    M(s, 'p2').vp = 1;
    s = endTurn(toBuy(s));
    expect(M(s, 'p3').vp).toBe(1);
  });

  it('Urbanívoro: +1 PV ao começar em Tóquio; +1 de dano em Tóquio', () => {
    let s = game(3);
    give(s, 'p1', 'urbanivoro');
    M(s, 'p1').place = 'city';
    _test.startTurn(s, 0);
    expect(M(s, 'p1').vp).toBe(3);
    s = resolveWith(s, ['claw', '1', '2', '3', '1', '2']);
    expect(M(s, 'p2').hp).toBe(8);
  });

  it('toda carta do catálogo tem teste', () => {
    const src = require('node:fs').readFileSync(__filename, 'utf8') as string;
    for (const c of CARDS) expect(src.includes(`'${c.id}'`) || src.includes(c.name), c.id).toBe(true);
  });
});

describe('view e informação oculta (critério 17)', () => {
  it('a ordem do baralho nunca aparece na view', () => {
    const s = game(3);
    for (const p of ['p1', 'p2', 'p3', null]) {
      const v = def.getPlayerView(s, p) as KingOfTokyoView & { deck?: unknown; rng?: unknown };
      expect(v.deck).toBeUndefined();
      expect(v.rng).toBeUndefined();
      expect(v.deckCount).toBe(s.deck.length);
    }
  });
});

function leakCheck(s: KingOfTokyoState, pid: string, v: KingOfTokyoView & Record<string, unknown>): string | null {
  if ('deck' in v || 'rng' in v || 'queue' in v) return 'view expõe baralho, rng ou fila';
  const allowed = count(s, pid);
  if (v.deckTop !== null && !allowed) return 'topo do baralho visível sem Criado no Laboratório';
  return null;
}

function count(s: KingOfTokyoState, pid: string) {
  const m = s.monsters[pid];
  return s.phase === 'buy' && !s.pending && s.players[s.turn].id === pid && m.cards.some((c) => c.id === 'criado-no-laboratorio' || c.copy === 'criado-no-laboratorio');
}

/** Guia as partidas aleatórias para terminarem: prefere atacar e comprar a ficar rolando para sempre. */
function chooseAction(legal: KingOfTokyoAction[], rng: { next(): number; pick<T>(a: readonly T[]): T }) {
  const resolve = legal.find((a) => a.type === 'resolve');
  if (resolve && rng.next() < 0.4) return resolve;
  const end = legal.find((a) => a.type === 'endTurn');
  if (end && rng.next() < 0.3) return end;
  return rng.pick(legal);
}

describe('conformidade (critério 18)', () => {
  it('com cartas de Poder, de 2 a 6 jogadores', () => {
    const r = runConformance(def, {
      playerCounts: [2, 3, 4, 5, 6],
      optionSets: [{ powerCards: true }],
      seeds: 4,
      maxSteps: 6000,
      requireFinish: true,
      leakCheck,
      chooseAction,
    });
    expect(r.finished).toBe(r.games);
  }, 60_000);

  it('sem cartas de Poder', () => {
    const r = runConformance(def, {
      playerCounts: [2, 4, 6],
      optionSets: [{ powerCards: false }],
      seeds: 5,
      maxSteps: 4000,
      requireFinish: true,
      leakCheck,
      chooseAction,
    });
    expect(r.finished).toBe(r.games);
  }, 60_000);
});
