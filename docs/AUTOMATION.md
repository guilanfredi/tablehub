# Automação local dos agentes

O despachante (`automation/dispatcher/`) é um processo Node que fica rodando enquanto você estiver logado.
O Agendador de Tarefas o inicia no logon e o reinicia se ele cair. Ele consulta o GitHub a cada **15 s** com ETag:
quando nada mudou, o GitHub responde 304, que não conta no limite da API. **Parado, não gasta cota.**
Quando acha tarefas, roda até **3 funções em paralelo** com o Claude Code em modo automático (`claude -p "/<função> <n>"`),
usando a **sua assinatura** (não há chave de API configurada).

## Como funciona
1. Procura issues/PRs abertos com etiqueta de fase, nesta prioridade: `fase:review` → `fase:qa` → `fase:dev` → `fase:spec`.
   Dentro da mesma fase, o item parado há mais tempo vai primeiro.
2. Ignora tarefas com `agente:trabalhando`, as que não foram criadas por @guilanfredi/@gui-dev-bot, e as com `aguardando-dono`
   (até você comentar — aí remove a etiqueta e retoma).
3. Cada execução tem um **worktree próprio** em `D:\dev\TableHub-agents\<função>-<n>` (limpo, na `main`; `npm ci` quando o
   lockfile muda) e uma **faixa de portas própria**: faixa N usa web `5200+N`, worker `8800+N` e inspector `9300+N`, passadas
   por `TABLEHUB_WEB_PORT`, `TABLEHUB_WORKER_PORT` e `TABLEHUB_INSPECTOR_PORT`. `npm run dev` e `npm run e2e` respeitam essas
   variáveis. O vite falha se a porta estiver ocupada (`strictPort`), o Playwright não reaproveita servidor de outra instância
   e o worker grava o estado local em `.wrangler/state-<porta>`.
4. Marca a tarefa com `agente:trabalhando` e roda a função com as permissões de `automation/roles/<função>.json` e um tempo máximo
   (revisor 30 min, QA e analista 60, dev 120). Se estourar o tempo, comenta no PR e marca `aguardando-dono`.
   Ao terminar, encerra processos que sobraram (servidores, navegador) e consulta o GitHub de novo na hora.
5. Execução que termina **sem avançar a fase** (erro, saída inesperada) espera 10 min antes de tentar de novo. Depois de 3 seguidas,
   comenta chamando você e marca `aguardando-dono`.
6. Login expirado → pausa novos inícios por 1 h; limite de uso da assinatura → 30 min (`automation/state/paused-until.txt`).
   Execuções em andamento continuam.

Limites em `automation/dispatcher/config.mjs`: `MAX_TOTAL` (3), `MAX_PER_ROLE` (ex.: `{ revisor: 1 }`) e `POLL_SECONDS` (15).
Atenção: execuções em paralelo consomem a cota da assinatura mais rápido.

## Instalação (uma vez)
1. **Login do Claude Code CLI** (o embutido no app desktop tem login próprio). No PowerShell:
   ```powershell
   & (Get-ChildItem "$env:APPDATA\Claude\claude-code\*\*\claude.exe" | Sort-Object { [version]$_.Directory.Parent.Name } | Select-Object -Last 1).FullName
   ```
   Dentro dele, rode `/login`, entre com a conta da assinatura Pro e saia com `/exit`.
2. **Teste manual**, sem executar nada:
   ```powershell
   node D:\dev\TableHub\automation\dispatcher\index.mjs --dry-run
   ```
   Para rodar em primeiro plano e ver o log no terminal: `node automation\dispatcher\index.mjs` (Ctrl+C para parar).
3. **Instalar no Agendador** (substitui a tarefa antiga de 5 em 5 min, se existir, e já inicia):
   ```powershell
   powershell -ExecutionPolicy Bypass -File D:\dev\TableHub\automation\install-scheduler.ps1
   ```
   Remover/parar: `automation\uninstall-scheduler.ps1`. Pausar temporariamente: desabilite a tarefa "TableHub Agentes" no Agendador.
   Os worktrees da versão antiga (`TableHub-agents\<função>`, sem número) podem ser apagados com `git worktree remove`.

