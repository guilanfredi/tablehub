#!/usr/bin/env node
/**
 * Despachante contínuo do time de agentes do TableHub.
 *
 * Fica rodando (iniciado no logon pelo Agendador de Tarefas) e consulta o GitHub a cada 15 s com ETag.
 * Quando uma issue/PR espera uma função (etiquetas fase:*), roda `claude -p "/<função> <n>"` num worktree
 * dedicado, com até MAX_TOTAL execuções em paralelo, cada uma com suas próprias portas.
 * Parado, não consome cota da assinatura.
 *
 *   node automation/dispatcher/index.mjs              roda continuamente
 *   node automation/dispatcher/index.mjs --dry-run    mostra o que seria executado agora e sai
 *   --only <função>   restringe a uma função          --max <n>   muda o limite de paralelismo
 */
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AGENTS_DIR, BOT, BOT_EMAIL, LABEL_WAITING, LABEL_WORKING, LOG_DIR, MANUALS_DIR, MAX_PER_ROLE, MAX_RUNS_WITHOUT_PROGRESS,
  MAX_TOTAL, OWNER, POLL_SECONDS, REPO, RETRY_COOLDOWN_MIN, ROLES, ROLES_DIR, ROOT, STATE_DIR, autoPrompt, lanePorts,
} from './config.mjs';
import { GitHub, findGh } from './github.mjs';
import { findClaude, isAlive, killJobTree } from './proc.mjs';
import { classifyError, freeSlot, madeProgress, pickJobs, recordRun } from './select.mjs';

// ---------------- argumentos ----------------
const argv = process.argv.slice(2);
const argValue = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const DRY = argv.includes('--dry-run');
const ONLY = argValue('--only');
const MAX = Number(argValue('--max') ?? MAX_TOTAL);
if (ONLY && !ROLES.some((r) => r.name === ONLY)) { console.error(`Função desconhecida: ${ONLY}`); process.exit(2); }

mkdirSync(STATE_DIR, { recursive: true });
mkdirSync(LOG_DIR, { recursive: true });
mkdirSync(MANUALS_DIR, { recursive: true });

const FILES = {
  daemon: join(STATE_DIR, 'daemon.json'),
  jobs: join(STATE_DIR, 'jobs.json'),
  history: join(STATE_DIR, 'history.json'),
  pause: join(STATE_DIR, 'paused-until.txt'),
  legacyLock: join(STATE_DIR, 'running.json'),
};
const CFG = { owner: OWNER, bot: BOT, working: LABEL_WORKING, waiting: LABEL_WAITING };
const RETRY = { cooldownMin: RETRY_COOLDOWN_MIN, maxRuns: MAX_RUNS_WITHOUT_PROGRESS };

