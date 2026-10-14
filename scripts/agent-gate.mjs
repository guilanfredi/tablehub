#!/usr/bin/env node
/**
 * Portão das funções que rodam no GitHub Actions (piloto: revisor; `actions` no .agents/config.json e
 * .github/workflows/agente-revisor.yml). Aplica as mesmas regras do despachante local: etiqueta da função,
 * autor confiável (dono ou bot), sem `working`/`waiting` e os checks de `ci.checks` verdes no último commit.
 * Com CI vermelho, devolve o PR para `ci.failLabel`.
 *
 *   node scripts/agent-gate.mjs --role revisor --pr 39 [--manual]   (precisa de GH_TOKEN; escreve em GITHUB_OUTPUT)
 *   --manual: pedido à mão pelo dono (workflow_dispatch); `waiting` não impede e é removida.
 *
 * As regras de CI repetem as do `ci.mjs` do tablehub-agent-automation: vale a execução mais recente de cada
 * check, e um nome exigido cobre a matriz do Actions ("e2e" → "e2e (1)", "e2e (2)").
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const OK = new Set(['success', 'neutral', 'skipped']);

/** Estado dos checks exigidos a partir dos check runs da API REST. */
export function ciState(checkRuns, required) {
  const latest = new Map();
  for (const c of checkRuns) {
    const prev = latest.get(c.name);
    if (!prev || String(c.started_at ?? '') >= String(prev.started_at ?? '')) latest.set(c.name, c);
  }
  const failed = [];
  const pending = [];
  const missing = [];
  for (const wanted of required) {
    const runs = [...latest.values()].filter((c) => c.name === wanted || c.name.startsWith(`${wanted} (`));
    if (!runs.length) missing.push(wanted);
    for (const r of runs) {
      if (r.status !== 'completed') pending.push(r.name);
      else if (!OK.has(r.conclusion)) failed.push(r.name);
    }
  }
  const state = failed.length ? 'failure' : pending.length || missing.length ? 'pending' : 'success';
  return { state, failed, pending, missing };
}

/**
 * Decide o que fazer com o PR. Retorna { action: 'run' | 'skip' | 'return', reason, failed? }.
 * @param {object} p
 * @param {object} p.pr          { state, author, labels, sha }
 * @param {Array}  p.checkRuns   check runs do último commit
 * @param {object} p.cfg         .agents/config.json
 * @param {object} p.role        item de cfg.actions.roles
 * @param {boolean} [p.manual]   execução pedida à mão (workflow_dispatch): `waiting` não impede
 */
export function decide({ pr, checkRuns, cfg, role, manual = false }) {
  const { working, waiting } = cfg.labels;
  if (pr.state !== 'open') return { action: 'skip', reason: 'PR fechado' };
  if (!pr.labels.includes(role.label)) return { action: 'skip', reason: `sem a etiqueta ${role.label}` };
  if (pr.labels.includes(working)) return { action: 'skip', reason: `já em execução (${working})` };
  if (pr.labels.includes(waiting) && !manual) return { action: 'skip', reason: `aguardando o dono (${waiting})` };
  // segurança (repositório público): só PRs do dono ou do bot
  if (pr.author !== cfg.owner && pr.author !== cfg.bot.login) return { action: 'skip', reason: `autor ${pr.author} não é o dono nem o bot` };
  if (!cfg.ci) return { action: 'run', reason: 'sem espera de CI configurada' };
  const ci = ciState(checkRuns, cfg.ci.checks);
  if (ci.state === 'failure') {
    return cfg.ci.failLabel
      ? { action: 'return', reason: `CI falhou (${ci.failed.join(', ')})`, failed: ci.failed }
      : { action: 'skip', reason: `CI falhou (${ci.failed.join(', ')})` };
  }
  if (ci.state === 'pending') return { action: 'skip', reason: `esperando o CI (${[...ci.pending, ...ci.missing].join(', ')})` };
  return { action: 'run', reason: 'CI verde' };
}

/** Argumentos do CLI para modelo e esforço da função. */
export function modelArgs(role) {
  return [...(role.model ? ['--model', role.model] : []), ...(role.effort ? ['--effort', role.effort] : [])].join(' ');
}

// ---------------- execução no Actions ----------------
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' });

function output(values) {
  const lines = Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n');
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines}\n`);
  console.log(lines);
}

function summary(text) {
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
}

function main() {
  const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; };
  const roleName = arg('--role');
  const number = Number(arg('--pr'));
  const cfg = JSON.parse(readFileSync('.agents/config.json', 'utf8'));
  const role = cfg.actions?.roles?.find((r) => r.name === roleName);
  if (!role) throw new Error(`função ${roleName} não está em "actions.roles" do .agents/config.json`);
  if (!number) {
    summary('Nada a fazer: o evento não traz um PR deste repositório.');
    return output({ run: 'false' });
  }

  const raw = JSON.parse(gh('api', `repos/${cfg.repo}/pulls/${number}`));
  const pr = { state: raw.state, author: raw.user?.login, labels: raw.labels.map((l) => l.name), sha: raw.head.sha };
  const checkRuns = JSON.parse(gh('api', `repos/${cfg.repo}/commits/${pr.sha}/check-runs?per_page=100`)).check_runs;
  const manual = process.argv.includes('--manual');
  const d = decide({ pr, checkRuns, cfg, role, manual });
  summary(`**${role.name} #${number}** (${pr.sha.slice(0, 7)}): ${d.action === 'run' ? 'roda' : d.action === 'return' ? 'volta para a correção' : 'não roda'}, ${d.reason}.`);

  if (d.action === 'return') {
    gh('pr', 'edit', String(number), '-R', cfg.repo, '--remove-label', role.label, '--add-label', cfg.ci.failLabel);
    gh('pr', 'comment', String(number), '-R', cfg.repo, '--body',
      `**[Automação]** O CI falhou em ${pr.sha.slice(0, 7)} (${d.failed.join(', ')}). O PR voltou para \`${cfg.ci.failLabel}\` antes da função ${role.name}.`);
  }
  if (d.action === 'run' && pr.labels.includes(cfg.labels.waiting)) {
    gh('pr', 'edit', String(number), '-R', cfg.repo, '--remove-label', cfg.labels.waiting);
  }
  output({ run: String(d.action === 'run'), pr: String(number), timeout: String(role.timeoutMin), model_args: modelArgs(role) });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