## Uso
- **Criar trabalho:** abra uma issue pelos modelos (Novo jogo → Analista; Bug/Melhoria → Desenvolvedor). Para jogo novo, coloque o manual em
  `D:\dev\TableHub\manuals\` antes.
- **Responder um agente:** quando aparecer `aguardando-dono` (você é mencionado e recebe notificação do GitHub), responda com um comentário.
- **Aprovar:** quando o PR chegar em `pronto-para-aprovação`, revise e aprove.
- **Rodar uma função na mão:** abra uma sessão no app e use `/analista`, `/dev`, `/qa` ou `/revisor` normalmente.

## Logs e diagnóstico
- `automation/logs/dispatcher.log` — uma linha por decisão.
- `automation/logs/<data>-<função>-<n>.json` — saída completa de cada execução (inclui custo estimado e turnos).
- `automation/state/jobs.json` — execuções em andamento (função, item, faixa, PID); `history.json` — tentativas sem avanço.
- `--dry-run` mostra o que seria feito; `--only <função>` restringe a uma função; `--max <n>` muda o limite.
- Se o despachante cair ou for reiniciado, ele volta a acompanhar as execuções em andamento e remove etiquetas
  `agente:trabalhando` que ficaram sem execução.
- `npm run agentes` mostra todas as sessões ao vivo (ver abaixo).

## Monitor de instâncias
Mostra **todas** as sessões do Claude Code na máquina — app desktop, terminal e as do despachante — com estado
(`executando`, `pensando`, `aguardando` você, `ocioso`, `encerrada`, `morta`), ferramenta atual, último pedido e pasta.
Funciona por hooks nas configurações do usuário (`~/.claude/settings.json`), que valem para qualquer instância.

- **Instalar** (uma vez, e de novo quando `automation/monitor/hook.mjs` mudar):
  ```powershell
  node automation/monitor/install.mjs
  ```
  Copia o hook para `~/.claude/monitor/hook.mjs` (independe da branch aberta) e faz backup em `settings.json.bak`.
  Sessões já abertas costumam aparecer no próximo evento (o Claude Code recarrega os hooks); se não, reinicie-as. Remover: `node automation/monitor/install.mjs --remover`.
- **Ver:** `npm run agentes` abre um dashboard no terminal, no estilo `pm2 monit`:
  - **Sessões**: todas as instâncias, com o estado de cada uma.
  - **Atividade**: o que a sessão selecionada está fazendo (pedidos, respostas, ferramentas e erros), lido do transcript ao vivo.
  - **Detalhes**: origem, PID, modelo, pasta e último pedido.
  - **Métricas**: CPU e memória da árvore de processos da sessão (com gráfico), tokens de contexto e chamadas de ferramenta.

  Teclas: `↑↓` escolhe a sessão, `PgUp/PgDn` rola a atividade, `End` volta a acompanhar, `t` mostra também as encerradas e `q` sai.
  Para scripts: `--texto` (lista simples), `--json` e `--todas` (inclui encerradas nas últimas 24 h).
- Sessões do despachante aparecem como `/<função> <n>` (variável `TABLEHUB_AGENT`).
- `⚠ sem atividade` = sessão trabalhando sem nenhum evento há mais de 10 min (possível travamento).
- Processos do Claude Code sem dados do hook também são listados (ex.: sessão parada desde antes da instalação).
- Dados em `~/.claude/monitor/sessions/` (um JSON por sessão; sessões terminadas somem após 24 h).

## Segurança
- Permissões por função em `automation/roles/`: todas negam merge, force-push, push na `main`, segredos, `gh auth` (exceto `status`), deploy e acesso à web.
  O Revisor não tem `Edit`/`Write` nem `git commit`/`git push` — é técnico, não só instrução.
- Repositório público: só tarefas criadas por você ou pelo bot são processadas, e os agentes tratam comentários de terceiros como dados.
- O token do GitHub usado pelo despachante (conta bot, via `gh auth token`) fica só na memória do processo.
- A `main` continua protegida: nada entra sem a sua aprovação.