// ---------------- utilidades ----------------
function log(msg) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const line = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${msg}`;
  console.log(line);
  try { appendFileSync(join(LOG_DIR, 'dispatcher.log'), line + '\n'); } catch { /* log nunca derruba o despachante */ }
}

function readJson(file, fallback) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data) { writeFileSync(file, JSON.stringify(data, null, 2)); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kindOf = (isPr) => (isPr ? 'PR' : 'issue');

async function safe(what, fn) {
  try { return await fn(); } catch (e) { log(`AVISO: ${what}: ${e.message}`); return undefined; }
}

// o Bash dos agentes herda este PATH: garante o gh
const ghPath = findGh();
if (ghPath !== 'gh') process.env.Path = `${join(ghPath, '..')};${process.env.Path ?? process.env.PATH ?? ''}`;

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      if (err) { err.message = `${cmd} ${args.join(' ')}: ${(stderr || err.message).trim().split('\n').at(-1)}`; return reject(err); }
      resolve(stdout);
    });
  });
}

/** git com novas tentativas: agentes em outros worktrees também mexem no .git compartilhado. */
async function git(args) {
  for (let attempt = 1; ; attempt++) {
    try { return await run('git', args); } catch (e) {
      if (attempt >= 3) throw e;
      await sleep(2000 * attempt);
    }
  }
}

// operações de git do despachante, uma de cada vez
let gitChain = Promise.resolve();
function withGitLock(fn) {
  const p = gitChain.then(fn, fn);
  gitChain = p.catch(() => { });
  return p;
}

function pausedUntil() {
  if (!existsSync(FILES.pause)) return null;
  const until = Date.parse(readFileSync(FILES.pause, 'utf8').trim());
  if (!(until > Date.now())) { try { unlinkSync(FILES.pause); } catch { } return null; }
  return until;
}

// ---------------- estado ----------------
const gh = new GitHub(REPO);
let running = [];
let history = readJson(FILES.history, {});
const waitingCache = new Map();

const JOB_FIELDS = ['role', 'number', 'title', 'isPr', 'lane', 'slot', 'pid', 'startedAt', 'timeoutMin', 'logFile', 'labeled', 'status', 'legacy'];
function saveJobs() {
  writeJson(FILES.jobs, running.map((j) => Object.fromEntries(JOB_FIELDS.filter((k) => j[k] !== undefined).map((k) => [k, j[k]]))));
}
function saveHistory() { writeJson(FILES.history, history); }

/** Itens 'aguardando-dono' em que o dono já respondeu (cache pelo updated_at do item). */
async function resolveWaiting(items) {
  const resolved = new Set();
  for (const it of items) {
    if (!it.labels.includes(LABEL_WAITING) || !ROLES.some((r) => it.labels.includes(r.label))) continue;
    if (it.author !== OWNER && it.author !== BOT) continue;
    const cached = waitingCache.get(it.number);
    if (cached?.updatedAt !== it.updatedAt) {
      const since = await gh.labelAddedAt(it.number, LABEL_WAITING);
      waitingCache.set(it.number, { updatedAt: it.updatedAt, resolved: await gh.ownerRepliedAfter(it.number, since, it.isPr, OWNER) });
    }
    if (waitingCache.get(it.number).resolved) resolved.add(it.number);
  }
  return resolved;
}

// ---------------- worktree ----------------
async function prepareWorktree(roleName, slot) {
  const wt = join(AGENTS_DIR, `${roleName}-${slot}`);
  await withGitLock(async () => {
    if (!existsSync(wt)) {
      mkdirSync(AGENTS_DIR, { recursive: true });
      await git(['-C', ROOT, 'worktree', 'prune']);
      await git(['-C', ROOT, 'fetch', '-q', 'origin']);
      await git(['-C', ROOT, 'worktree', 'add', '-q', '--detach', wt, 'origin/main']);
    }
    await git(['-C', wt, 'fetch', '-q', 'origin']);
    await git(['-C', wt, 'reset', '-q', '--hard']);
    await git(['-C', wt, 'clean', '-q', '-fd', '-e', 'node_modules']);
    await git(['-C', wt, 'switch', '-q', '--detach', 'origin/main']);
    await git(['-C', wt, 'config', 'user.name', BOT]);
    await git(['-C', wt, 'config', 'user.email', BOT_EMAIL]);
  });
  const lockHash = createHash('sha256').update(readFileSync(join(wt, 'package-lock.json'))).digest('hex');
  const marker = join(wt, 'node_modules', '.lock-hash');
  if (readJson(marker, null) !== lockHash) {
    log(`npm ci em ${wt}...`);
    // .cmd no Windows só roda via shell
    await run('npm ci --no-audit --no-fund', [], { cwd: wt, shell: true, timeout: 30 * 60_000 });
    writeJson(marker, lockHash);
  }
  return wt;
}

// ---------------- execuções ----------------
async function startJob(role, item) {
  const job = {
    role: role.name, number: item.number, title: item.title, isPr: item.isPr, timeoutMin: role.timeoutMin,
    lane: freeSlot(running.map((j) => j.lane)),
    slot: freeSlot(running.filter((j) => j.role === role.name).map((j) => j.slot)),
    startedAt: Date.now(), status: 'preparando', labeled: false,
  };
  running.push(job); // reserva antes de qualquer await: a próxima consulta já vê o item ocupado
  saveJobs();
  log(`Trabalho: /${role.name} ${item.number} (${kindOf(item.isPr)}: ${item.title}) — faixa ${job.lane}, ${running.length}/${MAX} em uso`);
  try {
    if (item.labels.includes(LABEL_WAITING)) {
      log(`#${item.number}: @${OWNER} respondeu; retomando.`);
      await gh.removeLabel(item.number, LABEL_WAITING);
    }
    const wt = await prepareWorktree(role.name, job.slot);
    const claude = findClaude();
    if (!claude) throw new Error('Claude Code CLI não encontrado.');
    const ports = lanePorts(job.lane);
    await gh.addLabel(item.number, LABEL_WORKING);
    job.labeled = true;

    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    job.logFile = join(LOG_DIR, `${stamp}-${role.name}-${item.number}.json`);
    const promptFile = join(STATE_DIR, `auto-prompt-${job.lane}.txt`);
    writeFileSync(promptFile, autoPrompt(ports));
    const out = openSync(job.logFile, 'w');
    const err = openSync(`${job.logFile}.err`, 'w');
    const child = spawn(claude, [
      '-p', `/${role.name} ${item.number}`,
      '--settings', join(ROLES_DIR, `${role.name}.json`),
      '--append-system-prompt-file', promptFile,
      '--add-dir', MANUALS_DIR,
      '--output-format', 'json',
    ], {
      cwd: wt,
      stdio: ['ignore', out, err],
      windowsHide: true,
      env: {
        ...process.env,
        TABLEHUB_AGENT: `${role.name} ${item.number}`,
        TABLEHUB_WEB_PORT: String(ports.web),
        TABLEHUB_WORKER_PORT: String(ports.worker),
        TABLEHUB_INSPECTOR_PORT: String(ports.inspector),
      },
    });
    closeSync(out);
    closeSync(err);
    job.pid = child.pid;
    job.startedAt = Date.now();
    job.status = 'rodando';
    saveJobs();
    child.on('exit', () => finalize(job));
    child.on('error', (e) => { log(`ERRO: /${role.name} ${item.number}: ${e.message}`); finalize(job); });
    job.timer = setTimeout(() => timeoutJob(job), role.timeoutMin * 60_000);
  } catch (e) {
    log(`ERRO ao iniciar /${role.name} ${item.number}: ${e.message}`);
    if (job.labeled) await safe('remover etiqueta', () => gh.removeLabel(item.number, LABEL_WORKING));
    history = recordRun(history, item.number, role.name, false, Date.now(), RETRY).history;
    saveHistory();
    running = running.filter((j) => j !== job);
    saveJobs();
  }
}

