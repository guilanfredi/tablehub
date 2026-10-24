# Automação local dos agentes

## Paperclip (atual)
Desde 23/10/2026 o time roda no **[Paperclip](https://github.com/paperclipai/paperclip)**, um orquestrador local (interface em
http://127.0.0.1:3100). A inicialização no Windows (`scripts/paperclip.ps1`) e a configuração do time (`paperclip/setup.mjs`, com as
instruções de cada agente) ficam no repositório
**[tablehub-agent-automation](https://github.com/guilanfredi/tablehub-agent-automation)**; o README de lá explica tudo.

| Agente | Modelo | Esforço | Recebe |
|---|---|---|---|
| Analista | Opus 5.5 | padrão | jogo novo e melhoria grande (especifica e passa ao Dev) |
| Dev | Opus 5.5 | padrão | implementação de jogo novo e melhoria especificada |
| Dev Rápido | Sonnet 5.5 | padrão | bugs e melhorias simples |
| QA | Sonnet 5.5 | médio | 1ª etapa de revisão de toda issue de código |
| Revisor | Opus 5.5 | médio | 2ª etapa; ao aprovar, marca o PR `pronto-para-aprovação` |

- Cada issue roda num worktree isolado (`D:\dev\TableHub-agents\paperclip\<issue>`, com `npm ci`) e cada agente tem uma faixa de
  portas fixa (`TABLEHUB_*_PORT`, ver "Portas por instância").
- Os agentes rodam **liberados** (padrão do Paperclip): as permissões de `.agents/roles` não se aplicam. As regras do repositório
  (sem merge, sem push na `main`, PRs pelo bot) estão nas instruções dos agentes.
- O Paperclip não conhece os limites da assinatura (sessão de 5 h, semanal): com o uso extra ligado na conta, agentes seguem
  cobrando depois do limite. Para conter isso, use orçamento por agente no Paperclip ou desligue o uso extra no claude.ai.

## Despachante (desativado) e `.agents/`
O despachante antigo consultava o GitHub a cada 15 s e rodava as funções pelas etiquetas `fase:*`. Ele está **desativado**;
as seções abaixo descrevem a configuração dele em `.agents/`, mantida como histórico (o Paperclip não a lê).
O despachante lia esses arquivos da `main` no GitHub (`origin/main`):

| Arquivo | O que define |
|---|---|
| `.agents/config.json` | repositório, dono, bot, etiquetas (inclusive a de "pronto", usada pelo relatório), funções (fase, tempo máximo, só-PR, **modelo e esforço**), **espera do CI**, pasta dos worktrees (`../TableHub-agents`), `npm ci` quando o lockfile muda, portas |
| `.agents/roles/<função>.json` | permissões do Claude Code de cada função (no modo automático, o que não está liberado é negado; quem edita roda em `acceptEdits`): todas negam merge, force-push, push na `main`, segredos, `gh auth` (exceto `status`), deploy e acesso à web; o Revisor não tem `Edit`/`Write` nem `git commit`/`git push` |
| `.agents/prompt.md` | instruções do TableHub para o modo automático (Playwright, portas, manuais) |

## Modelo e esforço por função
Para gastar menos cota, cada função usa o modelo e o esforço que o trabalho pede (`.agents/config.json`):

| Função | Modelo | Esforço | Por quê |
|---|---|---|---|
| Analista | Opus 5.5 | padrão | erro na especificação contamina todo o resto |
| Dev | Opus 5.5; **Sonnet 5.5** em issues `tipo:bug`/`tipo:melhoria` | padrão | jogo novo e melhoria especificada pedem o modelo mais forte; correção e melhoria simples, não |
| QA | Sonnet 5.5 | médio | trabalho mais mecânico (Playwright, e2e) com muitos turnos |
| Revisor | Opus 5.5 | médio | última barreira antes da aprovação; cada revisão custa pouco |

- Os modelos de issue aplicam `tipo:jogo`, `tipo:bug`, `tipo:melhoria` ou `tipo:melhoria-especificada`. Num PR, vale o tipo
  da issue que ele fecha (`Closes #N`). Sem tipo, vale o padrão da função.
- Para comparar antes/depois: `npm run relatorio` (no repositório da automação) mostra custo por função, por modelo e por tarefa.

## Testes e2e e CI
Os testes no navegador (Playwright) eram a maior parte do tempo dos agentes: a suíte completa leva cerca de 10 min
numa máquina ocupada, e falhas por lentidão (servidor ainda compilando, vários agentes testando ao mesmo tempo) viravam
investigações longas. A divisão agora é:

| Quem | Roda |
|---|---|
| Dev | só os specs da área que mexeu (tabela na skill `dev`); nunca a suíte completa |
| QA | o roteiro exploratório do PR (`e2e/<id>-qa.spec.ts`), que fica como regressão |
| CI (job `e2e` do `pr.yml`) | a suíte completa, desktop + mobile, em 2 partes paralelas e com 1 nova tentativa |

- Com `ci` no `.agents/config.json`, o despachante só chama QA e Revisor quando os checks `test` e `e2e` do último commit
  estão verdes, e devolve o PR para `fase:dev` (com um comentário) se algum falhar. O Dev troca a etiqueta logo depois
  do push, sem esperar o CI. CI instável: reexecute o job no GitHub.
- `npm run e2e` compila o app (sem service worker) e sobe só o worker, que serve o build e a API como em produção.
  Não reaproveita servidor já rodando: com `npm run dev` aberto na mesma porta, use outra (`TABLEHUB_WORKER_PORT=8790 npm run e2e`).

## Portas por instância
Para várias instâncias rodarem juntas, as portas vêm do ambiente (padrão entre parênteses):
`TABLEHUB_WEB_PORT` (5173), `TABLEHUB_WORKER_PORT` (8787) e `TABLEHUB_INSPECTOR_PORT`.
- `apps/web/vite.config.ts`: porta e proxy do worker vêm do ambiente; `strictPort` faz a porta ocupada virar erro, em vez de servir o app de outra instância.
- `apps/worker/scripts/dev.mjs`: `wrangler dev` com porta, porta do inspector e estado local (`.wrangler/state-<porta>`) próprios.
- `playwright.config.ts`: testa no worker da porta do ambiente (`TABLEHUB_WORKER_PORT`) e nunca reaproveita servidor existente.

O despachante dá à faixa N as portas `5200+N`, `8800+N` e `9300+N`. Sem as variáveis, tudo funciona como antes.

## Uso
- **Criar trabalho:** abra uma issue pelos modelos (Novo jogo → Analista; Bug/Melhoria → Desenvolvedor). Para jogo novo, coloque o manual em
  `D:\dev\TableHub\manuals\` antes.
- **Responder um agente:** quando aparecer `aguardando-dono` (você é mencionado e recebe notificação do GitHub), responda com um comentário.
- **Aprovar:** quando o PR chegar em `pronto-para-aprovação`, revise e aprove.
- **Rodar uma função na mão:** abra uma sessão no app e use `/analista`, `/dev`, `/qa` ou `/revisor` normalmente.

## Segurança
- Repositório público: só tarefas criadas por você ou pelo bot são processadas, e os agentes tratam comentários de terceiros como dados.
- A `main` continua protegida: nada entra sem a sua aprovação.
