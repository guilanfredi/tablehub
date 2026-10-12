#!/usr/bin/env node
/**
 * Painel das instâncias do Claude Code rodando na máquina (dados gravados pelo hook.mjs).
 *
 *   npm run agentes                 mostra uma vez
 *   npm run agentes -- --watch      atualiza a cada 3 s (Ctrl+C para sair)
 *   npm run agentes -- --todas      inclui sessões encerradas nas últimas 24 h
 *   npm run agentes -- --json       saída em JSON (para scripts)
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { basename, join } from 'node:path';
import { SESSIONS_DIR } from './hook.mjs';

const args = new Set(process.argv.slice(2));
const WATCH = args.has('--watch');
const ALL = args.has('--todas');
const JSON_OUT = args.has('--json');
const KEEP_MS = 24 * 3600_000;
const STALE_MS = 10 * 60_000;

const tty = process.stdout.isTTY && !JSON_OUT;
const paint = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const c = { dim: paint('2'), bold: paint('1'), green: paint('32'), yellow: paint('33'), red: paint('31'), cyan: paint('36'), magenta: paint('35') };

function isAlive(pid) {
  if (!pid) return null; // desconhecido
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

/** Processos do Claude Code (exclui os processos internos do app desktop Electron). */
function claudeProcesses() {
  if (process.platform !== 'win32') return [];
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "Get-CimInstance Win32_Process -Filter \"Name='claude.exe'\" | Where-Object { $_.CommandLine -and $_.CommandLine -notmatch 'WindowsApps' } | ForEach-Object { \"$($_.ProcessId)`t$($_.CreationDate.ToString('o'))`t$($_.CommandLine)\" }",
    ], { encoding: 'utf8', timeout: 8000, windowsHide: true });
    return out.split(/\r?\n/).filter(Boolean).map((line) => {
      const [pid, started, cmd] = line.split('\t');
      return { pid: Number(pid), started, cmd };
    });
  } catch { return []; }
}

function ago(iso, now) {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
}

function origin(s) {
  if (s.agent) return 'despachante';
  if (s.entrypoint === 'claude-desktop') return 'desktop';
  if (s.entrypoint === 'cli') return 'terminal';
  if (s.entrypoint?.startsWith('sdk')) return 'headless';
  return s.entrypoint || '?';
}

function loadSessions(now) {
  let files = [];
  try { files = readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json')); } catch { return []; }
  const sessions = [];
  for (const f of files) {
    const file = join(SESSIONS_DIR, f);
    let s;
    try { s = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
    const alive = isAlive(s.claudePid);
    const finished = s.state === 'encerrada' || alive === false;
    if (finished && s.state !== 'encerrada') s.state = 'morta';
    // limpeza: sessões terminadas há mais de 24 h
    if (finished && now - Date.parse(s.lastEventAt) > KEEP_MS) { try { unlinkSync(file); } catch { } continue; }
    s.active = !finished;
    s.stale = s.active && ['pensando', 'executando'].includes(s.state) && now - Date.parse(s.lastEventAt) > STALE_MS;
    sessions.push(s);
  }
  return sessions.sort((a, b) => Number(b.active) - Number(a.active) || Date.parse(b.lastEventAt) - Date.parse(a.lastEventAt));
}

const STATE_COLOR = { executando: c.green, pensando: c.cyan, aguardando: c.yellow, iniciando: c.cyan, ocioso: c.dim, encerrada: c.dim, morta: c.red };

function render() {
  const now = Date.now();
  const sessions = loadSessions(now);
  const procs = claudeProcesses();
  const tracked = new Set(sessions.filter((s) => s.active).map((s) => s.claudePid));
  const untracked = procs.filter((p) => !tracked.has(p.pid));

  if (JSON_OUT) {
    console.log(JSON.stringify({ sessions: ALL ? sessions : sessions.filter((s) => s.active), untracked }, null, 2));
    return;
  }

  const shown = ALL ? sessions : sessions.filter((s) => s.active);
  const lines = [];
  const active = sessions.filter((s) => s.active).length;
  lines.push(c.bold(`Claude Code — ${active} sessão(ões) ativa(s)`) + c.dim(`   ${new Date(now).toLocaleTimeString('pt-BR')}`));
  lines.push('');

  if (shown.length === 0) lines.push(c.dim('Nenhuma sessão registrada pelo hook. Instalou? node automation/monitor/install.mjs'));
  for (const s of shown) {
    const name = s.agent ? `/${s.agent}` : basename(s.cwd ?? '?');
    const color = STATE_COLOR[s.state] ?? ((x) => x);
    let state = color(s.state.padEnd(10));
    if (s.state === 'executando' && s.toolStartedAt) state += c.dim(` há ${ago(s.toolStartedAt, now)}`);
    if (s.stale) state += c.red(` ⚠ sem atividade há ${ago(s.lastEventAt, now)}`);
    lines.push(`${c.bold(name)}  ${c.magenta(origin(s))}  PID ${s.claudePid ?? '?'}  ${c.dim(`${s.source ? 'aberta' : 'monitorada'} há ${ago(s.startedAt, now)} · último evento há ${ago(s.lastEventAt, now)}`)}`);
    lines.push(`  ${state}`);
    const detail = s.state === 'aguardando' ? s.message : s.currentTool;
    if (detail) lines.push(`  ${c.yellow('›')} ${detail}`);
    if (s.lastPrompt) lines.push(`  ${c.dim('pedido:')} ${s.lastPrompt}`);
    const recent = (s.recentTools ?? []).slice(s.currentTool ? 1 : 0, 4);
    if (recent.length && s.active) lines.push(`  ${c.dim('recentes: ' + recent.join(' · '))}`);
    lines.push(`  ${c.dim(s.cwd ?? '')}`);
    lines.push('');
  }

  if (untracked.length) {
    lines.push(c.yellow(`Processos do Claude Code sem dados do hook (abertos antes da instalação ou sem node no PATH): ${untracked.length}`));
    for (const p of untracked) {
      const prompt = p.cmd.match(/-p\s+"([^"]+)"/)?.[1];
      lines.push(`  PID ${p.pid}  ${c.dim(`desde ${ago(p.started, now)}`)}  ${prompt ? `-p "${prompt}"` : c.dim('interativa (app desktop/terminal)')}`);
    }
    lines.push('');
  }

  if (WATCH) process.stdout.write('\x1b[2J\x1b[H');
  console.log(lines.join('\n'));
  if (WATCH) console.log(c.dim('Atualiza a cada 3 s — Ctrl+C para sair.'));
}

render();
if (WATCH) setInterval(render, 3000);