async function timeoutJob(job) {
  if (job.finalized || job.timedOut) return;
  job.timedOut = true;
  log(`TIMEOUT: /${job.role} ${job.number} passou de ${job.timeoutMin} min e foi encerrado.`);
  await killJobTree(job.pid, job.startedAt, { killRoot: true });
  if (job.adopted) finalize(job); // sem processo filho, não há evento de saída
}

function readResult(logFile) {
  if (!logFile) return null;
  try { return JSON.parse(readFileSync(logFile, 'utf8').replace(/^﻿/, '')); } catch { return null; }
}

async function finalize(job) {
  if (job.finalized) return;
  job.finalized = true;
  clearTimeout(job.timer);
  const name = `/${job.role} ${job.number}`;
  try {
    if (job.pid) {
      const leftovers = await killJobTree(job.pid, job.startedAt);
      if (leftovers) log(`${name}: ${leftovers} processo(s) que sobraram encerrados (servidores, navegador).`);
    }
    if (job.timedOut) {
      await safe('comentar timeout', () => gh.comment(job.number, `**[Automação]** A função ${job.role} excedeu ${job.timeoutMin} min e foi interrompida. @${OWNER}, veja os logs locais.`));
      await safe('etiqueta aguardando', () => gh.addLabel(job.number, LABEL_WAITING));
    } else {
      const result = readResult(job.logFile);
      if (result?.is_error) {
        const text = String(result.result ?? '');
        log(`ERRO: ${name}: ${text}`);
        const kind = classifyError(text);
        if (kind) {
          writeFileSync(FILES.pause, new Date(Date.now() + kind.pauseMin * 60_000).toISOString());
          log(`${kind.reason} Pausado por ${kind.pauseMin} min (execuções em andamento continuam).`);
        }
      } else if (result) {
        log(`OK: ${name}: ${result.result}`);
      } else {
        log(`Saída inesperada de ${name}; veja ${job.logFile ?? 'os logs'}`);
      }
    }
    if (job.labeled !== false) await safe('remover etiqueta', () => gh.removeLabel(job.number, LABEL_WORKING));

    const role = ROLES.find((r) => r.name === job.role);
    const after = await safe(`ler #${job.number}`, () => gh.getIssue(job.number));
    // timeout já chamou o dono; sem conseguir ler o item, não conta como falha
    const progressed = job.timedOut || after === undefined || madeProgress(after, role, LABEL_WAITING);
    const r = recordRun(history, job.number, job.role, progressed, Date.now(), RETRY);
    history = r.history;
    saveHistory();
    if (r.escalate) {
      log(`${name}: ${MAX_RUNS_WITHOUT_PROGRESS} execuções seguidas sem avançar; chamando @${OWNER}.`);
      await safe('comentar', () => gh.comment(job.number, `**[Automação]** A função ${job.role} rodou ${MAX_RUNS_WITHOUT_PROGRESS} vezes seguidas sem avançar a fase. @${OWNER}, veja os logs locais e comente aqui para retomar.`));
      await safe('etiqueta aguardando', () => gh.addLabel(job.number, LABEL_WAITING));
    } else if (!progressed) {
      log(`${name}: terminou sem avançar a fase; nova tentativa em ${RETRY_COOLDOWN_MIN} min.`);
    }
  } catch (e) {
    log(`ERRO ao finalizar ${name}: ${e.message}`);
  } finally {
    running = running.filter((j) => j !== job);
    saveJobs();
    tick(true); // vaga liberada: consulta de novo, ignorando o ETag (as etiquetas acabaram de mudar)
  }
}

