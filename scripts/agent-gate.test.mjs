import { describe, expect, it } from 'vitest';
import { ciState, decide, modelArgs } from './agent-gate.mjs';

const cfg = {
  owner: 'guilanfredi',
  bot: { login: 'gui-dev-bot' },
  labels: { working: 'agente:trabalhando', waiting: 'aguardando-dono' },
  ci: { checks: ['test', 'e2e'], failLabel: 'fase:dev' },
};
const role = { name: 'revisor', label: 'fase:review', timeoutMin: 30, model: 'claude-opus-5-5', effort: 'medium' };
const run = (name, status, conclusion = null, started_at = '2026-10-14T11:50:00Z') => ({ name, status, conclusion, started_at });
const GREEN = [run('test', 'completed', 'success'), run('e2e (1)', 'completed', 'success'), run('e2e (2)', 'completed', 'success'), run('sync', 'completed', 'failure')];
const pr = (labels, extra = {}) => ({ state: 'open', author: 'gui-dev-bot', labels, sha: 'abc1234', ...extra });
const go = (p, checkRuns = GREEN, c = cfg) => decide({ pr: p, checkRuns, cfg: c, role });

describe('portão das funções no GitHub Actions', () => {
  it('roda com a etiqueta da função, autor confiável e CI verde (checks não exigidos não contam)', () => {
    expect(go(pr(['fase:review']))).toEqual({ action: 'run', reason: 'CI verde' });
    expect(go(pr(['fase:review'], { author: 'guilanfredi' })).action).toBe('run');
  });

  it('não roda sem a etiqueta, em execução, aguardando o dono, fechado ou de terceiros', () => {
    expect(go(pr(['fase:qa'])).action).toBe('skip');
    expect(go(pr(['fase:review', 'agente:trabalhando'])).action).toBe('skip');
    expect(go(pr(['fase:review', 'aguardando-dono'])).action).toBe('skip');
    expect(go(pr(['fase:review'], { state: 'closed' })).action).toBe('skip');
    expect(go(pr(['fase:review'], { author: 'estranho' }))).toMatchObject({ action: 'skip', reason: /estranho/ });
  });

  it('pedido à mão ignora aguardando-dono (o dono mandou rodar), mas não o resto', () => {
    const p = { pr: pr(['fase:review', 'aguardando-dono']), checkRuns: GREEN, cfg, role, manual: true };
    expect(decide(p).action).toBe('run');
    expect(decide({ ...p, pr: pr(['fase:review', 'aguardando-dono'], { author: 'estranho' }) }).action).toBe('skip');
    expect(decide({ ...p, checkRuns: [run('test', 'in_progress')] }).action).toBe('skip');
  });

  it('espera o CI rodando ou ainda sem todos os checks exigidos', () => {
    expect(go(pr(['fase:review']), [run('test', 'completed', 'success'), run('e2e (1)', 'in_progress')]))
      .toMatchObject({ action: 'skip', reason: 'esperando o CI (e2e (1))' });
    expect(go(pr(['fase:review']), [run('test', 'completed', 'success')])).toMatchObject({ action: 'skip', reason: 'esperando o CI (e2e)' });
  });

  it('com CI vermelho, devolve para a correção (ou só espera, sem failLabel)', () => {
    const red = [run('test', 'completed', 'success'), run('e2e (1)', 'completed', 'failure'), run('e2e (2)', 'in_progress')];
    expect(go(pr(['fase:review']), red)).toMatchObject({ action: 'return', failed: ['e2e (1)'] });
    expect(go(pr(['fase:review']), red, { ...cfg, ci: { ...cfg.ci, failLabel: undefined } }).action).toBe('skip');
  });

  it('numa reexecução vale a mais recente de cada check', () => {
    const rerun = [...GREEN, run('e2e (2)', 'completed', 'failure', '2026-10-14T11:00:00Z')];
    expect(ciState(rerun, ['test', 'e2e']).state).toBe('success');
    expect(ciState([...GREEN, run('e2e (2)', 'queued', null, '2026-10-14T12:00:00Z')], ['test', 'e2e']).state).toBe('pending');
  });

  it('sem `ci` na configuração, roda sem olhar os checks', () => {
    expect(go(pr(['fase:review']), [], { ...cfg, ci: undefined }).action).toBe('run');
  });

  it('monta os argumentos de modelo e esforço', () => {
    expect(modelArgs(role)).toBe('--model claude-opus-5-5 --effort medium');
    expect(modelArgs({ ...role, effort: undefined })).toBe('--model claude-opus-5-5');
    expect(modelArgs({ name: 'x' })).toBe('');
  });
});
