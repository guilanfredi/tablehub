# Automação local dos agentes

O despachante e o monitor ficam no repositório **[tablehub-agent-automation](https://github.com/guilanfredi/tablehub-agent-automation)**:
instalação, comandos (`npm run agentes`, `npm run despachante:teste`…), logs e funcionamento estão no README de lá.
Resumo: um processo fica rodando, consulta o GitHub a cada 15 s e roda as funções (`claude -p "/<função> <n>"`) com até
3 em paralelo, cada uma num worktree e com portas próprias. Parado, não gasta cota da assinatura.

Aqui no TableHub fica só o que é do projeto, em `.agents/`. O despachante lê esses arquivos da `main` no GitHub
(`origin/main`), então mudanças só valem depois de mergeadas, e ele relê a cada 10 min:

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