// ---------------- ciclo ----------------
let ticking = false;
let again = false;
let forceNext = false;
let lastError = { msg: '', at: 0 };
let pauseLogged = 0;

async function tick(force = false) {
  if (ticking) { again = true; forceNext ||= force; return; }
  ticking = true;
  try {
    for (const j of running) {
      if (!j.adopted || j.finalized) continue;
      if (!isAlive(j.pid)) finalize(j);
      else if (Date.now() - j.startedAt > j.timeoutMin * 60_000) timeoutJob(j);
    }
    const { items } = await gh.listOpen({ force });
    const until = pausedUntil();
    if (until) {
      if (pauseLogged !== until) { log(`Pausado até ${new Date(until).toLocaleString('pt-BR')}.`); pauseLogged = until; }
      return;
    }
    const roles = ONLY ? ROLES.filter((r) => r.name === ONLY) : ROLES;
    const picks = pickJobs({
      items, running, roles, maxTotal: MAX, maxPerRole: MAX_PER_ROLE, history, now: Date.now(), cfg: CFG,
      waitingResolved: await resolveWaiting(items),
    });
    for (const p of picks) startJob(p.role, p.item);
    lastError = { msg: '', at: 0 };
  } catch (e) {
    // sem rede, GitHub fora etc.: registra uma vez a cada 10 min
    if (e.message !== lastError.msg || Date.now() - lastError.at > 10 * 60_000) {
      log(`ERRO na consulta: ${e.message}`);
      lastError = { msg: e.message, at: Date.now() };
    }
  } finally {
    ticking = false;
    if (again) {
      const f = forceNext;
      again = false;
      forceNext = false;
      setImmediate(() => tick(f));
    }
  }
}

// ---------------- início ----------------
function newestLog(role, number) {
  try {
    return readdirSync(LOG_DIR).filter((f) => f.endsWith(`-${role}-${number}.json`)).sort().map((f) => join(LOG_DIR, f)).at(-1);
  } catch { return undefined; }
}

