#!/usr/bin/env node
/**
 * Teste de fumaça ponta a ponta contra um servidor rodando (local ou preview).
 * Uso: node scripts/smoke.mjs http://localhost:8787
 * Cria uma sala, conecta 2 jogadores, escolhe Dominó, marca pronto, inicia e faz uma jogada.
 */
const base = (process.argv[2] ?? 'http://localhost:8787').replace(/\/$/, '');
const wsBase = base.replace(/^http/, 'ws');
const TIMEOUT = 15000;

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function client(code, name) {
  const token = `smoke-${name}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const ws = new WebSocket(`${wsBase}/ws/${code}`);
  const state = { room: null, game: null, you: null, errors: [] };
  const waiters = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.t === 'room') {
      state.room = msg.room;
      state.you = msg.you;
    } else if (msg.t === 'game') state.game = msg;
    else if (msg.t === 'error') state.errors.push(msg.message);
    for (const w of [...waiters]) if (w.pred(state)) {
      waiters.splice(waiters.indexOf(w), 1);
      w.resolve(state);
    }
  });
  const opened = new Promise((res, rej) => {
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ t: 'hello', token, name }));
      res();
    });
    ws.addEventListener('error', () => rej(new Error(`WebSocket falhou (${name})`)));
  });
  return {
    state,
    opened,
    send: (m) => ws.send(JSON.stringify(m)),
    until: (pred, what) =>
      new Promise((resolve, reject) => {
        if (pred(state)) return resolve(state);
        const w = { pred, resolve };
        waiters.push(w);
        setTimeout(() => reject(new Error(`timeout esperando: ${what}; erros: ${state.errors.join(' | ')}`)), TIMEOUT);
      }),
    close: () => ws.close(),
  };
}

try {
  const health = await fetch(`${base}/api/health`).then((r) => r.json());
  if (!health.ok) fail('health');
  console.log('✓ /api/health');

  const { code } = await fetch(`${base}/api/rooms`, { method: 'POST' }).then((r) => r.json());
  if (!/^[A-Z0-9]{5}$/.test(code ?? '')) fail(`código de sala inválido: ${code}`);
  console.log(`✓ sala criada: ${code}`);
  const exists = await fetch(`${base}/api/rooms/${code}`).then((r) => r.json());
  if (!exists.exists) fail('sala não encontrada após criação');

  const a = client(code, 'Ana');
  await a.opened;
  await a.until((s) => s.room?.players.length === 1, 'Ana entrar');
  if (a.state.room.ownerId !== a.state.you) fail('primeiro jogador deveria ser o dono');
  const b = client(code, 'Beto');
  await b.opened;
  await a.until((s) => s.room?.players.length === 2, 'Beto entrar');
  console.log('✓ 2 jogadores na sala');

  a.send({ t: 'setGame', gameId: 'domino' });
  await b.until((s) => s.room?.gameId === 'domino', 'jogo escolhido');
  a.send({ t: 'setOptions', options: { pointsToWin: 50 } });
  b.send({ t: 'ready', ready: true });
  await a.until((s) => s.room?.players.find((p) => p.id !== s.you)?.ready && s.room.options.pointsToWin === 50, 'Beto pronto');
  console.log('✓ jogo, opções e pronto');

  a.send({ t: 'start' });
  await a.until((s) => s.room?.status === 'playing' && s.game, 'partida iniciar');
  await b.until((s) => s.game, 'Beto receber o jogo');
  console.log('✓ partida iniciada');

  const turnOf = a.state.game.status.currentPlayers[0];
  const player = turnOf === a.state.you ? a : b;
  const action = player.state.game.legal[0];
  if (!action) fail('jogador da vez sem ações legais');
  const seq = player.state.game.seq;
  player.send({ t: 'action', action });
  await a.until((s) => s.game?.seq === seq + 1, 'jogada propagar');
  console.log('✓ jogada aplicada e propagada');

  // informação oculta: a view de A não contém a mão de B
  const handB = JSON.stringify(b.state.game.view.myHand);
  if (JSON.stringify(a.state.game.view).includes(handB)) fail('vazamento da mão do adversário');
  console.log('✓ informação oculta preservada');

  a.close();
  b.close();
  console.log('\nSmoke test OK');
  process.exit(0);
} catch (e) {
  fail(e.message);
}
