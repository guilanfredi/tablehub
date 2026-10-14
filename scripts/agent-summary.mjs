#!/usr/bin/env node
/**
 * Resumo de uma execução de agente no GitHub Actions (piloto do revisor), a partir do arquivo de execução da
 * claude-code-action (lista de eventos do Claude Code; o último `type: "result"` traz tempo, turnos, tokens e
 * custo). Escreve no resumo do job e imprime uma linha JSON, para comparar com as execuções locais
 * (`npm run relatorio` do tablehub-agent-automation).
 *
 *   node agent-summary.mjs <arquivo-de-execução> <função> <número>
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Eventos do arquivo: JSON (lista) ou JSON Lines. */
export function parseEvents(text) {
  const t = text.replace(/^﻿/, '').trim();
  if (!t) return [];
  if (t.startsWith('[')) return JSON.parse(t);
  return t.split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
}

/** Totais da execução a partir do último evento `result` (null se não houver). */
export function summarize(events) {
  const r = [...events].reverse().find((e) => e?.type === 'result');
  if (!r) return null;
  const models = Object.entries(r.modelUsage ?? {});
  const sum = (key, usageKey) => (models.length ? models.reduce((a, [, m]) => a + (m[key] ?? 0), 0) : r.usage?.[usageKey] ?? 0);
  return {
    outcome: r.is_error ? `erro (${r.subtype ?? '?'})` : 'ok',
    durationMin: r.duration_ms != null ? r.duration_ms / 60_000 : null,
    apiMin: r.duration_api_ms != null ? r.duration_api_ms / 60_000 : null,
    turns: r.num_turns ?? null,
    costUsd: r.total_cost_usd ?? null,
    models: models.map(([name]) => name),
    tokens: {
      input: sum('inputTokens', 'input_tokens'),
      cacheWrite: sum('cacheCreationInputTokens', 'cache_creation_input_tokens'),
      cacheRead: sum('cacheReadInputTokens', 'cache_read_input_tokens'),
      output: sum('outputTokens', 'output_tokens'),
    },
    result: String(r.result ?? '').slice(0, 300),
  };
}

const n = (x, d = 1) => (x == null ? '—' : x.toLocaleString('pt-BR', { maximumFractionDigits: d }));

export function markdown(s, role, number) {
  if (!s) return `**${role} #${number}:** sem resultado no arquivo de execução.`;
  const t = s.tokens;
  return [
    `### ${role} #${number}: ${s.outcome}`,
    '',
    '| tempo | tempo de API | turnos | tokens (entrada · gravação/leitura de cache · saída) | custo equivalente na API |',
    '|---|---|---|---|---|',
    `| ${n(s.durationMin)} min | ${n(s.apiMin)} min | ${n(s.turns, 0)} | ${n(t.input, 0)} · ${n(t.cacheWrite, 0)} / ${n(t.cacheRead, 0)} · ${n(t.output, 0)} | US$ ${n(s.costUsd, 2)} |`,
    '',
    `Modelo: ${s.models.join(', ') || '—'}. ${s.result}`,
  ].join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [file, role = 'agente', number = '?'] = process.argv.slice(2);
  let s = null;
  try { s = summarize(parseEvents(readFileSync(file, 'utf8'))); } catch (e) { console.error(`Não consegui ler ${file}: ${e.message}`); }
  const md = markdown(s, role, number);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
  console.log(md);
  console.log(JSON.stringify({ role, number: Number(number), ...s }));
}