async function adoptPreviousJobs() {
  const dead = [];
  for (const j of readJson(FILES.jobs, [])) {
    const job = { ...j, adopted: true };
    if (job.pid && isAlive(job.pid)) {
      running.push(job);
      log(`Retomando acompanhamento de /${job.role} ${job.number} (PID ${job.pid}).`);
    } else if (job.pid) {
      running.push(job);
      dead.push(job); // terminou com o despachante desligado
    } else if (job.labeled) {
      await safe('remover etiqueta', () => gh.removeLabel(job.number, LABEL_WORKING));
    }
  }
  // trava do despachante antigo (dispatcher.ps1), durante a migração
  const legacy = readJson(FILES.legacyLock, null);
  if (legacy?.pid && isAlive(legacy.pid) && !running.some((j) => j.number === legacy.number)) {
    running.push({
      role: legacy.role, number: legacy.number, pid: legacy.pid, startedAt: Date.parse(legacy.started), timeoutMin: legacy.timeoutMin,
      lane: freeSlot(running.map((j) => j.lane)), slot: 0, labeled: true, adopted: true, legacy: true, logFile: newestLog(legacy.role, legacy.number),
    });
    log(`Acompanhando execução do despachante antigo: /${legacy.role} ${legacy.number} (PID ${legacy.pid}).`);
  }
  saveJobs();
  for (const j of dead) finalize(j);
}

async function clearStaleLabels() {
  const { items } = await gh.listOpen({ force: true });
  for (const it of items) {
    if (it.labels.includes(LABEL_WORKING) && !running.some((j) => j.number === it.number)) {
      log(`#${it.number}: etiqueta '${LABEL_WORKING}' sem execução ativa; removida.`);
      await safe('remover etiqueta', () => gh.removeLabel(it.number, LABEL_WORKING));
    }
  }
}

async function dryRun() {
  const previous = readJson(FILES.jobs, []).filter((j) => isAlive(j.pid));
  const { items } = await gh.listOpen();
  const roles = ONLY ? ROLES.filter((r) => r.name === ONLY) : ROLES;
  const picks = pickJobs({
    items, running: previous, roles, maxTotal: MAX, maxPerRole: MAX_PER_ROLE, history, now: Date.now(), cfg: CFG,
    waitingResolved: await resolveWaiting(items),
  });
  console.log(`${items.length} itens abertos; ${previous.length} execução(ões) em andamento; limite ${MAX}.`);
  const until = pausedUntil();
  if (until) console.log(`Pausado até ${new Date(until).toLocaleString('pt-BR')}.`);
  if (!picks.length) console.log('Nada a executar agora.');
  for (const p of picks) console.log(`Executaria: /${p.role.name} ${p.item.number} (${kindOf(p.item.isPr)}: ${p.item.title})`);
}

async function main() {
  if (DRY) { await dryRun(); return; }

  const other = readJson(FILES.daemon, null);
  if (other?.pid && other.pid !== process.pid && isAlive(other.pid)) {
    console.log(`Outro despachante já está rodando (PID ${other.pid}).`);
    return;
  }
  writeJson(FILES.daemon, { pid: process.pid, startedAt: new Date().toISOString() });
  const stop = (why) => {
    log(`Despachante encerrado (${why}); execuções em andamento continuam e serão retomadas no próximo início.`);
    try { if (readJson(FILES.daemon, {}).pid === process.pid) unlinkSync(FILES.daemon); } catch { }
    process.exit(0);
  };
  process.on('SIGINT', () => stop('Ctrl+C'));
  process.on('SIGTERM', () => stop('sinal'));
  process.on('SIGBREAK', () => stop('janela fechada'));
  process.on('unhandledRejection', (e) => log(`ERRO inesperado: ${e?.stack ?? e}`));
  process.on('uncaughtException', (e) => { log(`ERRO fatal: ${e.stack ?? e}`); process.exit(1); });

  await adoptPreviousJobs();
  await clearStaleLabels();
  log(`Despachante contínuo iniciado (PID ${process.pid}; até ${MAX} em paralelo; consulta a cada ${POLL_SECONDS} s${ONLY ? `; só ${ONLY}` : ''}).`);
  tick(true);
  setInterval(() => tick(false), POLL_SECONDS * 1000);
}

main().catch((e) => { log(`ERRO fatal: ${e.stack ?? e.message}`); process.exit(1); });
